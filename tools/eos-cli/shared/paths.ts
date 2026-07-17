/**
 * Shared path constants for eos CLI.
 */
import * as path from 'path';

export const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
export const BACKEND_DIR = path.join(PROJECT_ROOT, 'backend');
export const BACKEND_SRC = path.join(BACKEND_DIR, 'src');
export const DOCS_DIR = path.join(PROJECT_ROOT, 'docs');
export const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');
export const AUDIT_DIR = path.join(PROJECT_ROOT, '.audit');
export const SCRIPTS_DIR = path.join(PROJECT_ROOT, 'scripts');
export const TOOLS_DIR = path.join(PROJECT_ROOT, 'tools');

// Governance scripts
export const GOVERNANCE_DIR = path.join(SCRIPTS_DIR, 'governance');
