import { Injectable, BadRequestException, NotFoundException, Logger, forwardRef, Inject } from '@nestjs/common';
import { LessonChangeRequestRepository } from './lesson-change-request.repository';
import { LessonChangeRequestEntity } from './lesson-change-request.entity';
import { ChangeRequestType } from '@common/enums/change-request-type.enum';
import { ChangeRequestStatus } from './enums/change-request-status.enum';
import { LessonService } from '../lesson/lesson.service';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';

/**
 * Allowed request status transitions per LessonChangeRequest lifecycle.
 * PENDING → APPROVED, PENDING → REJECTED
 * APPROVED → EXECUTED, APPROVED → REJECTED
 * REJECTED and EXECUTED are terminal.
 */
export const VALID_REQUEST_TRANSITIONS: Record<
  ChangeRequestStatus,
  ChangeRequestStatus[]
> = {
  [ChangeRequestStatus.PENDING]: [
    ChangeRequestStatus.APPROVED,
    ChangeRequestStatus.REJECTED,
  ],
  [ChangeRequestStatus.APPROVED]: [
    ChangeRequestStatus.EXECUTED,
    ChangeRequestStatus.REJECTED,
  ],
  [ChangeRequestStatus.REJECTED]: [], // terminal
  [ChangeRequestStatus.EXECUTED]: [], // terminal
};

/** Maximum reschedule requests allowed per lesson. */
export const MAX_RESCHEDULE_PER_LESSON = 3;

/** Maximum days allowed for reschedule date shift. */
export const MAX_RESCHEDULE_DAYS = 7;

/** Input for creating a change request. */
export interface CreateChangeRequestInput {
  lessonId: number;
  requestType: ChangeRequestType;
  requestedBy: number;
  reason: string;
  // RESCHEDULE fields
  previousDate?: string;
  newDate?: string;
  previousStartTime?: string;
  newStartTime?: string;
  previousEndTime?: string;
  newEndTime?: string;
  // TEACHER_CHANGE fields
  previousTeacherId?: number;
  newTeacherId?: number;
}

@Injectable()
export class LessonChangeRequestService {
  private readonly logger = new Logger(LessonChangeRequestService.name);

  constructor(
    private readonly requestRepo: LessonChangeRequestRepository,
    @Inject(forwardRef(() => LessonService))
    private readonly lessonService: LessonService,
  ) {}

  // ─── Create Request ───

  /** Submit a new change request. Status = PENDING. */
  async createRequest(
    input: CreateChangeRequestInput,
  ): Promise<LessonChangeRequestEntity> {
    if (!input.reason) {
      throw new BadRequestException('Reason is required');
    }

    if (!input.requestType) {
      throw new BadRequestException('Request type is required');
    }

    // Check reschedule limit
    if (input.requestType === ChangeRequestType.RESCHEDULE) {
      const total = await this.requestRepo.countRescheduleByLessonId(
        input.lessonId,
      );
      if (total >= MAX_RESCHEDULE_PER_LESSON) {
        throw new BadRequestException(
          'Lesson has exceeded maximum reschedule limit',
        );
      }
    }

    const entity = new LessonChangeRequestEntity();
    entity.lessonId = input.lessonId;
    entity.requestType = input.requestType;
    entity.requestedBy = input.requestedBy;
    entity.reason = input.reason;
    entity.status = ChangeRequestStatus.PENDING;
    entity.previousDate = input.previousDate ?? null;
    entity.newDate = input.newDate ?? null;
    entity.previousStartTime = input.previousStartTime ?? null;
    entity.newStartTime = input.newStartTime ?? null;
    entity.previousEndTime = input.previousEndTime ?? null;
    entity.newEndTime = input.newEndTime ?? null;
    entity.previousTeacherId = input.previousTeacherId ?? null;
    entity.newTeacherId = input.newTeacherId ?? null;

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Change request created: id=${saved.id}, lessonId=${saved.lessonId}, type=${saved.requestType}`,
    );
    return saved;
  }

  // ─── Approve ───

  /** Admin approves a PENDING request. PENDING → APPROVED. */
  async approve(
    requestId: number,
    approvedBy: number,
  ): Promise<LessonChangeRequestEntity> {
    const entity = await this.requestRepo.findOneById(requestId);
    if (!entity) {
      throw new NotFoundException(
        `Change request not found: id=${requestId}`,
      );
    }

    const allowed = VALID_REQUEST_TRANSITIONS[entity.status];
    if (!allowed.includes(ChangeRequestStatus.APPROVED)) {
      throw new BadRequestException(
        `Cannot approve change request in status ${entity.status}`,
      );
    }

    entity.status = ChangeRequestStatus.APPROVED;
    entity.approvedBy = approvedBy;
    entity.approvedAt = new Date();

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Change request approved: id=${saved.id}, approvedBy=${approvedBy}`,
    );
    return saved;
  }

  // ─── Reject ───

  /** Admin rejects a PENDING or APPROVED request. → REJECTED (terminal). */
  async reject(
    requestId: number,
    _rejectedBy: number,
    reason: string,
  ): Promise<LessonChangeRequestEntity> {
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const entity = await this.requestRepo.findOneById(requestId);
    if (!entity) {
      throw new NotFoundException(
        `Change request not found: id=${requestId}`,
      );
    }

    const allowed = VALID_REQUEST_TRANSITIONS[entity.status];
    if (!allowed.includes(ChangeRequestStatus.REJECTED)) {
      throw new BadRequestException(
        `Cannot reject change request in status ${entity.status}`,
      );
    }

    entity.status = ChangeRequestStatus.REJECTED;
    entity.rejectionReason = reason;

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Change request rejected: id=${saved.id}, reason=${reason}`,
    );
    return saved;
  }

  // ─── Execute ───

  /**
   * System executes an APPROVED request. APPROVED → EXECUTED (terminal).
   * Actually modifies Lesson data based on requestType:
   * - RESCHEDULE: update scheduledDate/startTime/endTime
   * - TEACHER_CHANGE: update teacherId
   * - CANCEL: transition Lesson status → CANCELLED
   * - REOPEN: transition Lesson status → SCHEDULED
   */
  async execute(
    requestId: number,
    executedBy: number,
  ): Promise<LessonChangeRequestEntity> {
    const entity = await this.requestRepo.findOneById(requestId);
    if (!entity) {
      throw new NotFoundException(
        `Change request not found: id=${requestId}`,
      );
    }

    const allowed = VALID_REQUEST_TRANSITIONS[entity.status];
    if (!allowed.includes(ChangeRequestStatus.EXECUTED)) {
      throw new BadRequestException(
        `Cannot execute change request in status ${entity.status}`,
      );
    }

    // ─── Apply actual changes to Lesson based on requestType ───
    switch (entity.requestType) {
      case ChangeRequestType.RESCHEDULE: {
        const lesson = await this.lessonService.findOne(entity.lessonId);
        if (entity.newDate) lesson.scheduledDate = entity.newDate;
        if (entity.newStartTime) lesson.startTime = entity.newStartTime;
        if (entity.newEndTime) lesson.endTime = entity.newEndTime;
        await this.lessonService['lessonRepo'].save(lesson);
        this.logger.log(
          `RESCHEDULE executed: lesson=${entity.lessonId}, newDate=${entity.newDate}`,
        );
        break;
      }

      case ChangeRequestType.TEACHER_CHANGE: {
        if (!entity.newTeacherId) {
          throw new BadRequestException(
            'newTeacherId is required for TEACHER_CHANGE',
          );
        }
        const lesson = await this.lessonService.findOne(entity.lessonId);
        lesson.teacherId = entity.newTeacherId;
        await this.lessonService['lessonRepo'].save(lesson);
        this.logger.log(
          `TEACHER_CHANGE executed: lesson=${entity.lessonId}, newTeacherId=${entity.newTeacherId}`,
        );
        break;
      }

      case ChangeRequestType.CANCEL: {
        await this.lessonService.updateStatus(
          entity.lessonId,
          LessonStatus.CANCELLED,
          executedBy,
          entity.reason,
        );
        this.logger.log(
          `CANCEL executed: lesson=${entity.lessonId}`,
        );
        break;
      }

      case ChangeRequestType.REOPEN: {
        await this.lessonService.updateStatus(
          entity.lessonId,
          LessonStatus.SCHEDULED,
          executedBy,
          entity.reason,
        );
        this.logger.log(
          `REOPEN executed: lesson=${entity.lessonId}`,
        );
        break;
      }

      default:
        throw new BadRequestException(
          `Unknown request type: ${entity.requestType}`,
        );
    }

    // ─── Mark request as EXECUTED ───
    entity.status = ChangeRequestStatus.EXECUTED;
    entity.executedAt = new Date();
    entity.executedBy = executedBy;

    const saved = await this.requestRepo.save(entity);
    this.logger.log(
      `Change request executed: id=${saved.id}, type=${entity.requestType}, executedBy=${executedBy}`,
    );
    return saved;
  }

  // ─── Read ───

  /** Find a change request by id. */
  async findOne(id: number): Promise<LessonChangeRequestEntity> {
    const entity = await this.requestRepo.findOneById(id);
    if (!entity) {
      throw new NotFoundException(`Change request not found: id=${id}`);
    }
    return entity;
  }

  /** Find all change requests for a lesson. */
  async findByLessonId(
    lessonId: number,
  ): Promise<LessonChangeRequestEntity[]> {
    return this.requestRepo.findByLessonId(lessonId);
  }

  /** Check if a lesson has exceeded the maximum reschedule limit. */
  async hasExceededRescheduleLimit(lessonId: number): Promise<boolean> {
    const count = await this.requestRepo.countRescheduleByLessonId(lessonId);
    return count >= MAX_RESCHEDULE_PER_LESSON;
  }
}
