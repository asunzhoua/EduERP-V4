/**
 * Canonical Subject enum — shared across Course, Contract, and Enrollment modules.
 *
 * Single source of truth. All modules import from this file.
 */
export enum Subject {
  MATH = 'MATH',
  ENGLISH = 'ENGLISH',
  CHINESE = 'CHINESE',
  PHYSICS = 'PHYSICS',
  CHEMISTRY = 'CHEMISTRY',
  ART = 'ART',
  MUSIC = 'MUSIC',
  DANCE = 'DANCE',
  SPORTS = 'SPORTS',
  CODING = 'CODING',
  OTHER = 'OTHER',
}
