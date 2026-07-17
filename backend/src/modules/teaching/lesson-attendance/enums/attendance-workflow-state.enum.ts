/**
 * Attendance workflow state — the lifecycle process of recording attendance.
 *
 * This is the LIFECYCLE dimension. Do not confuse with AttendanceStatus
 * which is the DATA dimension.
 *
 * Flow: PENDING → CHECKED_IN → CONFIRMED → LOCKED
 */
export enum AttendanceWorkflowState {
  PENDING = 'PENDING',
  CHECKED_IN = 'CHECKED_IN',
  CONFIRMED = 'CONFIRMED',
  LOCKED = 'LOCKED',
}
