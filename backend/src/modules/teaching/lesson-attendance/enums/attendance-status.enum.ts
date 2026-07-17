/**
 * Attendance status — what happened to the student during the lesson.
 *
 * This is the DATA dimension. Do not confuse with WorkflowState
 * which is the LIFECYCLE dimension.
 *
 * Financial implication:
 *   PRESENT, LATE, ONLINE, OFFLINE → deduct from Contract
 *   ABSENT, LEAVE, MAKEUP → no deduction
 */
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  LEAVE = 'LEAVE',
  MAKEUP = 'MAKEUP',
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

/** Statuses that trigger contract deduction (Finance Domain reads this). */
export const DEDUCTIBLE_STATUSES: ReadonlySet<AttendanceStatus> = new Set([
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.ONLINE,
  AttendanceStatus.OFFLINE,
]);
