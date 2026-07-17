/**
 * Governance Task: Handbook Validation
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import { parseHandbookReferences } from '../shared/markdown-parser';
import { ARCH_HANDBOOK, DOCS_DIR, findFilesRecursive } from '../shared/paths';
import * as fs from 'fs';
import * as path from 'path';

export class HandbookValidationTask extends GovernanceTaskBase {
  readonly id = 'handbook-validation';
  readonly name = 'Handbook Validation';
  readonly description = 'Validates ArchitectureHandbook cross-references';
  readonly dependencies = ['freeze-audit'];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    try {
      const handbookContent = fs.readFileSync(ARCH_HANDBOOK, 'utf-8');
      const chapters = parseHandbookReferences(handbookContent);

      // WP4.1: All cross-references resolve
      for (const chapter of chapters) {
        for (const ref of chapter.references) {
          checksPerformed++;
          const fullPath = path.join(path.dirname(ARCH_HANDBOOK), ref);
          if (!fs.existsSync(fullPath)) {
            issues.push({
              id: 'HAND-001',
              description: `Handbook reference not found: ${ref}`,
              severity: 'FAIL',
            });
          }
        }
      }

      // WP4.4: Unreferenced docs (informational)
      const allDocs = findFilesRecursive(DOCS_DIR, '.md');
      const referencedPaths = new Set<string>();
      for (const chapter of chapters) {
        for (const ref of chapter.references) {
          referencedPaths.add(ref);
        }
      }

      let unreferenced = 0;
      for (const doc of allDocs) {
        const relativePath = path.relative(path.dirname(ARCH_HANDBOOK), doc);
        if (!referencedPaths.has(relativePath)) {
          unreferenced++;
        }
      }

      checksPerformed++;
      if (unreferenced > 0) {
        issues.push({
          id: 'HAND-004',
          description: `${unreferenced} documents not referenced in Handbook`,
          severity: 'PASS', // Informational
        });
      }

    } catch (err) {
      issues.push({
        id: 'HAND-ERROR',
        description: `Handbook validation failed: ${err}`,
        severity: 'FAIL',
      });
    }

    return {
      issues,
      statistics: {
        checksPerformed,
        references: checksPerformed,
        errors: issues.filter(i => i.severity === 'FAIL').length,
        warnings: issues.filter(i => i.severity === 'WARNING').length,
      },
    };
  }
}
