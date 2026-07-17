/**
 * Governance Task: State Machine Validation
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import { parseStateMachineCatalog } from '../shared/markdown-parser';
import { parseTransitions, TransitionMap } from '../shared/code-parser';
import { SM_CATALOG, MODULES_DIR, findFilesRecursive } from '../shared/paths';
import * as fs from 'fs';

export class StateMachineValidationTask extends GovernanceTaskBase {
  readonly id = 'state-machine-validation';
  readonly name = 'State Machine Validation';
  readonly description = 'Validates code state machines against catalog';
  readonly dependencies = ['freeze-audit'];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    try {
      // Read and parse StateMachineCatalog
      const smContent = fs.readFileSync(SM_CATALOG, 'utf-8');
      const catalog = parseStateMachineCatalog(smContent);

      // Scan all service files for transitions
      const serviceFiles = findFilesRecursive(MODULES_DIR, '.service.ts');
      const codeTransitions: TransitionMap[] = [];

      for (const serviceFile of serviceFiles) {
        const content = fs.readFileSync(serviceFile, 'utf-8');
        const transitions = parseTransitions(content, serviceFile);
        if (transitions) {
          codeTransitions.push(transitions);
        }
      }

      // WP3.1: Each code state machine has matching Catalog section
      const catalogNames = new Set(catalog.map(c => c.name.toLowerCase()));
      for (const ct of codeTransitions) {
        checksPerformed++;
        if (!catalogNames.has(ct.variableName.toLowerCase())) {
          issues.push({
            id: 'SM-001',
            description: `Code state machine "${ct.variableName}" has no Catalog section`,
            severity: 'WARNING',
          });
        }
      }

      // WP3.2: Catalog transitions present in code
      for (const cm of catalog) {
        checksPerformed++;
        const codeMachine = codeTransitions.find(ct => ct.variableName.toLowerCase() === cm.name.toLowerCase());
        if (!codeMachine) {
          // Catalog-only machine (expected for some)
          continue;
        }

        // Check transitions: catalog uses Transition[] (from/to objects)
        // code uses TransitionMap.transitions which is Record<string, string[]>
        for (const transition of cm.transitions) {
          const from = transition.from;
          const to = transition.to;
          const targets = codeMachine.transitions[from];
          if (!targets || !targets.includes(to)) {
            issues.push({
              id: 'SM-002',
              description: `Catalog transition ${from} -> ${to} missing in code for "${cm.name}"`,
              severity: 'WARNING',
            });
          }
        }
      }

    } catch (err) {
      issues.push({
        id: 'SM-ERROR',
        description: `State machine validation failed: ${err}`,
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
