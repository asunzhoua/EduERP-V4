/**
 * Governance Task: Freeze Audit
 *
 * Validates governance document consistency.
 * Checks that are duplicated in focused validators have been removed:
 * - FREEZE-001 (EventCatalog vs EventSchema) → covered by EVENT-001
 * - FREEZE-005 (Handbook references) → covered by HAND-001
 * - FREEZE-006 (ADR metadata) → covered by ADR-001
 * - FREEZE-007 (CURRENT events have classes) → covered by EVENT-002
 *
 * Remaining checks are unique to this task.
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import { parseEventCatalog, parseEventSchema, parseStateMachineCatalog } from '../shared/markdown-parser';
import { EVENT_CATALOG, EVENT_SCHEMA, SM_CATALOG, ARCH_HANDBOOK } from '../shared/paths';
import * as fs from 'fs';

export class FreezeAuditTask extends GovernanceTaskBase {
  readonly id = 'freeze-audit';
  readonly name = 'Freeze Audit';
  readonly description = 'Validates governance document consistency (unique checks only)';
  readonly dependencies: string[] = [];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    // FREEZE-002: Owner/domain matches between Catalog and Schema (UNIQUE)
    try {
      const catalogContent = fs.readFileSync(EVENT_CATALOG, 'utf-8');
      const schemaContent = fs.readFileSync(EVENT_SCHEMA, 'utf-8');
      const catalog = parseEventCatalog(catalogContent);
      const schema = parseEventSchema(schemaContent);
      const schemaMap = new Map(schema.map(s => [s.name, s]));

      for (const event of catalog) {
        checksPerformed++;
        const schemaEntry = schemaMap.get(event.name);
        if (schemaEntry && event.owner !== schemaEntry.owner) {
          issues.push({
            id: 'FREEZE-002',
            description: `Event "${event.name}" has mismatched owner: catalog="${event.owner}", schema="${schemaEntry.owner}"`,
            severity: 'WARNING',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'FREEZE-ERROR-002',
        description: `Failed to validate owner matching: ${err}`,
        severity: 'FAIL',
      });
    }

    // FREEZE-003: StateMachineCatalog contains 9 state machines (UNIQUE)
    try {
      const smContent = fs.readFileSync(SM_CATALOG, 'utf-8');
      const stateMachines = parseStateMachineCatalog(smContent);
      checksPerformed++;
      if (stateMachines.length !== 9) {
        issues.push({
          id: 'FREEZE-003',
          description: `StateMachineCatalog contains ${stateMachines.length} state machines, expected 9`,
          severity: stateMachines.length < 9 ? 'FAIL' : 'WARNING',
        });
      }
    } catch (err) {
      issues.push({
        id: 'FREEZE-ERROR-003',
        description: `Failed to validate StateMachineCatalog: ${err}`,
        severity: 'FAIL',
      });
    }

    // FREEZE-004: Governance documents have version headers (UNIQUE)
    const governanceDocs = [EVENT_CATALOG, EVENT_SCHEMA, SM_CATALOG, ARCH_HANDBOOK];

    for (const docPath of governanceDocs) {
      checksPerformed++;
      try {
        const content = fs.readFileSync(docPath, 'utf-8');
        if (!content.includes('**Version**:') && !content.includes('> **Version**:')) {
          issues.push({
            id: 'FREEZE-004',
            description: `Document missing version header: ${docPath}`,
            severity: 'WARNING',
          });
        }
      } catch {
        issues.push({
          id: 'FREEZE-004',
          description: `Could not read document: ${docPath}`,
          severity: 'FAIL',
        });
      }
    }

    // FREEZE-008: Event naming convention (UNIQUE)
    try {
      const catalogContent = fs.readFileSync(EVENT_CATALOG, 'utf-8');
      const catalog = parseEventCatalog(catalogContent);
      for (const event of catalog) {
        checksPerformed++;
        if (!/^[a-z]+\.[a-z]+(\.[a-z]+)*$/.test(event.name)) {
          issues.push({
            id: 'FREEZE-008',
            description: `Event "${event.name}" violates naming convention (expected: lowercase dot notation)`,
            severity: 'FAIL',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'FREEZE-ERROR-008',
        description: `Failed to validate event naming: ${err}`,
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
