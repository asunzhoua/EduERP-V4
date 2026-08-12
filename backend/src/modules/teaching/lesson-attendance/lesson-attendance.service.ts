import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonAttendanceRepository } from './lesson-attendance.repository';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import {
  AttendanceStatus,
  DEDUCTIBLE_STATUSES,
} from './enums/attendance-status.enum';
import { AttendanceWorkflowState } from './enums/attendance-workflow-state.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { DeductionSkipReason } from './enums/deduction-skip-reason.enum';
import { ReminderService } from '@modules/reminder/reminder.service';
import { ReminderType } from '@modules/reminder/enums/reminder-type.enum';
import { TargetType } from '@modules/reminder/enums/target-type.enum';
import {
  PointsService,
  POINTS_PER_ATTENDED_LESSON,
} from '@modules/points/points.service';
import { ContractRepository } from '@modules/teaching/contract/contract.repository';
import { ContractStatus } from '@modules/teaching/contract/enums/contract-status.enum';
import { ContractEntity } from '@modules/teaching/contract/contract.entity';
import { ClassEntity } from '@modules/teaching/class/class.entity';
import { CourseEntity } from '@modules/teaching/course/course.entity';
import { Student } from '@modules/student/entities/student.entity';
import { LessonRepository } from '../lesson/lesson.repository';
import { LessonEntity } from '../lesson/lesson.entity';
import { LessonStatus } from '../lesson/enums/lesson-status.enum';
import {
  ImportService,
  ImportColumn,
  ImportReport,
} from '@utils/services/import.service';

/**
 * Allowed workflow state transitions per AttendanceStateMachine.
 * Forward: PENDING → CHECKED_IN → CONFIRMED → LOCKED
 * Reverse: CONFIRMED → CHECKED_IN, CHECKED_IN → PENDING
 */
export const VALID_WORKFLOW_TRANSITIONS: Record<
  AttendanceWorkflowState,
  AttendanceWorkflowState[]
> = {
  [AttendanceWorkflowState.PENDING]: [AttendanceWorkflowState.CHECKED_IN],
  [AttendanceWorkflowState.CHECKED_IN]: [
    AttendanceWorkflowState.CONFIRMED,
    AttendanceWorkflowState.PENDING, // reverse (admin override)
  ],
  [AttendanceWorkflowState.CONFIRMED]: [
    AttendanceWorkflowState.LOCKED,
    AttendanceWorkflowState.CHECKED_IN, // reverse (admin override)
  ],
  [AttendanceWorkflowState.LOCKED]: [], // terminal
};

/** Statuses that require a reason when recorded. */
export const REASON_REQUIRED_STATUSES: ReadonlySet<AttendanceStatus> = new Set([
  AttendanceStatus.LATE,
  AttendanceStatus.LEAVE,
  AttendanceStatus.SICK,
  AttendanceStatus.ABSENT,
]);

/** Input for recording attendance for a single student. */
export interface RecordAttendanceInput {
  lessonId: number;
  studentCode: string;
  status: AttendanceStatus;
  reason?: string;
  operator: number;
  source?: AttendanceSource;
  note?: string;
}

/** Input for batch roll call. */
export interface BatchRollCallInput {
  lessonId: number;
  records: RecordAttendanceInput[];
}

/** Result of a lesson deduction operation. */
export interface LessonDeductionResult {
  contractId: number;
  studentCode: string;
  contractCode: string;
  previousRemaining: number;
  newRemaining: number;
  statusChanged: boolean;
}

@Injectable()
export class LessonAttendanceService {
  private readonly logger = new Logger(LessonAttendanceService.name);

  constructor(
    private readonly attendanceRepo: LessonAttendanceRepository,
    private readonly reminderService: ReminderService,
    private readonly contractRepo: ContractRepository,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    private readonly pointsService: PointsService,
    private readonly lessonRepo: LessonRepository,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly importService: ImportService,
  ) {}

  // ─── Auto-Creation ───

  /**
   * Auto-create attendance records when Lesson → TEACHING.
   * ATTEND-003: Creates PENDING records for each enrolled student.
   */
  async autoCreateForLesson(
    lessonId: number,
    enrolledStudentCodes: string[],
    classCode: string,
    teacherId: number,
  ): Promise<LessonAttendanceEntity[]> {
    const entities: LessonAttendanceEntity[] = [];

    for (const studentCode of enrolledStudentCodes) {
      const entity = new LessonAttendanceEntity();
      entity.lessonId = lessonId;
      entity.studentCode = studentCode;
      entity.classCode = classCode;
      entity.teacherId = teacherId;
      entity.workflowState = AttendanceWorkflowState.PENDING;
      entity.status = null;
      entity.operator = teacherId;
      entity.source = AttendanceSource.API;
      entity.createdBy = teacherId;
      entities.push(entity);
    }

    return this.attendanceRepo.saveAll(entities);
  }

  // ─── Roll Call ───

  /**
   * Record attendance for a single student. PENDING → CHECKED_IN.
   * ATTEND-001: Validates workflow transition.
   * ATTEND-002: LATE/LEAVE/ABSENT require reason.
   * Validates that the status is a known AttendanceStatus value.
   *
   * PHASE 2 BATCH 2.1: Now triggers contract lesson deduction
   * when status is deductible (PRESENT/LATE/ONLINE/OFFLINE) and
   * this is the first check-in (PENDING → CHECKED_IN).
   */
  async recordAttendance(
    input: RecordAttendanceInput,
  ): Promise<LessonAttendanceEntity> {
    // ─── Input validation ───
    if (!input.studentCode?.trim()) {
      throw new BadRequestException('studentCode is required');
    }
    if (!input.status) {
      throw new BadRequestException('status is required');
    }

    // Validate status is a valid AttendanceStatus enum value
    const validStatuses = Object.values(AttendanceStatus);
    if (!validStatuses.includes(input.status)) {
      throw new BadRequestException(
        `Invalid attendance status: "${input.status}". Valid values: ${validStatuses.join(', ')}`,
      );
    }

    // ─── Find existing record ───
    const entity = await this.attendanceRepo.findByLessonAndStudent(
      input.lessonId,
      input.studentCode,
    );

    if (!entity) {
      throw new NotFoundException(
        `Attendance record not found for lesson ${input.lessonId}, student ${input.studentCode}. ` +
          `Records must be auto-created (via autoCreateForLesson) before roll call.`,
      );
    }

    // ─── Workflow state check ───
    this.validateWorkflowTransition(
      entity.workflowState,
      AttendanceWorkflowState.CHECKED_IN,
    );

    // ─── Reason required for specific statuses ───
    if (REASON_REQUIRED_STATUSES.has(input.status) && !input.reason?.trim()) {
      throw new BadRequestException(`Status ${input.status} requires a reason`);
    }

    // ─── Track if this is first check-in (for deduction) ───
    const isFirstCheckIn =
      entity.workflowState === AttendanceWorkflowState.PENDING;

    // ─── Apply changes ───
    entity.workflowState = AttendanceWorkflowState.CHECKED_IN;
    entity.status = input.status;
    entity.checkInTime = new Date();
    entity.operator = input.operator;
    entity.source = input.source ?? AttendanceSource.MANUAL;
    entity.reason = input.reason ?? null;
    entity.note = input.note ?? null;

    this.logger.log(
      `Attendance recorded: lesson=${input.lessonId}, student=${input.studentCode}, status=${input.status}`,
    );

    const saved = await this.attendanceRepo.save(entity);

    // ─── PHASE 2: Contract lesson deduction (only on first check-in, never twice) ───
    if (
      isFirstCheckIn &&
      !entity.deductedContractId &&
      DEDUCTIBLE_STATUSES.has(input.status)
    ) {
      // 课程完成奖励积分（与扣课同源触发，仅首次签到；失败不影响考勤主流程）
      this.pointsService
        .credit(
          input.studentCode,
          POINTS_PER_ATTENDED_LESSON,
          `完成课时 lesson=${input.lessonId}`,
          { type: 'LESSON', id: input.lessonId },
        )
        .catch((err) =>
          this.logger.warn(
            `Failed to credit points for student ${input.studentCode}: ${(err as Error).message}`,
          ),
        );

      // Subject resolution may throw on a repo/DB error; guard so an infra
      // failure never propagates (the attendance is already saved). Distinguish
      // from a genuine "no subject" business case: infra errors get no badge.
      let subject: string | null = null;
      let resolveFailed = false;
      try {
        subject = await this.resolveLessonSubject(entity.classCode);
      } catch (err) {
        resolveFailed = true;
        this.logger.warn(
          `Cannot resolve lesson subject for class ${entity.classCode}: ${(err as Error).message}`,
        );
      }
      if (subject) {
        try {
          const result = await this.deductLessonFromContract(
            input.studentCode,
            subject,
          );
          if (result) {
            saved.deductedContractId = result.contractId;
            await this.attendanceRepo.save(saved);
          } else {
            saved.deductionSkippedReason =
              DeductionSkipReason.NO_ACTIVE_CONTRACT;
            await this.attendanceRepo.save(saved);
          }
        } catch (err) {
          this.logger.warn(
            `Lesson deduction failed for student ${input.studentCode}: ${(err as Error).message}`,
          );
        }
      } else if (!resolveFailed) {
        saved.deductionSkippedReason = DeductionSkipReason.NO_SUBJECT;
        await this.attendanceRepo.save(saved);
      }
    }

    // ─── Create attendance reminder for teacher ───
    this.createAttendanceReminders(
      entity.teacherId,
      entity.lessonId,
      entity.classCode,
    ).catch((err) =>
      this.logger.warn(
        `Failed to create attendance reminder: ${(err as Error).message}`,
      ),
    );

    return saved;
  }

  /**
   * Batch roll call — record attendance for all students at once.
   * Uses a single query + batch save to eliminate N+1 pattern.
   *
   * PHASE 2 BATCH 2.1: Now triggers contract lesson deduction
   * for each student with deductible status on first check-in.
   */
  async batchRollCall(
    input: BatchRollCallInput,
  ): Promise<LessonAttendanceEntity[]> {
    // 1. Batch query existing records
    const studentCodes = input.records.map((r) => r.studentCode);
    const existingRecords =
      await this.attendanceRepo.findByLessonIdAndStudentCodes(
        input.lessonId,
        studentCodes,
      );
    const existingMap = new Map(existingRecords.map((r) => [r.studentCode, r]));

    const results: LessonAttendanceEntity[] = [];

    for (const recordInput of input.records) {
      const entity = existingMap.get(recordInput.studentCode);
      if (!entity) {
        throw new NotFoundException(
          `Attendance record not found for lesson=${input.lessonId}, student=${recordInput.studentCode}`,
        );
      }

      // Validate status enum
      if (!Object.values(AttendanceStatus).includes(recordInput.status)) {
        throw new BadRequestException(
          `Invalid attendance status: ${recordInput.status}`,
        );
      }

      // Validate workflow state — must be PENDING
      if (entity.workflowState !== AttendanceWorkflowState.PENDING) {
        throw new BadRequestException(
          `Cannot record attendance for student ${recordInput.studentCode}: current state is ${entity.workflowState}, expected PENDING`,
        );
      }

      // Validate reason requirement
      if (
        REASON_REQUIRED_STATUSES.has(recordInput.status) &&
        !recordInput.reason?.trim()
      ) {
        throw new BadRequestException(
          `Reason is required for status ${recordInput.status} (student: ${recordInput.studentCode})`,
        );
      }

      // Apply changes
      entity.workflowState = AttendanceWorkflowState.CHECKED_IN;
      entity.status = recordInput.status;
      entity.checkInTime = new Date();
      entity.operator = recordInput.operator;
      entity.source = recordInput.source ?? AttendanceSource.MANUAL;
      entity.reason = recordInput.reason ?? null;
      entity.note = recordInput.note ?? null;

      results.push(entity);
    }

    this.logger.log(
      `Batch roll call completed: lesson=${input.lessonId}, count=${results.length}`,
    );

    const saved = await this.attendanceRepo.saveAll(results);

    // ─── PHASE 2: Contract lesson deduction for all deductible students ───
    let subject: string | null = null;
    let resolveFailed = false;
    if (results.length > 0) {
      try {
        subject = await this.resolveLessonSubject(results[0].classCode);
      } catch (err) {
        resolveFailed = true;
        this.logger.warn(
          `Cannot resolve lesson subject for class ${results[0].classCode}: ${(err as Error).message}`,
        );
      }
    }
    const ledgerUpdates: LessonAttendanceEntity[] = [];
    for (const entity of results) {
      if (
        entity.status &&
        DEDUCTIBLE_STATUSES.has(entity.status) &&
        !entity.deductedContractId
      ) {
        // 课程完成奖励积分（首次签到即可扣课状态；失败不影响考勤主流程）
        this.pointsService
          .credit(
            entity.studentCode,
            POINTS_PER_ATTENDED_LESSON,
            `完成课时 lesson=${input.lessonId}`,
            { type: 'LESSON', id: input.lessonId },
          )
          .catch((err) =>
            this.logger.warn(
              `Failed to credit points for student ${entity.studentCode}: ${(err as Error).message}`,
            ),
          );

        if (!subject) {
          if (!resolveFailed) {
            entity.deductionSkippedReason = DeductionSkipReason.NO_SUBJECT;
            ledgerUpdates.push(entity);
          }
          continue;
        }
        try {
          const result = await this.deductLessonFromContract(
            entity.studentCode,
            subject,
          );
          if (result) {
            entity.deductedContractId = result.contractId;
            ledgerUpdates.push(entity);
          } else {
            entity.deductionSkippedReason =
              DeductionSkipReason.NO_ACTIVE_CONTRACT;
            ledgerUpdates.push(entity);
          }
        } catch (err) {
          this.logger.warn(
            `Lesson deduction failed for student ${entity.studentCode}: ${(err as Error).message}`,
          );
        }
      }
    }
    if (ledgerUpdates.length > 0) {
      await this.attendanceRepo.saveAll(ledgerUpdates);
    }

    // ─── Create attendance reminder for teacher ───
    if (results.length > 0) {
      this.createAttendanceReminders(
        results[0].teacherId,
        input.lessonId,
        results[0].classCode,
      ).catch((err) =>
        this.logger.warn(
          `Failed to create attendance reminder: ${(err as Error).message}`,
        ),
      );
    }

    return saved;
  }

  // ─── Attendance Bulk Import (P2-3: 上课/考勤记录导入) ───

  /**
   * 批量补录上课/考勤记录（管理端，SuperAdmin/Admin）。
   * Excel 列：学员编码 + 出勤状态，课时通过「课时ID」或「班级编码 + 上课日期」定位。
   * 逐行复用 recordAttendance 逻辑（含扣课时/积分/提醒），单行失败记录原因不中断。
   * 已录考勤（非 PENDING）的行跳过，防止重复扣课。
   */
  async importAttendance(
    buffer: Buffer,
    fileName: string,
    operatorId: number,
    operatorName?: string,
  ): Promise<ImportReport> {
    const rows = this.importService.parseBuffer(buffer, fileName);

    const columns: ImportColumn[] = [
      {
        header: 'studentcode',
        aliases: ['学员编码', '学员编号', '学号'],
        required: true,
      },
      {
        header: 'status',
        aliases: ['出勤状态', '状态'],
        required: true,
        validate: (v) =>
          this.parseAttendanceStatus(v)
            ? null
            : '出勤状态无效（如 PRESENT/出勤/缺勤/迟到/请假/线上/线下）',
      },
      {
        header: 'lessonid',
        aliases: ['课时ID', '课时编号', '课时编码'],
        required: false,
        validate: (v) => (v && isNaN(Number(v)) ? '课时ID必须是数字' : null),
      },
      {
        header: 'classcode',
        aliases: ['班级编码', '班级'],
        required: false,
      },
      {
        header: 'scheduleddate',
        aliases: ['上课日期', '日期'],
        required: false,
        validate: (v) =>
          v && isNaN(Date.parse(v)) ? '日期格式错误（YYYY-MM-DD）' : null,
      },
      {
        header: 'reason',
        aliases: ['原因', '备注'],
        required: false,
      },
    ];

    const { report } = this.importService.validateRows(rows, columns, fileName);

    if (report.success === 0) {
      return report;
    }

    for (const detail of report.details) {
      if (!detail.success) continue;
      const row = detail.data;
      try {
        const studentCode = row['studentcode'];
        const status = this.parseAttendanceStatus(
          row['status'],
        ) as AttendanceStatus;
        const reason = row['reason'] || undefined;
        const lessonId = row['lessonid'] ? Number(row['lessonid']) : undefined;

        const student = await this.studentRepo.findOne({
          where: { studentCode, deleted: false },
        });
        if (!student) {
          throw new Error(`学员不存在: ${studentCode}`);
        }

        const lesson = await this.resolveLessonForImport(
          lessonId,
          row['classcode'],
          row['scheduleddate'],
        );

        const existing = await this.attendanceRepo.findByLessonAndStudent(
          lesson.id,
          studentCode,
        );
        if (
          existing &&
          existing.workflowState !== AttendanceWorkflowState.PENDING
        ) {
          throw new Error(
            `该学员此课时考勤已录入（${existing.workflowState}），不可覆盖`,
          );
        }

        if (!existing) {
          const entity = new LessonAttendanceEntity();
          entity.lessonId = lesson.id;
          entity.studentCode = studentCode;
          entity.classCode = lesson.classCode;
          entity.teacherId = lesson.teacherId;
          entity.workflowState = AttendanceWorkflowState.PENDING;
          entity.status = null;
          entity.operator = operatorId;
          entity.source = AttendanceSource.IMPORT;
          entity.createdBy = operatorId;
          await this.attendanceRepo.save(entity);
        }

        await this.recordAttendance({
          lessonId: lesson.id,
          studentCode,
          status,
          reason,
          operator: operatorId,
          source: AttendanceSource.IMPORT,
          note: `考勤导入${operatorName ? ` by ${operatorName}` : ''}`,
        });
      } catch (error) {
        report.success--;
        report.failure++;
        detail.success = false;
        detail.errors.push(`导入失败: ${(error as Error).message}`);
      }
    }

    return report;
  }

  // ─── Contract Lesson Deduction (Phase 2 Batch 2.1) ───

  /**
   * Resolve the subject for a lesson via class → course chain.
   * Returns null (and logs a warning) when the class or course cannot be found.
   */
  private async resolveLessonSubject(
    classCode: string,
  ): Promise<string | null> {
    const cls = await this.classRepo.findOne({ where: { classCode } });
    if (!cls) {
      this.logger.warn(`Cannot resolve subject: class ${classCode} not found.`);
      return null;
    }
    const course = await this.courseRepo.findOne({
      where: { courseCode: cls.courseCode },
    });
    if (!course) {
      this.logger.warn(
        `Cannot resolve subject: course ${cls.courseCode} not found for class ${classCode}.`,
      );
      return null;
    }
    return course.subject;
  }

  /**
   * 导入用课时定位：优先 lessonId；否则按班级编码 + 上课日期查找
   * （优先 TEACHING，其次 SCHEDULED）。无法定位 → 抛错由调用方记为行失败。
   */
  private async resolveLessonForImport(
    lessonId: number | undefined,
    classCode: string | undefined,
    scheduledDate: string | undefined,
  ): Promise<LessonEntity> {
    if (lessonId != null) {
      const lesson = await this.lessonRepo.findOneById(lessonId);
      if (!lesson) {
        throw new Error(`课时 ${lessonId} 不存在`);
      }
      return lesson;
    }

    if (!classCode || !scheduledDate) {
      throw new Error('缺少课时定位信息：请提供 课时ID 或 班级编码+上课日期');
    }

    const lessons = await this.lessonRepo.findByClassCodeAndDate(
      classCode,
      scheduledDate,
    );
    const lesson =
      lessons.find((l) => l.status === LessonStatus.TEACHING) ||
      lessons.find((l) => l.status === LessonStatus.SCHEDULED) ||
      lessons[0] ||
      null;
    if (!lesson) {
      throw new Error(`未找到班级 ${classCode} 在 ${scheduledDate} 的课时`);
    }
    return lesson;
  }

  /** 出勤状态：接受枚举值（大小写不敏感）或中文别名 */
  private parseAttendanceStatus(value: string): AttendanceStatus | null {
    const trimmed = value.trim();
    const upper = trimmed.toUpperCase();
    if (upper in AttendanceStatus) {
      return AttendanceStatus[upper as keyof typeof AttendanceStatus];
    }
    const aliases: Record<string, AttendanceStatus> = {
      出勤: AttendanceStatus.PRESENT,
      到场: AttendanceStatus.PRESENT,
      正常: AttendanceStatus.PRESENT,
      缺勤: AttendanceStatus.ABSENT,
      未到: AttendanceStatus.ABSENT,
      迟到: AttendanceStatus.LATE,
      请假: AttendanceStatus.LEAVE,
      生病: AttendanceStatus.SICK,
      病假: AttendanceStatus.SICK,
      补课: AttendanceStatus.MAKEUP,
      线上: AttendanceStatus.ONLINE,
      线下: AttendanceStatus.OFFLINE,
    };
    return aliases[trimmed] ?? null;
  }

  /**
   * Deduct one lesson from the student's active contract.
   * Called when attendance is recorded with a deductible status
   * (PRESENT, LATE, ONLINE, OFFLINE).
   *
   * Business rules:
   * - Only ACTIVE contracts are deducted
   * - If remainingLessons reaches 0, contract status → EXHAUSTED
   * - If no active contract found, log warning and skip
   * - If remainingLessons already 0, log warning and skip
   */
  private async deductLessonFromContract(
    studentCode: string,
    subject: string,
  ): Promise<LessonDeductionResult | null> {
    // 1. Find active contract for student + subject
    const contract = await this.contractRepo.findActiveByStudentCodeAndSubject(
      studentCode,
      subject,
    );

    if (!contract) {
      this.logger.warn(
        `No active contract found for student ${studentCode} and subject ${subject}. Skipping lesson deduction.`,
      );
      return null;
    }

    // 2. Guard: no remaining lessons
    if (contract.remainingLessons <= 0) {
      this.logger.warn(
        `Contract ${contract.contractCode} for student ${studentCode} has 0 remaining lessons. Skipping deduction.`,
      );
      return null;
    }

    // 3. Deduct
    const previousRemaining = contract.remainingLessons;
    contract.remainingLessons -= 1;

    // 4. Auto-transition to EXHAUSTED if all lessons consumed
    if (contract.remainingLessons === 0) {
      contract.status = ContractStatus.EXHAUSTED;
      this.logger.log(
        `Contract ${contract.contractCode} auto-transitioned to EXHAUSTED (all lessons consumed).`,
      );
    }

    // 5. Save
    await this.contractRepo.save(contract);

    this.logger.log(
      `Lesson deducted: student=${studentCode}, contract=${contract.contractCode}, ` +
        `remaining=${previousRemaining} → ${contract.remainingLessons}`,
    );

    return {
      contractId: contract.id,
      studentCode,
      contractCode: contract.contractCode,
      previousRemaining,
      newRemaining: contract.remainingLessons,
      statusChanged: contract.remainingLessons === 0,
    };
  }

  // ─── Confirmation ───

  /**
   * Confirm all attendance records for a lesson. CHECKED_IN → CONFIRMED.
   * Only confirms records that are in CHECKED_IN state.
   */
  async confirmAll(
    lessonId: number,
    confirmedBy: number,
  ): Promise<LessonAttendanceEntity[]> {
    const records = await this.attendanceRepo.findByLessonId(lessonId);
    const confirmed: LessonAttendanceEntity[] = [];

    for (const record of records) {
      if (record.workflowState === AttendanceWorkflowState.CHECKED_IN) {
        this.validateWorkflowTransition(
          record.workflowState,
          AttendanceWorkflowState.CONFIRMED,
        );
        record.workflowState = AttendanceWorkflowState.CONFIRMED;
        record.operator = confirmedBy;
        confirmed.push(record);
      }
    }

    return this.attendanceRepo.saveAll(confirmed);
  }

  // ─── Lock ───

  /**
   * Lock attendance records when Lesson → ARCHIVED. CONFIRMED → LOCKED.
   * ATTEND-004: LOCKED is terminal, cannot be modified.
   */
  async lockByLessonId(lessonId: number): Promise<void> {
    const records = await this.attendanceRepo.findByLessonId(lessonId);
    const toLock: LessonAttendanceEntity[] = [];

    for (const record of records) {
      if (record.workflowState === AttendanceWorkflowState.CONFIRMED) {
        this.validateWorkflowTransition(
          record.workflowState,
          AttendanceWorkflowState.LOCKED,
        );
        record.workflowState = AttendanceWorkflowState.LOCKED;
        toLock.push(record);
      }
    }

    if (toLock.length > 0) {
      await this.attendanceRepo.saveAll(toLock);
      this.logger.log(
        `Locked ${toLock.length} attendance records for lesson ${lessonId}`,
      );
    }
  }

  // ─── Cancellation Rollback ───

  /**
   * Cancel all attendance records for a lesson and rollback contract deductions.
   * Called when Lesson → CANCELLED.
   *
   * Steps:
   * 1. Find all attendance records for the lesson
   * 2. For records with deductible status, rollback contract deduction (remainingLessons += 1)
   * 3. Delete all attendance records
   * 4. Return rollback results for audit
   */
  async cancelByLessonId(lessonId: number): Promise<{
    deletedCount: number;
    rollbackResults: LessonDeductionResult[];
  }> {
    // 1. Find all attendance records for the lesson
    const records = await this.attendanceRepo.findByLessonId(lessonId);

    if (records.length === 0) {
      this.logger.log(`No attendance records to cancel for lesson ${lessonId}`);
      return { deletedCount: 0, rollbackResults: [] };
    }

    // 2. Rollback contract deductions for deductible statuses
    const rollbackResults: LessonDeductionResult[] = [];

    const subject =
      records.length > 0
        ? await this.resolveLessonSubject(records[0].classCode)
        : null;
    for (const record of records) {
      // Rollback needs either a ledger contract (deductedContractId — exact
      // restore, no subject required) or a resolvable subject (legacy fallback).
      // A null subject must not silently skip rollback when the ledger exists.
      if (
        record.status &&
        DEDUCTIBLE_STATUSES.has(record.status) &&
        (record.deductedContractId || subject)
      ) {
        const result = await this.rollbackLessonDeduction(record, subject);
        if (result) {
          rollbackResults.push(result);
        }
      }
    }

    // 3. Delete all attendance records for this lesson
    await this.attendanceRepo.deleteByLessonId(lessonId);

    this.logger.log(
      `Cancelled attendance for lesson ${lessonId}: ` +
        `deleted=${records.length}, rollbacks=${rollbackResults.length}`,
    );

    return { deletedCount: records.length, rollbackResults };
  }

  /**
   * Rollback a single lesson deduction. Restores the EXACT contract recorded
   * on the attendance row (deductedContractId) when available; otherwise falls
   * back to a subject-based restore (legacy rows). Never revives contracts in
   * EXPIRED/REFUNDED/FROZEN state.
   */
  private async rollbackLessonDeduction(
    record: LessonAttendanceEntity,
    subject: string | null,
  ): Promise<LessonDeductionResult | null> {
    // 1. Exact-contract restore via ledger (ACTIVE / EXHAUSTED only)
    let contract: ContractEntity | null = null;
    if (record.deductedContractId) {
      const ledgerContract = await this.contractRepo.findOneById(
        record.deductedContractId,
      );
      if (
        ledgerContract &&
        ledgerContract.studentCode === record.studentCode &&
        (ledgerContract.status === ContractStatus.ACTIVE ||
          ledgerContract.status === ContractStatus.EXHAUSTED)
      ) {
        contract = ledgerContract;
      }
    }

    // 2. Fallback: legacy rows / invalid ledger → subject-based restore.
    //    Requires a resolvable subject; a null subject means the exact contract
    //    cannot be identified, so nothing can be restored here.
    if (!contract && subject) {
      contract = await this.contractRepo.findActiveByStudentCodeAndSubject(
        record.studentCode,
        subject,
      );
    }

    if (!contract && subject) {
      // Try EXHAUSTED contract of the same subject (all lessons consumed, needs restoration)
      const allContracts = await this.contractRepo.findByStudentCode(
        record.studentCode,
      );
      contract =
        allContracts
          .filter(
            (c) =>
              c.subject === subject && c.status === ContractStatus.EXHAUSTED,
          )
          .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
    }

    if (!contract) {
      this.logger.warn(
        `No active/exhausted contract found for student ${record.studentCode}. Skipping rollback.`,
      );
      return null;
    }

    // Rollback: increment remainingLessons
    const previousRemaining = contract.remainingLessons;
    contract.remainingLessons += 1;

    // If contract was EXHAUSTED, restore to ACTIVE
    if (contract.status === ContractStatus.EXHAUSTED) {
      contract.status = ContractStatus.ACTIVE;
      this.logger.log(
        `Contract ${contract.contractCode} restored from EXHAUSTED to ACTIVE (rollback).`,
      );
    }

    await this.contractRepo.save(contract);

    this.logger.log(
      `Lesson rollback: student=${record.studentCode}, contract=${contract.contractCode}, ` +
        `remaining=${previousRemaining} → ${contract.remainingLessons}`,
    );

    return {
      contractId: contract.id,
      studentCode: record.studentCode,
      contractCode: contract.contractCode,
      previousRemaining,
      newRemaining: contract.remainingLessons,
      statusChanged:
        contract.status === ContractStatus.ACTIVE && previousRemaining === 0,
    };
  }

  // ─── Queries ───

  async findByLessonId(lessonId: number): Promise<LessonAttendanceEntity[]> {
    return this.attendanceRepo.findByLessonId(lessonId);
  }

  async findByStudentCode(
    studentCode: string,
  ): Promise<LessonAttendanceEntity[]> {
    return this.attendanceRepo.findByStudentCode(studentCode);
  }

  async countPendingByLessonId(lessonId: number): Promise<number> {
    return this.attendanceRepo.countPendingByLessonId(lessonId);
  }

  // ─── Private Helpers ───

  private validateWorkflowTransition(
    currentState: AttendanceWorkflowState,
    targetState: AttendanceWorkflowState,
  ): void {
    const allowed = VALID_WORKFLOW_TRANSITIONS[currentState];
    if (!allowed || !allowed.includes(targetState)) {
      throw new BadRequestException(
        `Invalid workflow transition: ${currentState} → ${targetState}`,
      );
    }
  }

  private async createAttendanceReminders(
    teacherId: number,
    lessonId: number,
    classCode: string,
  ): Promise<void> {
    try {
      await this.reminderService.createReminder({
        type: ReminderType.ATTENDANCE_REMINDER,
        targetType: TargetType.TEACHER,
        targetUserId: teacherId,
        title: `待确认出勤 — ${classCode}`,
        content: `课程 ${lessonId} 的出勤已记录，请及时确认。`,
        relatedEntityId: lessonId,
        relatedEntityType: 'LESSON',
      });
    } catch (err) {
      this.logger.warn(
        `Failed to create attendance reminder: ${(err as Error).message}`,
      );
    }
  }
}
