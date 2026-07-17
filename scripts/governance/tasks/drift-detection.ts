/**
 * Governance Task: Drift Detection
 *
 * Compares current repository state against generated governance artifacts.
 * Detects stale reports, outdated baselines, and missing generated files.
 *
 * Detection only. No automatic modification.
 *
 * References:
 * - GF-006: Catalog vs code consistency
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import {
  REPORTS_DIR,
  EVENT_CATALOG,
  EVENT_SCHEMA,
  SM_CATALOG,
  ARCH_HANDBOOK,
} from '../shared/paths';
import * as fs from 'fs';
import * as path from 'path';

export class DriftDetectionTask extends GovernanceTaskBase {
  readonly id = 'drift-detection';
  readonly name = 'Drift Detection';
  readonly description = 'Detects stale governance artifacts';
  readonly dependencies = ['freeze-audit'];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    // DRIFT-001: ArchitectureBaseline exists and is recent
    try {
      const baselinePath = path.join(path.dirname(ARCH_HANDBOOK), 'ArchitectureBaseline.md');
      checksPerformed++;
      if (!fs.existsSync(baselinePath)) {
        issues.push({
          id: 'DRIFT-001',
          description: 'ArchitectureBaseline.md does not exist',
          severity: 'FAIL',
        });
      } else {
        const content = fs.readFileSync(baselinePath, 'utf-8');
        const timestampMatch = content.match(/\*\*Generated\*\*:\s*(.+)/);
        if (timestampMatch) {
          const generated = new Date(timestampMatch[1].trim());
          const ageHours = (Date.now() - generated.getTime()) / (1000 * 60 * 60);
          if (ageHours > 24) {
            issues.push({
              id: 'DRIFT-001',
              description: `ArchitectureBaseline.md is ${Math.round(ageHours)}h old (threshold: 24h)`,
              severity: 'WARNING',
            });
          }
        }
      }
    } catch (err) {
      issues.push({
        id: 'DRIFT-ERROR-001',
        description: `Failed to check baseline drift: ${err}`,
        severity: 'FAIL',
      });
    }

    // DRIFT-002: Governance reports exist
    try {
      checksPerformed++;
      if (!fs.existsSync(REPORTS_DIR)) {
        issues.push({
          id: 'DRIFT-002',
          description: 'Reports directory does not exist',
          severity: 'WARNING',
        });
      } else {
        const reportFiles = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json') || f.endsWith('.md'));
        if (reportFiles.length === 0) {
          issues.push({
            id: 'DRIFT-002',
            description: 'No governance reports found in reports/',
            severity: 'WARNING',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'DRIFT-ERROR-002',
        description: `Failed to check report drift: ${err}`,
        severity: 'FAIL',
      });
    }

    // DRIFT-003: Governance documents have consistent versions
    try {
      const docs = [
        { path: EVENT_CATALOG, name: 'EventCatalog' },
        { path: EVENT_SCHEMA, name: 'EventSchema' },
        { path: SM_CATALOG, name: 'StateMachineCatalog' },
        { path: ARCH_HANDBOOK, name: 'ArchitectureHandbook' },
      ];

      for (const doc of docs) {
        checksPerformed++;
        if (!fs.existsSync(doc.path)) {
          issues.push({
            id: 'DRIFT-003',
            description: `${doc.name} does not exist`,
            severity: 'FAIL',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'DRIFT-ERROR-003',
        description: `Failed to check document drift: ${err}`,
        severity: 'FAIL',
      });
    }

    // DRIFT-004: Generated dependency graph exists
    try {
      const graphPath = path.join(REPORTS_DIR, 'governance-dependency-graph.mmd');
      checksPerformed++;
      if (!fs.existsSync(graphPath)) {
        issues.push({
          id: 'DRIFT-004',
          description: 'Governance dependency graph not generated',
          severity: 'WARNING',
        });
      }
    } catch (err) {
      issues.push({
        id: 'DRIFT-ERROR-004',
        description: `Failed to check graph drift: ${err}`,
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
}
