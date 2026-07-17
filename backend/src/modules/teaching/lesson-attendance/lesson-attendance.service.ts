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
   */
  async batchRollCall(input: BatchRollCallInput): Promise<LessonAttendanceEntity[]> {
    const results: LessonAttendanceEntity[] = [];

    for (const record of input.records) {
      const entity = await this.recordAttendance(record);
      results.push(entity);
    }

    return results;
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
        const saved = await this.attendanceRepo.save(record);
        confirmed.push(saved);
      }
    }

    return confirmed;
  }

  // ─── Lock ───

  /**
   * Lock attendance records when Lesson → ARCHIVED. CONFIRMED → LOCKED.
   * ATTEND-004: LOCKED is terminal, cannot be modified.
   */
  async lockByLessonId(lessonId: number): Promise<void> {
    const records = await this.attendanceRepo.findByLessonId(lessonId);

    for (const record of records) {
      if (record.workflowState === AttendanceWorkflowState.CONFIRMED) {
        this.validateWorkflowTransition(
          record.workflowState,
          AttendanceWorkflowState.LOCKED,
        );
        record.workflowState = AttendanceWorkflowState.LOCKED;
        await this.attendanceRepo.save(record);
      }
    }
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

    for (const record of records) {
      if (record.workflowState === AttendanceWorkflowState.CONFIRMED) {
        this.validateWorkflowTransition(
          record.workflowState,
          AttendanceWorkflowState.CHECKED_IN,
        );
        record.workflowState = AttendanceWorkflowState.CHECKED_IN;
        record.operator = operatedBy;
        await this.attendanceRepo.save(record);
      }
    }
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
