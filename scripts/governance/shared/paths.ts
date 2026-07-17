import * as fs from 'fs';
import * as path from 'path';

/** Project root: EduERP-V4/ (3 levels up from scripts/governance/shared/) */
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

/** docs/ directory */
export const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');

/** backend/src/ directory */
export const BACKEND_SRC = path.join(PROJECT_ROOT, 'backend', 'src');

/** events/ source directory */
export const EVENTS_DIR = path.join(BACKEND_SRC, 'events');

/** modules/ source directory */
export const MODULES_DIR = path.join(BACKEND_SRC, 'modules');

/** reports/ output directory */
export const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');

// ── Specific document paths ──

export const EVENT_CATALOG = path.join(DOCS_DIR, 'EventCatalog', 'EventCatalog.md');
export const EVENT_SCHEMA = path.join(DOCS_DIR, 'EventCatalog', 'EventSchema.md');
export const SM_CATALOG = path.join(DOCS_DIR, 'StateMachine', 'StateMachineCatalog.md');
export const ARCH_HANDBOOK = path.join(DOCS_DIR, 'architecture', 'ArchitectureHandbook.md');
export const DECISION_LOG_DIR = path.join(DOCS_DIR, 'DecisionLog');
export const FRICTION_LOG = path.join(DOCS_DIR, 'governance', 'GovernanceFrictionLog.md');

// ── File Discovery ──

/**
 * Recursively find all files matching a pattern.
 * Skips node_modules and dist directories.
 * @param ext - File extension string (e.g. '.ts') or RegExp to match filenames against
 */
export function findFilesRecursive(dir: string, ext: string | RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        results.push(...findFilesRecursive(fullPath, ext));
      }
    } else if (ext instanceof RegExp ? ext.test(entry.name) : entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}
