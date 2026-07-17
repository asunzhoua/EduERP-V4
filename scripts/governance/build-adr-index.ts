/**
 * WP5 (P2): ADR Index Builder
 *
 * Scans ADR/DEC files, extracts metadata, generates index.
 *
 * Output: reports/ADRIndex.json + reports/ADRIndex.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseADRMetadata } from './shared/markdown-parser';
import {
  DECISION_LOG_DIR,
  REPORTS_DIR,
} from './shared/paths';
import { buildReport, writeJSONReport, writeMDReport, getExitCode } from './shared/report';
import type { CheckResult } from './shared/report';

// ── File Discovery ──

function findADRFiles(): string[] {
  if (!fs.existsSync(DECISION_LOG_DIR)) return [];
  return fs
    .readdirSync(DECISION_LOG_DIR)
    .filter((f) => /^(ADR|DEC)-\d+/.test(f))
    .sort()
    .map((f) => path.join(DECISION_LOG_DIR, f));
}

// ── Valid Statuses ──

const VALID_STATUSES = new Set(['PROPOSED', 'ACCEPTED', 'DEPRECATED', 'SUPERSEDED']);

// ── Checks ──

export function runADRIndex(): ReturnType<typeof buildReport> {
  const results: CheckResult[] = [];

  const adrFiles = findADRFiles();
  const metadata = adrFiles.map((f) => {
    const content = fs.readFileSync(f, 'utf-8');
    return parseADRMetadata(content, path.basename(f));
  });

  // WP5.1: All ADR files have required metadata
  const missingMeta = metadata.filter((m) => !m.status || !m.date);
  results.push({
    id: 'WP5.1',
    description: 'All ADR/DEC files have required metadata (Status, Date)',
    severity: missingMeta.length === 0 ? 'PASS' : 'FAIL',
    details:
      missingMeta.length > 0
        ? `Missing metadata: ${missingMeta.map((m) => m.id).join(', ')}`
        : `All ${metadata.length} files have required metadata`,
  });

  // WP5.2: No duplicate ADR IDs
  const ids = metadata.map((m) => m.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  const uniqueDuplicates = [...new Set(duplicates)];
  results.push({
    id: 'WP5.2',
    description: 'No duplicate ADR/DEC IDs',
    severity: uniqueDuplicates.length === 0 ? 'PASS' : 'FAIL',
    details:
      uniqueDuplicates.length > 0
        ? `Duplicates: ${uniqueDuplicates.join(', ')}`
        : `All ${ids.length} IDs are unique`,
  });

  // WP5.3: Status value is valid
  const invalidStatuses = metadata.filter(
    (m) => m.status && !VALID_STATUSES.has(m.status.toUpperCase()),
  );
  results.push({
    id: 'WP5.3',
    description: 'Status value is valid (PROPOSED, ACCEPTED, DEPRECATED, SUPERSEDED)',
    severity: invalidStatuses.length === 0 ? 'PASS' : 'FAIL',
    details:
      invalidStatuses.length > 0
        ? `Invalid statuses: ${invalidStatuses.map((m) => `${m.id}="${m.status}"`).join(', ')}`
        : `All ${metadata.length} statuses are valid`,
  });

  // Build report
  const report = buildReport('ADRIndex', results);

  // Write outputs
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  writeJSONReport('ADRIndex', report);
  writeMDReport('ADRIndex', report);

  return report;
}

// ── CLI Entry Point ──

if (require.main === module) {
  const report = runADRIndex();
  console.log(
    `\nADR Index: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${report.summary.warn} WARN`,
  );
  process.exit(getExitCode(report));
}
