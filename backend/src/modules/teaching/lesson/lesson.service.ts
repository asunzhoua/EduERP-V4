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
import { LessonSource } from './enums/lesson-source.enum';
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
  [LessonStatus.SCHEDULED]: [
    LessonStatus.TEACHING,
    LessonStatus.CANCELLED,
    LessonStatus.SUSPENDED,
  ],
  [LessonStatus.TEACHING]: [LessonStatus.FINISHED, LessonStatus.CANCELLED],
  [LessonStatus.FINISHED]: [LessonStatus.ARCHIVED, LessonStatus.SCHEDULED],
  [LessonStatus.ARCHIVED]: [LessonStatus.FINISHED], // Reopen (requires reason, may need financial rollback)
  [LessonStatus.CANCELLED]: [
    LessonStatus.SCHEDULED,
    LessonStatus.MAKEUP_PENDING,
  ],
  [LessonStatus.SUSPENDED]: [
    LessonStatus.SCHEDULED,
    LessonStatus.RESCHEDULED,
    LessonStatus.MAKEUP_PENDING,
  ],
  [LessonStatus.RESCHEDULED]: [LessonStatus.TEACHING],
  [LessonStatus.MAKEUP_PENDING]: [LessonStatus.RESCHEDULED],
  [LessonStatus.MAKEUP_COMPLETED]: [],
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
  topic?: string;
  isMakeup?: boolean;
  originLessonId?: number;
  createdBy?: number;
  /**
   * Optional initial status. Defaults to DRAFT (keeps manual/makeup creation
   * semantics unchanged). The check-in path passes SCHEDULED so the lesson can
   * progress SCHEDULED → TEACHING → FINISHED.
   */
  status?: LessonStatus;
  /** 课时来源（台账追溯），默认 ADMIN_MANUAL */
  source?: LessonSource;
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
      throw new BadRequestException('endTime must be greater than startTime');
    }

    // ─── 1.5. Status whitelist: lessons may only be created as DRAFT or SCHEDULED ───
    if (
      input.status &&
      input.status !== LessonStatus.DRAFT &&
      input.status !== LessonStatus.SCHEDULED
    ) {
      throw new BadRequestException(
        `Invalid lesson status for creation: ${input.status}. Allowed: DRAFT, SCHEDULED`,
      );
    }

    // ─── 2. Lesson number validation ───
    if (!Number.isInteger(input.lessonNumber) || input.lessonNumber < 1) {
      throw new BadRequestException(
        'lessonNumber must be a positive integer (>= 1)',
      );
    }
    if (input.lessonNumber > 999) {
      throw new BadRequestException('lessonNumber must be <= 999');
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
    const existingLesson =
      await this.lessonRepo.findOneByClassCodeAndLessonNumber(
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
    lesson.status = input.status ?? LessonStatus.DRAFT;
    lesson.source = input.source ?? LessonSource.ADMIN_MANUAL;
    lesson.scheduledDate = input.scheduledDate;
    lesson.startTime = input.startTime;
    lesson.endTime = input.endTime;
    lesson.teacherId = input.teacherId;
    lesson.topic = input.topic ?? null;
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
    this.createClassReminders(saved).catch((err) =>
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
      lesson.source = LessonSource.ADMIN_BATCH;
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

  // ─── Batch Scheduling (P3-2: 一键排课) ───

  /**
   * 按班级固定课表批量生成未来课时（P3-2）。
   *
   * 规则：
   * - 仅 ACTIVE 班级可排课；前置校验 dayOfWeek 非空、startTime < endTime、totalLessons > 0、起始日不早于昨天。
   * - 已存在的相同（date+startTime+endTime）时段跳过并计数，不生成不报错。
   * - lessonNumber 从该班级现有最大值续号，保持连续。
   * - 可选检测教师时间冲突（默认关）；开启则列出冲突供管理员决策，仍正常生成。
   */
  async generateClassLessons(
    classCode: string,
    dto: {
      startDate: string;
      count?: number;
      checkConflict?: boolean;
      teacherId: number;
    },
    operatorId: number,
  ): Promise<{
    classCode: string;
    requested: number;
    generated: number;
    skipped: number;
    conflicts: { date: string; startTime: string; endTime: string; reason: string }[];
    firstLessonNumber: number | null;
    message: string;
  }> {
    const cls = await this.classRepo.findOneByCode(classCode);
    if (!cls) {
      throw new NotFoundException(`Class not found: ${classCode}`);
    }
    if (cls.status !== ClassStatus.ACTIVE) {
      throw new BadRequestException(
        `班级 ${classCode} 不是进行中状态，无法排课（当前：${cls.status}）`,
      );
    }

    // 前置校验
    const days = cls.dayOfWeek ?? [];
    if (days.length === 0) {
      throw new BadRequestException('班级未配置上课星期，无法排课');
    }
    if (!cls.startTime || !cls.endTime || cls.endTime <= cls.startTime) {
      throw new BadRequestException('班级上课时间无效（开始时间需早于结束时间）');
    }
    if (!cls.totalLessons || cls.totalLessons <= 0) {
      throw new BadRequestException('班级总课时无效');
    }

    const start = new Date(dto.startDate);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('起始日期无效');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (start < yesterday) {
      throw new BadRequestException('起始日期不能早于昨天');
    }

    // 现有课时：去重时段 + 最大值 + 非取消计数
    const existing = await this.lessonRepo.findByClassCode(classCode);
    const existingSlots = new Set<string>();
    let maxNumber = 0;
    let nonCancelled = 0;
    for (const l of existing) {
      if (l.lessonNumber > maxNumber) maxNumber = l.lessonNumber;
      if (l.status !== LessonStatus.CANCELLED) {
        nonCancelled++;
        existingSlots.add(`${l.scheduledDate}|${l.startTime}|${l.endTime}`);
      }
    }

    const remaining = cls.totalLessons - nonCancelled;
    if (remaining <= 0) {
      return {
        classCode,
        requested: 0,
        generated: 0,
        skipped: 0,
        conflicts: [],
        firstLessonNumber: null,
        message: `班级 ${classCode} 已排满 ${cls.totalLessons} 课时，无需再排`,
      };
    }
    const toGenerate = dto.count ? Math.min(dto.count, remaining) : remaining;

    // 收集候选日期（跳过已有时段）
    const candidates: string[] = [];
    const skippedDates: string[] = [];
    const cursor = new Date(start);
    let guard = 0;
    while (candidates.length < toGenerate && guard < 1095) {
      const wd = cursor.getDay() === 0 ? 7 : cursor.getDay(); // 1=Mon..7=Sun
      if (days.includes(wd)) {
        const dateStr = this.toYMD(cursor);
        const slot = `${dateStr}|${cls.startTime}|${cls.endTime}`;
        if (existingSlots.has(slot)) {
          skippedDates.push(dateStr);
        } else {
          candidates.push(dateStr);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }

    // 可选：教师时间冲突检测
    let conflicts: {
      date: string;
      startTime: string;
      endTime: string;
      reason: string;
    }[] = [];
    if (dto.checkConflict && candidates.length > 0) {
      const first = candidates[0];
      const last = candidates[candidates.length - 1];
      const teacherLessons = await this.lessonRepo.findByTeacherAndDateRange(
        dto.teacherId,
        first,
        last,
      );
      for (const dateStr of candidates) {
        const overlaps = teacherLessons.filter(
          (l) =>
            l.scheduledDate === dateStr &&
            l.startTime < cls.endTime &&
            l.endTime > cls.startTime,
        );
        if (overlaps.length > 0) {
          conflicts.push({
            date: dateStr,
            startTime: cls.startTime,
            endTime: cls.endTime,
            reason: `与老师第 ${overlaps.map((o) => o.lessonNumber).join('、')} 课时时间重叠`,
          });
        }
      }
    }

    // 建实体并保存
    const created: LessonEntity[] = [];
    let lessonNumber = maxNumber;
    for (const dateStr of candidates) {
      lessonNumber += 1;
      const lesson = new LessonEntity();
      lesson.classCode = classCode;
      lesson.courseCode = cls.courseCode;
      lesson.lessonNumber = lessonNumber;
      lesson.status = LessonStatus.SCHEDULED;
      lesson.source = LessonSource.ADMIN_BATCH;
      lesson.scheduledDate = dateStr;
      lesson.startTime = cls.startTime;
      lesson.endTime = cls.endTime;
      lesson.teacherId = dto.teacherId;
      lesson.topic = null;
      lesson.isMakeup = false;
      lesson.originLessonId = null;
      lesson.changeRequestId = null;
      lesson.note = null;
      lesson.cancelledReason = null;
      lesson.actualStartTime = null;
      lesson.actualEndTime = null;
      lesson.confirmedBy = null;
      lesson.confirmedAt = null;
      lesson.createdBy = operatorId;
      created.push(lesson);
    }
    const saved =
      created.length > 0 ? await this.lessonRepo.saveAll(created) : [];

    return {
      classCode,
      requested: toGenerate,
      generated: saved.length,
      skipped: skippedDates.length,
      conflicts,
      firstLessonNumber: saved.length > 0 ? maxNumber + 1 : null,
      message: `已生成 ${saved.length} 课时${
        skippedDates.length > 0 ? `，跳过 ${skippedDates.length} 个重复时段` : ''
      }${conflicts.length > 0 ? `，发现 ${conflicts.length} 处教师时间冲突` : ''}`,
    };
  }

  private toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
      (lesson.status === LessonStatus.ARCHIVED &&
        targetStatus === LessonStatus.FINISHED) ||
      (lesson.status === LessonStatus.FINISHED &&
        targetStatus === LessonStatus.SCHEDULED) ||
      (lesson.status === LessonStatus.CANCELLED &&
        targetStatus === LessonStatus.SCHEDULED);
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
        completedAt: saved.actualEndTime ?? new Date(),
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

    // Phase 2 Batch 2.1: Publish lesson.cancelled event
    if (targetStatus === LessonStatus.CANCELLED) {
      this.eventBus.publish('lesson.cancelled', {
        lessonId: saved.id,
        classCode: saved.classCode,
        courseCode: saved.courseCode,
        teacherId: saved.teacherId,
        scheduledDate: saved.scheduledDate,
        cancelledReason: saved.cancelledReason,
        cancelledBy: operatedBy,
        cancelledAt: new Date().toISOString(),
      });
    }

    return saved;
  }

  // ─── Consistency Check: student enrollment in class ───

  /**
   * Check that a student is actively enrolled in the given class.
   * Throws BadRequestException if not enrolled.
   */
  async ensureStudentEnrolled(
    classCode: string,
    studentCode: string,
  ): Promise<void> {
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
    const enrollments =
      await this.enrollmentRepo.findActiveByClassAndStudentCodes(
        classCode,
        studentCodes,
      );
    const enrolledSet = new Set(enrollments.map((e) => e.studentCode));
    const unenrolled = studentCodes.filter((sc) => !enrolledSet.has(sc));
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
      const enrollments = await this.enrollmentRepo.findByClassCode(
        lesson.classCode,
      );
      const activeEnrollments = enrollments.filter(
        (e) => e.status === EnrollmentStatus.ACTIVE,
      );
      if (activeEnrollments.length === 0) return 0;

      // 2. Get studentCodes and look up userIds
      const studentCodes = activeEnrollments.map((e) => e.studentCode);
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
          targetUserId: student.userId,
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
      this.logger.warn(
        `createClassReminders failed for lesson ${lesson.id}: ${err.message}`,
      );
      return 0;
    }
  }
}
