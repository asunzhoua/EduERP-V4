import * as fs from 'fs';
import * as path from 'path';
import { REPORTS_DIR } from './paths';

// ── Types ──

export type CheckSeverity = 'PASS' | 'FAIL' | 'WARNING';

export interface CheckResult {
  id: string;
  description: string;
  severity: CheckSeverity;
  details?: string;
}

export interface GovernanceReport {
  timestamp: string;
  scriptName: string;
  results: CheckResult[];
  summary: { pass: number; fail: number; warn: number };
}

// ── Helpers ──

export function buildReport(
  scriptName: string,
  results: CheckResult[],
): GovernanceReport {
  return {
    timestamp: new Date().toISOString(),
    scriptName,
    results,
    summary: {
      pass: results.filter((r) => r.severity === 'PASS').length,
      fail: results.filter((r) => r.severity === 'FAIL').length,
      warn: results.filter((r) => r.severity === 'WARNING').length,
    },
  };
}

export function getExitCode(report: GovernanceReport): number {
  return report.summary.fail > 0 ? 1 : 0;
}

// ── Writers ──

export function writeJSONReport(name: string, report: GovernanceReport): string {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filePath = path.join(REPORTS_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  return filePath;
}

export function writeMDReport(name: string, report: GovernanceReport): string {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const filePath = path.join(REPORTS_DIR, `${name}.md`);
  const lines: string[] = [];

  lines.push(`# ${report.scriptName}`);
  lines.push('');
  lines.push(`> **Generated**: ${report.timestamp}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|------:|`);
  lines.push(`| PASS     | ${report.summary.pass} |`);
  lines.push(`| FAIL     | ${report.summary.fail} |`);
  lines.push(`| WARNING  | ${report.summary.warn} |`);
  lines.push('');

  const overall =
    report.summary.fail > 0
      ? '**Result: FAIL**'
      : report.summary.warn > 0
        ? '**Result: PASS (with warnings)**'
        : '**Result: PASS**';
  lines.push(overall);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Details');
  lines.push('');

  for (const r of report.results) {
    const icon = r.severity === 'PASS' ? '✅' : r.severity === 'FAIL' ? '❌' : '⚠️';
    lines.push(`### ${icon} ${r.id}: ${r.description}`);
    lines.push('');
    lines.push(`- **Severity**: ${r.severity}`);
    if (r.details) {
      lines.push(`- **Details**: ${r.details}`);
    }
    lines.push('');
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}
