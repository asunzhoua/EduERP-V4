/**
 * Canonical TeacherRole enum — shared across Class and TeacherAssignment modules.
 *
 * Single source of truth. All modules import from this file.
 */
export enum TeacherRole {
  PRIMARY = 'PRIMARY',
  SUBSTITUTE = 'SUBSTITUTE',
  ASSISTANT = 'ASSISTANT',
}
