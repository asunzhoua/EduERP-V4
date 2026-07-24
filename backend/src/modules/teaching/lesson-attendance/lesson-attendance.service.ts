import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { LessonAttendanceRepository } from './lesson-attendance.repository';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import { AttendanceStatus, DEDUCTIBLE_STATUSES } from './enums/attendance-status.enum';
import { AttendanceWorkflowState } from './enums/attendance-workflow-state.enum';
import { AttendanceSource } from './enums/attendance-source.enum';
import { ReminderService } from '@modules/reminder/reminder.service';
import { ReminderType } from '@modules/reminder/enums/reminder-type.enum';
import { TargetType } from '@modules/reminder/enums/target-type.enum';
import { ContractRepository } from '@modules/teaching/contract/contract.repository';
import { ContractStatus } from '@modules/teaching/contract/enums/contract-status.enum';

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
      throw new BadRequestException(
        `Status ${input.status} requires a reason`,
      );
    }

    // ─── Track if this is first check-in (for deduction) ───
    const isFirstCheckIn = entity.workflowState === AttendanceWorkflowState.PENDING;

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

    // ─── PHASE 2: Contract lesson deduction (only on first check-in) ───
    if (isFirstCheckIn && DEDUCTIBLE_STATUSES.has(input.status)) {
      await this.deductLessonFromContract(input.studentCode).catch(err =>
        this.logger.warn(`Lesson deduction failed for student ${input.studentCode}: ${err.message}`),
      );
    }

    // ─── Create attendance reminder for teacher ───
    this.createAttendanceReminders(entity.teacherId, entity.lessonId, entity.classCode).catch(err =>
      this.logger.warn(`Failed to create attendance reminder: ${err.message}`),
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
  async batchRollCall(input: BatchRollCallInput): Promise<LessonAttendanceEntity[]> {
    // 1. Batch query existing records
    const studentCodes = input.records.map(r => r.studentCode);
    const existingRecords = await this.attendanceRepo.findByLessonIdAndStudentCodes(
      input.lessonId,
      studentCodes,
    );
    const existingMap = new Map(existingRecords.map(r => [r.studentCode, r]));

    const results: LessonAttendanceEntity[] = [];
    const studentsToDeduct: string[] = [];

    for (const recordInput of input.records) {
      const entity = existingMap.get(recordInput.studentCode);
      if (!entity) {
        throw new NotFoundException(
          `Attendance record not found for lesson=${input.lessonId}, student=${recordInput.studentCode}`,
        );
      }

      // Validate status enum
      if (!Object.values(AttendanceStatus).includes(recordInput.status)) {
        throw new BadRequestException(`Invalid attendance status: ${recordInput.status}`);
      }

      // Validate workflow state — must be PENDING
      if (entity.workflowState !== AttendanceWorkflowState.PENDING) {
        throw new BadRequestException(
          `Cannot record attendance for student ${recordInput.studentCode}: current state is ${entity.workflowState}, expected PENDING`,
        );
      }

      // Validate reason requirement
      if (REASON_REQUIRED_STATUSES.has(recordInput.status) && !recordInput.reason?.trim()) {
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

      // Track students needing deduction
      if (DEDUCTIBLE_STATUSES.has(recordInput.status)) {
        studentsToDeduct.push(recordInput.studentCode);
      }

      results.push(entity);
    }

    this.logger.log(
      `Batch roll call completed: lesson=${input.lessonId}, count=${results.length}`,
    );

    const saved = await this.attendanceRepo.saveAll(results);

    // ─── PHASE 2: Contract lesson deduction for all deductible students ───
    for (const studentCode of studentsToDeduct) {
      await this.deductLessonFromContract(studentCode).catch(err =>
        this.logger.warn(`Lesson deduction failed for student ${studentCode}: ${err.message}`),
      );
    }

    // ─── Create attendance reminder for teacher ───
    if (results.length > 0) {
      this.createAttendanceReminders(results[0].teacherId, input.lessonId, results[0].classCode).catch(err =>
        this.logger.warn(`Failed to create attendance reminder: ${err.message}`),
      );
    }

    return saved;
  }

  // ─── Contract Lesson Deduction (Phase 2 Batch 2.1) ───

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
  ): Promise<LessonDeductionResult | null> {
    // 1. Find active contract for student
    const contract = await this.contractRepo.findOneActiveByStudentCode(studentCode);

    if (!contract) {
      this.logger.warn(
        `No active contract found for student ${studentCode}. Skipping lesson deduction.`,
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
      this.logger.log(`Locked ${toLock.length} attendance records for lesson ${lessonId}`);
    }
  }

  // ─── Queries ───

  async findByLessonId(lessonId: number): Promise<LessonAttendanceEntity[]> {
    return this.attendanceRepo.findByLessonId(lessonId);
  }

  async findByStudentCode(studentCode: string): Promise<LessonAttendanceEntity[]> {
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
      this.logger.warn(`Failed to create attendance reminder: ${err.message}`);
    }
  }
}
