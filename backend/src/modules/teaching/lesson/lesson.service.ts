import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonRepository } from './lesson.repository';
import { LessonEntity } from './lesson.entity';
import { LessonStatus } from './enums/lesson-status.enum';
import { EventBusService } from '@events/event-bus.service';
import { ClassRepository } from '../class/class.repository';
import { ClassStatus } from '../class/enums/class-status.enum';
import { EnrollmentRepository } from '../enrollment/enrollment.repository';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';
import { ReminderService } from '@modules/reminder/reminder.service';
import { ReminderType } from '@modules/reminder/enums/reminder-type.enum';
import { TargetType } from '@modules/reminder/enums/target-type.enum';
import { Student } from '@modules/student/entities/student.entity';

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
  createdBy?: number;
}

@Injectable()
export class LessonService {
  private readonly logger = new Logger(LessonService.name);

  constructor(
    private readonly lessonRepo: LessonRepository,
    private readonly eventBus: EventBusService,
    private readonly classRepo: ClassRepository,
    private readonly enrollmentRepo: EnrollmentRepository,
    private readonly reminderService: ReminderService,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
  ) {}

  // ─── Create ───

  /**
   * Create a single lesson with full validation:
   * - Time format and ordering (endTime > startTime)
   * - Class existence and ACTIVE status
   * - Lesson number range and uniqueness within class
   * - Student enrollment verification
   */
  async create(input: CreateLessonInput): Promise<LessonEntity> {
    // ─── 1. Time format & ordering validation ───
    this.validateTimeFormat(input.startTime, 'startTime');
    this.validateTimeFormat(input.endTime, 'endTime');

    if (input.endTime <= input.startTime) {
      throw new BadRequestException(
        'endTime must be greater than startTime',
      );
    }

    // ─── 2. Lesson number validation ───
    if (!Number.isInteger(input.lessonNumber) || input.lessonNumber < 1) {
      throw new BadRequestException(
        'lessonNumber must be a positive integer (>= 1)',
      );
    }
    if (input.lessonNumber > 999) {
      throw new BadRequestException(
        'lessonNumber must be <= 999',
      );
    }

    // ─── 3. Check class exists & is ACTIVE ───
    const cls = await this.classRepo.findOneByCode(input.classCode);
    if (!cls) {
      throw new NotFoundException(`Class not found: ${input.classCode}`);
    }
    if (cls.status !== ClassStatus.ACTIVE) {
      throw new BadRequestException(
        `Class ${input.classCode} is not ACTIVE (current: ${cls.status}). Lessons can only be created for ACTIVE classes.`,
      );
    }

    // ─── 4. Check courseCode matches class ───
    if (cls.courseCode !== input.courseCode) {
      throw new BadRequestException(
        `courseCode mismatch: class ${input.classCode} is for course ${cls.courseCode}, but provided ${input.courseCode}`,
      );
    }

    // ─── 5. Check lessonNumber uniqueness within class ───
    // Optimization: use targeted query instead of loading ALL lessons for the class
    const existingLesson = await this.lessonRepo.findOneByClassCodeAndLessonNumber(
      input.classCode,
      input.lessonNumber,
    );
    if (existingLesson && existingLesson.status !== LessonStatus.CANCELLED) {
      throw new BadRequestException(
        `Lesson number ${input.lessonNumber} already exists for class ${input.classCode} (lesson id=${existingLesson.id}, status=${existingLesson.status})`,
      );
    }

    // ─── 6. Validate scheduledDate is not in the distant past ───
    if (input.scheduledDate) {
      const date = new Date(input.scheduledDate);
      if (isNaN(date.getTime())) {
        throw new BadRequestException(
          `Invalid scheduledDate: ${input.scheduledDate}`,
        );
      }
      // Warn if date is more than 1 year ago (but don't block)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (date < oneYearAgo) {
        this.logger.warn(
          `Lesson scheduledDate ${input.scheduledDate} is more than 1 year in the past`,
        );
      }
    }

    // ─── 7. Build entity & save ───
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
    lesson.createdBy = input.createdBy ?? 0;

    const saved = await this.lessonRepo.save(lesson);
    this.logger.log(
      `Lesson created: id=${saved.id}, class=${saved.classCode}, #${saved.lessonNumber}, date=${saved.scheduledDate}`,
    );

    // ─── 8. Create class reminders for enrolled students ───
    this.createClassReminders(saved).catch(err =>
      this.logger.warn(`Failed to create class reminders: ${err.message}`),
    );

    return saved;
  }

  /** Batch create lessons in one transaction. For Class activation (Plan A placeholder). */
  async createBatch(inputs: CreateLessonInput[]): Promise<LessonEntity[]> {
    if (!inputs || inputs.length === 0) {
      throw new BadRequestException('inputs must not be empty');
    }

    // Validate all inputs first
    for (const input of inputs) {
      this.validateTimeFormat(input.startTime, 'startTime');
      this.validateTimeFormat(input.endTime, 'endTime');

      if (input.endTime <= input.startTime) {
        throw new BadRequestException(
          `endTime must be greater than startTime for lesson #${input.lessonNumber}`,
        );
      }
      if (!Number.isInteger(input.lessonNumber) || input.lessonNumber < 1) {
        throw new BadRequestException(
          `lessonNumber must be a positive integer, got ${input.lessonNumber}`,
        );
      }
    }

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

  async findByClassCodeAndLessonNumber(
    classCode: string,
    lessonNumber: number,
  ): Promise<LessonEntity> {
    const lesson = await this.lessonRepo.findOneByClassCodeAndLessonNumber(
      classCode,
      lessonNumber,
    );
    if (!lesson) {
      throw new NotFoundException(
        `Lesson not found: classCode=${classCode}, lessonNumber=${lessonNumber}`,
      );
    }
    return lesson;
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

    // Guard: All reopen (reverse) transitions require reason
    const isReopenTransition =
      (lesson.status === LessonStatus.ARCHIVED && targetStatus === LessonStatus.FINISHED) ||
      (lesson.status === LessonStatus.FINISHED && targetStatus === LessonStatus.SCHEDULED) ||
      (lesson.status === LessonStatus.CANCELLED && targetStatus === LessonStatus.SCHEDULED);
    if (isReopenTransition) {
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException(
          `Reason required to reopen from ${lesson.status} to ${targetStatus}`,
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

  // ─── Consistency Check: student enrollment in class ───

  /**
   * Check that a student is actively enrolled in the given class.
   * Throws BadRequestException if not enrolled.
   */
  async ensureStudentEnrolled(classCode: string, studentCode: string): Promise<void> {
    const enrollment = await this.enrollmentRepo.findByClassAndStudent(
      classCode,
      studentCode,
    );
    if (!enrollment) {
      throw new BadRequestException(
        `Student ${studentCode} is not enrolled in class ${classCode}`,
      );
    }
    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new BadRequestException(
        `Student ${studentCode} enrollment in class ${classCode} is not ACTIVE (current: ${enrollment.status})`,
      );
    }
  }

  /**
   * Check that all students are enrolled in the class.
   * Uses a single batch query to eliminate N+1 pattern.
   */
  async ensureAllStudentsEnrolled(
    classCode: string,
    studentCodes: string[],
  ): Promise<void> {
    const enrollments = await this.enrollmentRepo.findActiveByClassAndStudentCodes(classCode, studentCodes);
    const enrolledSet = new Set(enrollments.map(e => e.studentCode));
    const unenrolled = studentCodes.filter(sc => !enrolledSet.has(sc));
    if (unenrolled.length > 0) {
      throw new BadRequestException(
        `Students not actively enrolled in class ${classCode}: ${unenrolled.join(', ')}`,
      );
    }
  }

  // ─── Helpers ───

  /** Validate HH:MM time format. */
  private validateTimeFormat(time: string, fieldName: string): void {
    if (!time) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new BadRequestException(
        `${fieldName} must be in HH:MM format (00:00–23:59), got "${time}"`,
      );
    }
  }

  /** Compute duration in minutes from "HH:MM" time strings. */
  private computeDurationMinutes(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    return endH * 60 + endM - (startH * 60 + startM);
  }

  // ─── Reminder ───

  /**
   * Create CLASS_REMINDER for each enrolled student of a lesson.
   * Only creates reminders for students who have a linked userId.
   * Fire-and-forget: errors are logged but do not block lesson creation.
   */
  async createClassReminders(lesson: LessonEntity): Promise<number> {
    try {
      // 1. Find active enrollments for this class
      const enrollments = await this.enrollmentRepo.findByClassCode(lesson.classCode);
      const activeEnrollments = enrollments.filter(
        e => e.status === EnrollmentStatus.ACTIVE,
      );
      if (activeEnrollments.length === 0) return 0;

      // 2. Get studentCodes and look up userIds
      const studentCodes = activeEnrollments.map(e => e.studentCode);
      const students = await this.studentRepo
        .createQueryBuilder('s')
        .where('s.studentCode IN (:...codes)', { codes: studentCodes })
        .andWhere('s.userId IS NOT NULL')
        .andWhere('s.deleted = false')
        .getMany();

      if (students.length === 0) return 0;

      // 3. Create a reminder for each student with a userId
      let created = 0;
      for (const student of students) {
        if (!student.userId) continue; // Skip students without linked userId
        await this.reminderService.createReminder({
          type: ReminderType.CLASS_REMINDER,
          title: `课程提醒：${lesson.classCode} 第${lesson.lessonNumber}节`,
          content: `课程 ${lesson.classCode} 第${lesson.lessonNumber}节将于 ${lesson.scheduledDate} ${lesson.startTime}-${lesson.endTime} 开始，请准时上课。`,
          targetUserId: student.userId!,
          targetType: TargetType.STUDENT,
          relatedEntityId: lesson.id,
          relatedEntityType: 'Lesson',
        });
        created++;
      }

      this.logger.log(
        `Created ${created} class reminders for lesson ${lesson.id} (${lesson.classCode} #${lesson.lessonNumber})`,
      );
      return created;
    } catch (err) {
      this.logger.warn(`createClassReminders failed for lesson ${lesson.id}: ${err.message}`);
      return 0;
    }
  }
}
