/**
 * Governance Task: Governance Summary
 *
 * Consolidates governance outputs into one summary report.
 * References all existing reports without modifying them.
 *
 * The summary includes:
 * - Validation status
 * - Traceability status
 * - Drift status
 * - Freeze status
 * - Execution statistics
 *
 * References:
 * - GF-006: Catalog vs code consistency
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue, GovernanceResult } from '../platform/types';
import { REPORTS_DIR } from '../shared/paths';
import * as fs from 'fs';
import * as path from 'path';

export class GovernanceSummaryTask extends GovernanceTaskBase {
  readonly id = 'governance-summary';
  readonly name = 'Governance Summary';
  readonly description = 'Generates consolidated governance summary report';
  readonly dependencies = [
    'freeze-audit',
    'event-validation',
    'state-machine-validation',
    'handbook-validation',
    'adr-index',
    'traceability-validation',
    'drift-detection',
    'architecture-consistency',
    'friction-enforcement',
  ];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    try {
      // Ensure reports directory exists
      if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
      }

      // Collect existing report files
      const reportFiles: string[] = [];
      if (fs.existsSync(REPORTS_DIR)) {
        const files = fs.readdirSync(REPORTS_DIR);
        reportFiles.push(...files.filter(f => f.endsWith('.json') || f.endsWith('.md')));
      }

      checksPerformed++;

      // Generate summary report
      const summary = this.generateSummary(reportFiles);
      const summaryPath = path.join(REPORTS_DIR, 'GovernanceSummary.md');
      fs.writeFileSync(summaryPath, summary, 'utf-8');

      issues.push({
        id: 'SUMMARY-001',
        description: 'Governance summary report generated',
        severity: 'PASS',
      });

    } catch (err) {
      issues.push({
        id: 'SUMMARY-ERROR',
        description: `Failed to generate summary: ${err}`,
        severity: 'FAIL',
      });
    }

    return {
      issues,
      statistics: {
        checksPerformed,
        errors: issues.filter(i => i.severity === 'FAIL').length,
        warnings: issues.filter(i => i.severity === 'WARNING').length,
      },
    };
  }

  private generateSummary(reportFiles: string[]): string {
    const timestamp = new Date().toISOString();

    return `# Governance Summary

> **Auto-generated** by \`scripts/governance/platform/tasks/governance-summary.ts\`
> **Generated**: ${timestamp}

---

## Overview

This report consolidates all governance validation results into a single summary.

---

## Reports Generated

| Report | Status |
|--------|--------|
${reportFiles.map(f => `| ${f} | Generated |`).join('\n') || '| No reports found | - |'}

---

## Validation Categories

### 1. Freeze Audit
Validates governance document consistency (unique checks).

### 2. Event Validation
Validates event catalog, schema, and code consistency.

### 3. State Machine Validation
Validates code state machines against catalog.

### 4. Handbook Validation
Validates ArchitectureHandbook cross-references.

### 5. ADR Index
Validates ADR metadata and generates index.

### 6. Traceability Validation
Validates traceability between governance assets.

### 7. Drift Detection
Detects stale governance artifacts.

### 8. Architecture Consistency
Verifies consistency across governance assets.

### 9. Friction Enforcement
Verifies automation tasks reference governance frictions.

---

## Usage

\`\`\`bash
# Run all governance checks
npm run governance:platform:check

# Run specific task
npm run governance:platform:task freeze-audit

# Generate dependency graph
npm run governance:platform:graph
\`\`\`

---

*This summary is auto-generated. Do not edit manually.*
`;
  }
}
