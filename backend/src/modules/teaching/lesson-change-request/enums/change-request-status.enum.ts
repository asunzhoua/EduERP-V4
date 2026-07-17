/**
 * Lesson change request lifecycle status.
 *
 * Flow: PENDING → APPROVED → EXECUTED
 *       PENDING → REJECTED
 *       APPROVED → REJECTED (before execution)
 *
 * REJECTED and EXECUTED are terminal states.
 */
export enum ChangeRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
}
