/**
 * Governance Task: Friction Enforcement
 *
 * Verifies that each governance automation task references at least one
 * recorded governance friction from GovernanceFrictionLog.md.
 *
 * Missing traceability generates a warning.
 * Does not invent friction records.
 *
 * References:
 * - GF-001 through GF-007: All friction points
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import { parseFrictionLog } from '../shared/markdown-parser';
import { FRICTION_LOG } from '../shared/paths';
import * as fs from 'fs';
import * as path from 'path';

// Known task-to-friction mappings (from task implementations and GF entries)
const TASK_FRICTION_MAP: Record<string, string[]> = {
  'freeze-audit': ['GF-006'],
  'event-validation': ['GF-001', 'GF-003', 'GF-006'],
  'state-machine-validation': ['GF-006'],
  'handbook-validation': ['GF-006'],
  'adr-index': ['GF-006'],
  'baseline': [],
  'traceability-validation': ['GF-003', 'GF-006'],
  'drift-detection': ['GF-006'],
  'friction-enforcement': [],
};

export class FrictionEnforcementTask extends GovernanceTaskBase {
  readonly id = 'friction-enforcement';
  readonly name = 'Friction Enforcement';
  readonly description = 'Verifies automation tasks reference governance frictions';
  readonly dependencies = ['freeze-audit'];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    try {
      // Load friction log
      const frictionContent = fs.readFileSync(FRICTION_LOG, 'utf-8');
      const frictionEntries = parseFrictionLog(frictionContent);
      const frictionIds = new Set(frictionEntries.map(f => f.id));

      // Check each task has friction traceability
      for (const [taskId, frictionRefs] of Object.entries(TASK_FRICTION_MAP)) {
        checksPerformed++;

        if (frictionRefs.length === 0) {
          // Task has no friction reference - acceptable if it's a meta-task
          if (taskId === 'baseline' || taskId === 'friction-enforcement') {
            // Meta-tasks don't need friction references
            continue;
          }
          issues.push({
            id: 'FRICTION-001',
            description: `Task "${taskId}" has no GovernanceFriction reference`,
            severity: 'WARNING',
          });
          continue;
        }

        // Verify referenced frictions exist
        for (const ref of frictionRefs) {
          checksPerformed++;
          if (!frictionIds.has(ref)) {
            issues.push({
              id: 'FRICTION-002',
              description: `Task "${taskId}" references non-existent friction "${ref}"`,
              severity: 'FAIL',
            });
          }
        }
      }

    } catch (err) {
      issues.push({
        id: 'FRICTION-ERROR',
        description: `Failed to validate friction enforcement: ${err}`,
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
