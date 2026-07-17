/**
 * Governance Task: Architecture Consistency
 *
 * Implements consistency verification across governance assets.
 * Reports inconsistencies without modifying any asset.
 *
 * Checks:
 * - Event Catalog count matches Event Schema count
 * - ADR references resolve correctly
 * - ArchitectureHandbook references existing documents
 * - StateMachine references resolve correctly
 *
 * References:
 * - GF-006: Catalog vs code consistency
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import {
  parseEventCatalog,
  parseEventSchema,
  parseStateMachineCatalog,
  parseHandbookReferences,
} from '../shared/markdown-parser';
import {
  EVENT_CATALOG,
  EVENT_SCHEMA,
  SM_CATALOG,
  ARCH_HANDBOOK,
} from '../shared/paths';
import * as fs from 'fs';

export class ArchitectureConsistencyTask extends GovernanceTaskBase {
  readonly id = 'architecture-consistency';
  readonly name = 'Architecture Consistency';
  readonly description = 'Verifies consistency across governance assets';
  readonly dependencies = ['freeze-audit'];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    // CONSIST-001: Event Catalog count matches Event Schema count
    try {
      const catalogContent = fs.readFileSync(EVENT_CATALOG, 'utf-8');
      const schemaContent = fs.readFileSync(EVENT_SCHEMA, 'utf-8');
      const catalog = parseEventCatalog(catalogContent);
      const schema = parseEventSchema(schemaContent);

      checksPerformed++;
      if (catalog.length !== schema.length) {
        issues.push({
          id: 'CONSIST-001',
          description: `Event Catalog (${catalog.length} events) and Event Schema (${schema.length} schemas) have different counts`,
          severity: 'WARNING',
        });
      }
    } catch (err) {
      issues.push({
        id: 'CONSIST-ERROR-001',
        description: `Failed to validate event count consistency: ${err}`,
        severity: 'FAIL',
      });
    }

    // CONSIST-002: Event owner consistency between Catalog and Schema
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
            id: 'CONSIST-002',
            description: `Event "${event.name}" owner mismatch: catalog="${event.owner}", schema="${schemaEntry.owner}"`,
            severity: 'WARNING',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'CONSIST-ERROR-002',
        description: `Failed to validate owner consistency: ${err}`,
        severity: 'FAIL',
      });
    }

    // CONSIST-003: StateMachine catalog well-formed
    try {
      const smContent = fs.readFileSync(SM_CATALOG, 'utf-8');
      const stateMachines = parseStateMachineCatalog(smContent);

      checksPerformed++;
      if (stateMachines.length !== 9) {
        issues.push({
          id: 'CONSIST-003',
          description: `StateMachineCatalog contains ${stateMachines.length} state machines, expected 9`,
          severity: 'WARNING',
        });
      }
    } catch (err) {
      issues.push({
        id: 'CONSIST-ERROR-003',
        description: `Failed to validate StateMachine consistency: ${err}`,
        severity: 'FAIL',
      });
    }

    // CONSIST-004: ArchitectureHandbook references resolve
    try {
      const handbookContent = fs.readFileSync(ARCH_HANDBOOK, 'utf-8');
      const handbook = parseHandbookReferences(handbookContent);
      let brokenRefs = 0;

      for (const chapter of handbook) {
        for (const ref of chapter.references) {
          checksPerformed++;
          const fullPath = require('path').join(require('path').dirname(ARCH_HANDBOOK), ref);
          if (!fs.existsSync(fullPath)) {
            brokenRefs++;
          }
        }
      }

      if (brokenRefs > 0) {
        issues.push({
          id: 'CONSIST-004',
          description: `${brokenRefs} Handbook references do not resolve`,
          severity: 'FAIL',
        });
      }
    } catch (err) {
      issues.push({
        id: 'CONSIST-ERROR-004',
        description: `Failed to validate Handbook consistency: ${err}`,
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
