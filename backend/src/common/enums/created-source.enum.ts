/**
 * Canonical CreatedSource enum — shared across Student and Course modules.
 *
 * Single source of truth. All modules import from this file.
 */
export enum CreatedSource {
  ADMIN = 'ADMIN',
  IMPORT = 'IMPORT',
  API = 'API',
}
