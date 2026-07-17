import { Injectable, NotImplementedException, Logger } from '@nestjs/common';
import { LessonChangeRequestRepository } from './lesson-change-request.repository';
import { LessonChangeRequestEntity } from './lesson-change-request.entity';
import { ChangeRequestType } from '@common/enums/change-request-type.enum';
import { ChangeRequestStatus } from './enums/change-request-status.enum';

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

  constructor(private readonly requestRepo: LessonChangeRequestRepository) {}

  // ─── Create Request (Skeleton) ───

  /** Submit a new change request. Status = PENDING. */
  createRequest(
    _input: CreateChangeRequestInput,
  ): Promise<LessonChangeRequestEntity> {
    throw new NotImplementedException();
  }

  // ─── Approve (Skeleton) ───

  /** Admin approves a PENDING request. PENDING → APPROVED. */
  approve(
    _requestId: number,
    _approvedBy: number,
  ): Promise<LessonChangeRequestEntity> {
    throw new NotImplementedException();
  }

  // ─── Reject (Skeleton) ───

  /** Admin rejects a PENDING or APPROVED request. → REJECTED (terminal). */
  reject(
    _requestId: number,
    _rejectedBy: number,
    _reason: string,
  ): Promise<LessonChangeRequestEntity> {
    throw new NotImplementedException();
  }

  // ─── Execute (Skeleton) ───

  /** System executes an APPROVED request. APPROVED → EXECUTED (terminal). */
  execute(_requestId: number): Promise<LessonChangeRequestEntity> {
    throw new NotImplementedException();
  }

  // ─── Read (Skeleton) ───

  findOne(_id: number): Promise<LessonChangeRequestEntity> {
    throw new NotImplementedException();
  }

  findByLessonId(_lessonId: number): Promise<LessonChangeRequestEntity[]> {
    throw new NotImplementedException();
  }

  /** Check if a lesson has exceeded the max reschedule limit (3). */
  hasExceededRescheduleLimit(_lessonId: number): Promise<boolean> {
    throw new NotImplementedException();
  }
}
