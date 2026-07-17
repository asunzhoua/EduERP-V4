/**
 * Canonical AuditAction enum — shared across Student and Course modules.
 *
 * Includes MERGE from Student domain (superset of Course values).
 * Single source of truth. All modules import from this file.
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  DELETE = 'DELETE',
  MERGE = 'MERGE',
}
