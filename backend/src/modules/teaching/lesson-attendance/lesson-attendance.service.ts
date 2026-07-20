import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { LessonAttendanceRepository } from './lesson-attendance.repository';
import { LessonAttendanceEntity } from './lesson-attendance.entity';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { AttendanceWorkflowState } from './enums/attendance-workflow-state.enum';
import { AttendanceSource } from './enums/attendance-source.enum';

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

@Injectable()
export class LessonAttendanceService {
  private readonly logger = new Logger(LessonAttendanceService.name);

  constructor(private readonly attendanceRepo: LessonAttendanceRepository) {}

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

    return this.attendanceRepo.save(entity);
  }

  /**
   * Batch roll call — record attendance for all students at once.
   * Uses a single query + batch save to eliminate N+1 pattern.
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

      results.push(entity);
    }

    this.logger.log(
      `Batch roll call completed: lesson=${input.lessonId}, count=${results.length}`,
    );

    return this.attendanceRepo.saveAll(results);
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

    await this.attendanceRepo.saveAll(toLock);
  }

  // ─── Read ───

  async findOne(id: number): Promise<LessonAttendanceEntity> {
    const entity = await this.attendanceRepo.findOneById(id);
    if (!entity) {
      throw new NotFoundException(`Attendance record ${id} not found`);
    }
    return entity;
  }

  async findByLessonId(lessonId: number): Promise<LessonAttendanceEntity[]> {
    return this.attendanceRepo.findByLessonId(lessonId);
  }

  async findByStudentCode(studentCode: string): Promise<LessonAttendanceEntity[]> {
    return this.attendanceRepo.findByStudentCode(studentCode);
  }

  /**
   * Count attendance records not yet confirmed/locked for a lesson.
   */
  async countUnconfirmed(lessonId: number): Promise<number> {
    return this.attendanceRepo.countUnconfirmedByLessonId(lessonId);
  }

  // ─── Reverse Transition ───

  /**
   * Admin override: CONFIRMED → CHECKED_IN (re-open for correction).
   * Requires reason.
   */
  async reverseToCheckedIn(
    lessonId: number,
    reason: string,
    operatedBy: number,
  ): Promise<void> {
    if (!reason?.trim()) {
      throw new BadRequestException('Reason is required for reverse transition');
    }

    const records = await this.attendanceRepo.findByLessonId(lessonId);
    const toReverse: LessonAttendanceEntity[] = [];

    for (const record of records) {
      if (record.workflowState === AttendanceWorkflowState.CONFIRMED) {
        this.validateWorkflowTransition(
          record.workflowState,
          AttendanceWorkflowState.CHECKED_IN,
        );
        record.workflowState = AttendanceWorkflowState.CHECKED_IN;
        record.operator = operatedBy;
        toReverse.push(record);
      }
    }

    await this.attendanceRepo.saveAll(toReverse);
  }

  // ─── Internal Helpers ───

  private validateWorkflowTransition(
    from: AttendanceWorkflowState,
    to: AttendanceWorkflowState,
  ): void {
    const allowed = VALID_WORKFLOW_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid workflow transition: ${from} → ${to}`,
      );
    }
  }
}
