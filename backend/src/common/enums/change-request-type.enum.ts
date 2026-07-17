/**
 * Canonical ChangeRequestType enum — shared across Lesson and LessonChangeRequest modules.
 *
 * Single source of truth. All modules import from this file.
 */
export enum ChangeRequestType {
  RESCHEDULE = 'RESCHEDULE',
  TEACHER_CHANGE = 'TEACHER_CHANGE',
  CANCEL = 'CANCEL',
  REOPEN = 'REOPEN',
}
