/**
 * Governance Task: ADR Index
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import { parseADRMetadata } from '../shared/markdown-parser';
import { DECISION_LOG_DIR, findFilesRecursive } from '../shared/paths';
import * as fs from 'fs';

export class ADRIndexTask extends GovernanceTaskBase {
  readonly id = 'adr-index';
  readonly name = 'ADR Index';
  readonly description = 'Validates ADR metadata and generates index';
  readonly dependencies = ['freeze-audit'];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;
    let adrCount = 0;

    try {
      const adrFiles = findFilesRecursive(DECISION_LOG_DIR, /ADR-.*\.md$/);
      const decFiles = findFilesRecursive(DECISION_LOG_DIR, /DEC-.*\.md$/);
      const allFiles = [...adrFiles, ...decFiles];
      adrCount = allFiles.length;

      // WP5.1: All ADR files have required metadata
      for (const file of allFiles) {
        checksPerformed++;
        const content = fs.readFileSync(file, 'utf-8');
        const metadata = parseADRMetadata(content, file);
        if (!metadata.status) {
          issues.push({
            id: 'ADR-001',
            description: `ADR file missing status: ${file}`,
            severity: 'FAIL',
          });
        }
        if (!metadata.date) {
          issues.push({
            id: 'ADR-001',
            description: `ADR file missing date: ${file}`,
            severity: 'FAIL',
          });
        }
      }

      // WP5.2: No duplicate ADR IDs
      const ids = new Set<string>();
      for (const file of allFiles) {
        checksPerformed++;
        const match = file.match(/(ADR|DEC)-(\d+)/);
        if (match) {
          const id = match[0];
          if (ids.has(id)) {
            issues.push({
              id: 'ADR-002',
              description: `Duplicate ADR/DEC ID: ${id}`,
              severity: 'FAIL',
            });
          }
          ids.add(id);
        }
      }

      // WP5.3: Status value is valid
      const validStatuses = ['PROPOSED', 'ACCEPTED', 'DEPRECATED', 'SUPERSEDED'];
      for (const file of allFiles) {
        checksPerformed++;
        const content = fs.readFileSync(file, 'utf-8');
        const metadata = parseADRMetadata(content, file);
        if (metadata.status && !validStatuses.includes(metadata.status.toUpperCase())) {
          issues.push({
            id: 'ADR-003',
            description: `Invalid ADR status "${metadata.status}" in ${file}`,
            severity: 'WARNING',
          });
        }
      }

    } catch (err) {
      issues.push({
        id: 'ADR-ERROR',
        description: `ADR validation failed: ${err}`,
        severity: 'FAIL',
      });
    }

    return {
      issues,
      statistics: {
        checksPerformed,
        adrCount,
        errors: issues.filter(i => i.severity === 'FAIL').length,
        warnings: issues.filter(i => i.severity === 'WARNING').length,
      },
    };
  }
}
