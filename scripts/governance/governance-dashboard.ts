/**
 * WP6 (P2): Governance Dashboard — Unified Runner
 *
 * Aggregates all validators into a single report.
 * This is the `governance:check` entry point.
 *
 * Output: reports/GovernanceReport.json + reports/GovernanceReport.md
 */

import * as fs from 'fs';
import { buildReport, writeJSONReport, writeMDReport, getExitCode } from './shared/report';
import { REPORTS_DIR } from './shared/paths';
import { runFreezeAudit } from './freeze-audit';
import { runEventValidation } from './validate-events';
import { runStateMachineValidation } from './validate-state-machine';
import { runHandbookValidation } from './build-handbook';
import { runADRIndex } from './build-adr-index';

// ── Aggregation ──

export function runGovernanceDashboard(): ReturnType<typeof buildReport> {
  console.log('Running governance checks...\n');

  const subReports = [
    { name: 'FreezeAudit', fn: runFreezeAudit },
    { name: 'EventValidation', fn: runEventValidation },
    { name: 'StateMachineValidation', fn: runStateMachineValidation },
    { name: 'HandbookValidation', fn: runHandbookValidation },
    { name: 'ADRIndex', fn: runADRIndex },
  ];

  const allResults: ReturnType<typeof buildReport>['results'] = [];

  for (const sub of subReports) {
    console.log(`  Running ${sub.name}...`);
    try {
      const subReport = sub.fn();
      // Prefix results with sub-report name for traceability
      for (const result of subReport.results) {
        allResults.push({
          ...result,
          id: `${sub.name}/${result.id}`,
          description: `[${sub.name}] ${result.description}`,
        });
      }
    } catch (err) {
      allResults.push({
        id: `${sub.name}/ERROR`,
        description: `[${sub.name}] Script execution failed`,
        severity: 'FAIL',
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Build aggregated report
  const report = buildReport('GovernanceDashboard', allResults);

  // Write outputs
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  writeJSONReport('GovernanceReport', report);
  writeMDReport('GovernanceReport', report);

  console.log(`\nGovernance Report: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${report.summary.warn} WARN`);
  console.log(`Reports written to: ${REPORTS_DIR}`);

  return report;
}

// ── CLI Entry Point ──

if (require.main === module) {
  const report = runGovernanceDashboard();
  process.exit(getExitCode(report));
}
