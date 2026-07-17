import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { LessonRepository } from './lesson.repository';
import { LessonEntity } from './lesson.entity';
import { LessonStatus } from './enums/lesson-status.enum';
import { EventBusService } from '@events/event-bus.service';

/** Allowed status transitions per LessonStateMachine */
const VALID_TRANSITIONS: Record<LessonStatus, LessonStatus[]> = {
  [LessonStatus.DRAFT]: [LessonStatus.SCHEDULED, LessonStatus.CANCELLED],
  [LessonStatus.SCHEDULED]: [LessonStatus.TEACHING, LessonStatus.CANCELLED],
  [LessonStatus.TEACHING]: [LessonStatus.FINISHED, LessonStatus.CANCELLED],
  [LessonStatus.FINISHED]: [LessonStatus.ARCHIVED, LessonStatus.SCHEDULED],
  [LessonStatus.ARCHIVED]: [LessonStatus.FINISHED], // Reopen (requires reason, may need financial rollback)
  [LessonStatus.CANCELLED]: [LessonStatus.SCHEDULED], // Reopen
};

/** Input for creating a single Lesson. */
export interface CreateLessonInput {
  classCode: string;
  courseCode: string;
  lessonNumber: number;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  teacherId: number;
  isMakeup?: boolean;
  originLessonId?: number;
}

@Injectable()
export class LessonService {
  private readonly logger = new Logger(LessonService.name);

  constructor(
    private readonly lessonRepo: LessonRepository,
    private readonly eventBus: EventBusService,
  ) {}

  // ─── Create ───

  async create(input: CreateLessonInput): Promise<LessonEntity> {
    const lesson = new LessonEntity();
    lesson.classCode = input.classCode;
    lesson.courseCode = input.courseCode;
    lesson.lessonNumber = input.lessonNumber;
    lesson.status = LessonStatus.DRAFT;
    lesson.scheduledDate = input.scheduledDate;
    lesson.startTime = input.startTime;
    lesson.endTime = input.endTime;
    lesson.teacherId = input.teacherId;
    lesson.isMakeup = input.isMakeup ?? false;
    lesson.originLessonId = input.originLessonId ?? null;
    lesson.changeRequestId = null;
    lesson.note = null;
    lesson.cancelledReason = null;
    lesson.actualStartTime = null;
    lesson.actualEndTime = null;
    lesson.confirmedBy = null;
    lesson.confirmedAt = null;
    // createdBy: system userId — will be passed in from the caller
    lesson.createdBy = 0;

    const saved = await this.lessonRepo.save(lesson);
    this.logger.log(
      `Lesson created: id=${saved.id}, class=${saved.classCode}, #${saved.lessonNumber}`,
    );
    return saved;
  }

  /** Batch create lessons in one transaction. For Class activation (Plan A placeholder). */
  async createBatch(inputs: CreateLessonInput[]): Promise<LessonEntity[]> {
    const lessons = inputs.map((input) => {
      const lesson = new LessonEntity();
      lesson.classCode = input.classCode;
      lesson.courseCode = input.courseCode;
      lesson.lessonNumber = input.lessonNumber;
      lesson.status = LessonStatus.SCHEDULED; // System-generated skip DRAFT
      lesson.scheduledDate = input.scheduledDate;
      lesson.startTime = input.startTime;
      lesson.endTime = input.endTime;
      lesson.teacherId = input.teacherId;
      lesson.isMakeup = input.isMakeup ?? false;
      lesson.originLessonId = input.originLessonId ?? null;
      lesson.changeRequestId = null;
      lesson.note = null;
      lesson.cancelledReason = null;
      lesson.actualStartTime = null;
      lesson.actualEndTime = null;
      lesson.confirmedBy = null;
      lesson.confirmedAt = null;
      lesson.createdBy = 0;
      return lesson;
    });

    const saved = await this.lessonRepo.saveAll(lessons);
    this.logger.log(
      `Batch created ${saved.length} lessons for class ${inputs[0]?.classCode}`,
    );
    return saved;
  }

  // ─── Read ───

  async findOne(id: number): Promise<LessonEntity> {
    const lesson = await this.lessonRepo.findOneById(id);
    if (!lesson) {
      throw new NotFoundException(`Lesson not found: id=${id}`);
    }
    return lesson;
  }

  async findByClassCode(classCode: string): Promise<LessonEntity[]> {
    return this.lessonRepo.findByClassCode(classCode);
  }

  // ─── Status Change ───

  async updateStatus(
    id: number,
    targetStatus: LessonStatus,
    operatedBy: number,
    reason?: string,
  ): Promise<LessonEntity> {
    const lesson = await this.findOne(id);

    if (lesson.status === targetStatus) {
      throw new BadRequestException(
        `Lesson is already in status: ${targetStatus}`,
      );
    }

    const allowed = VALID_TRANSITIONS[lesson.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${lesson.status} -> ${targetStatus}. ` +
          `Allowed from ${lesson.status}: ${allowed.join(', ') || 'none'}`,
      );
    }

    // Guard: CANCELLED requires reason
    if (targetStatus === LessonStatus.CANCELLED) {
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException(
          'cancelledReason is required for CANCELLED status',
        );
      }
      lesson.cancelledReason = reason;
    }

    // Guard: ARCHIVED → FINISHED (reopen) requires reason
    if (
      lesson.status === LessonStatus.ARCHIVED &&
      targetStatus === LessonStatus.FINISHED
    ) {
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException(
          'Reason required to reopen from ARCHIVED to FINISHED (may need financial rollback)',
        );
      }
    }

    // Guard: FINISHED → SCHEDULED (reopen) requires reason
    if (
      lesson.status === LessonStatus.FINISHED &&
      targetStatus === LessonStatus.SCHEDULED
    ) {
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException(
          'Reason required to reopen from FINISHED to SCHEDULED',
        );
      }
    }

    // Guard: CANCELLED → SCHEDULED (reopen) requires reason
    if (
      lesson.status === LessonStatus.CANCELLED &&
      targetStatus === LessonStatus.SCHEDULED
    ) {
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException(
          'Reason required to reopen from CANCELLED to SCHEDULED',
        );
      }
    }

    const oldStatus = lesson.status;
    lesson.status = targetStatus;

    // Fill actual times on lifecycle transitions
    if (targetStatus === LessonStatus.TEACHING) {
      lesson.actualStartTime = new Date();
    }
    if (targetStatus === LessonStatus.FINISHED) {
      lesson.actualEndTime = new Date();
    }

    const saved = await this.lessonRepo.save(lesson);

    this.logger.log(
      `Lesson status changed: id=${id} ${oldStatus} -> ${targetStatus}`,
    );

    // ─── Event Publishing ───
    if (targetStatus === LessonStatus.FINISHED) {
      this.eventBus.publish('lesson.completed', {
        lessonId: saved.id,
        classCode: saved.classCode,
        courseCode: saved.courseCode,
        teacherId: saved.teacherId,
        scheduledDate: saved.scheduledDate,
        actualStartTime: saved.actualStartTime?.toISOString() ?? null,
        actualEndTime: saved.actualEndTime?.toISOString() ?? null,
        durationMinutes: this.computeDurationMinutes(
          saved.startTime,
          saved.endTime,
        ),
      });
    }

    if (targetStatus === LessonStatus.ARCHIVED) {
      this.eventBus.publish('lesson.finished', {
        lessonId: saved.id,
        classCode: saved.classCode,
        courseCode: saved.courseCode,
        teacherId: saved.teacherId,
        scheduledDate: saved.scheduledDate,
        actualStartTime: saved.actualStartTime?.toISOString() ?? null,
        actualEndTime: saved.actualEndTime?.toISOString() ?? null,
        durationMinutes: this.computeDurationMinutes(
          saved.startTime,
          saved.endTime,
        ),
        confirmedBy: operatedBy,
        confirmedAt: new Date().toISOString(),
      });
    }

    return saved;
  }

  // ─── Helpers ───

  /** Compute duration in minutes from "HH:MM" time strings. */
  private computeDurationMinutes(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    return endH * 60 + endM - (startH * 60 + startM);
  }
}
