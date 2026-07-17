/**
 * Canonical EnrollmentStatus enum — shared across Class and Enrollment modules.
 *
 * Single source of truth. All modules import from this file.
 */
export enum EnrollmentStatus {
  ACTIVE = 'ACTIVE',
  WITHDRAWN = 'WITHDRAWN',
  COMPLETED = 'COMPLETED',
}
