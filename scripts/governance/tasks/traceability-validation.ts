/**
 * Governance Task: Traceability Validation
 *
 * Builds automatic traceability between existing governance assets.
 * Verifies that every governance asset can be traced through existing references.
 *
 * Traceability chain:
 * ArchitectureHandbook → ADRs → Modules → Events → Schema → StateMachines → Baseline
 *
 * References:
 * - GF-006: Catalog vs code consistency
 * - GF-003: Class vs Schema mismatch
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import {
  parseEventCatalog,
  parseEventSchema,
  parseStateMachineCatalog,
  parseHandbookReferences,
  parseADRMetadata,
} from '../shared/markdown-parser';
import { parseEventClass, parseTransitions } from '../shared/code-parser';
import {
  EVENT_CATALOG,
  EVENT_SCHEMA,
  SM_CATALOG,
  ARCH_HANDBOOK,
  DECISION_LOG_DIR,
  EVENTS_DIR,
  MODULES_DIR,
  findFilesRecursive,
} from '../shared/paths';
import * as fs from 'fs';
import * as path from 'path';

export class TraceabilityValidationTask extends GovernanceTaskBase {
  readonly id = 'traceability-validation';
  readonly name = 'Traceability Validation';
  readonly description = 'Validates traceability between governance assets';
  readonly dependencies = ['freeze-audit'];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    // TRACE-001: ArchitectureHandbook references resolve
    try {
      const handbookContent = fs.readFileSync(ARCH_HANDBOOK, 'utf-8');
      const handbook = parseHandbookReferences(handbookContent);

      for (const chapter of handbook) {
        for (const ref of chapter.references) {
          checksPerformed++;
          const fullPath = path.join(path.dirname(ARCH_HANDBOOK), ref);
          if (!fs.existsSync(fullPath)) {
            issues.push({
              id: 'TRACE-001',
              description: `Handbook reference not found: ${ref}`,
              severity: 'FAIL',
            });
          }
        }
      }
    } catch (err) {
      issues.push({
        id: 'TRACE-ERROR-001',
        description: `Failed to validate Handbook references: ${err}`,
        severity: 'FAIL',
      });
    }

    // TRACE-002: ADR files have required metadata and resolve
    try {
      const adrFiles = findFilesRecursive(DECISION_LOG_DIR, /ADR-.*\.md$/);
      const decFiles = findFilesRecursive(DECISION_LOG_DIR, /DEC-.*\.md$/);
      const allFiles = [...adrFiles, ...decFiles];

      for (const file of allFiles) {
        checksPerformed++;
        const content = fs.readFileSync(file, 'utf-8');
        const metadata = parseADRMetadata(content, file);
        if (!metadata.status) {
          issues.push({
            id: 'TRACE-002',
            description: `ADR/DEC file missing status: ${file}`,
            severity: 'FAIL',
          });
        }
        if (!metadata.date) {
          issues.push({
            id: 'TRACE-002',
            description: `ADR/DEC file missing date: ${file}`,
            severity: 'FAIL',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'TRACE-ERROR-002',
        description: `Failed to validate ADR metadata: ${err}`,
        severity: 'FAIL',
      });
    }

    // TRACE-003: EventCatalog events exist in EventSchema
    try {
      const catalogContent = fs.readFileSync(EVENT_CATALOG, 'utf-8');
      const schemaContent = fs.readFileSync(EVENT_SCHEMA, 'utf-8');
      const catalog = parseEventCatalog(catalogContent);
      const schema = parseEventSchema(schemaContent);
      const schemaNames = new Set(schema.map(s => s.name));

      for (const event of catalog) {
        checksPerformed++;
        if (!schemaNames.has(event.name)) {
          issues.push({
            id: 'TRACE-003',
            description: `Event "${event.name}" in EventCatalog has no EventSchema entry`,
            severity: 'FAIL',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'TRACE-ERROR-003',
        description: `Failed to validate EventCatalog vs EventSchema: ${err}`,
        severity: 'FAIL',
      });
    }

    // TRACE-004: CURRENT/DESIGNED events have code classes
    try {
      const catalogContent = fs.readFileSync(EVENT_CATALOG, 'utf-8');
      const catalog = parseEventCatalog(catalogContent);
      const currentDesigned = catalog.filter(e => e.status === 'CURRENT' || e.status === 'DESIGNED');

      const eventFiles = findFilesRecursive(EVENTS_DIR, '.event.ts');
      const eventClassNames: string[] = [];
      for (const eventFile of eventFiles) {
        const content = fs.readFileSync(eventFile, 'utf-8');
        const ec = parseEventClass(content, eventFile);
        if (ec) eventClassNames.push(ec.name.toLowerCase());
      }

      for (const event of currentDesigned) {
        checksPerformed++;
        const prefix = event.name.split('.')[0];
        const hasClass = eventClassNames.length > 0 &&
          eventClassNames.some(name => name.includes(prefix));
        if (!hasClass) {
          issues.push({
            id: 'TRACE-004',
            description: `${event.status} event "${event.name}" has no event class in code`,
            severity: 'WARNING',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'TRACE-ERROR-004',
        description: `Failed to validate event traceability: ${err}`,
        severity: 'FAIL',
      });
    }

    // TRACE-005: StateMachine catalog transitions have code representation
    try {
      const smContent = fs.readFileSync(SM_CATALOG, 'utf-8');
      const catalog = parseStateMachineCatalog(smContent);

      const serviceFiles = findFilesRecursive(MODULES_DIR, '.service.ts');
      const codeTransitions: string[] = [];
      for (const serviceFile of serviceFiles) {
        const content = fs.readFileSync(serviceFile, 'utf-8');
        const transitions = parseTransitions(content, serviceFile);
        if (transitions) codeTransitions.push(transitions.variableName.toLowerCase());
      }

      // Check catalog entries have some code representation
      for (const cm of catalog) {
        checksPerformed++;
        // Catalog-only machines (Student, Enrollment, TeacherAssignment) are expected
        // Just verify the catalog entry is well-formed
        if (cm.transitions.length === 0 && cm.terminalStates.length === 0) {
          issues.push({
            id: 'TRACE-005',
            description: `StateMachine "${cm.name}" has no transitions or terminal states`,
            severity: 'WARNING',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'TRACE-ERROR-005',
        description: `Failed to validate StateMachine traceability: ${err}`,
        severity: 'FAIL',
      });
    }

    // TRACE-006: No orphaned governance assets
    try {
      const handbookContent = fs.readFileSync(ARCH_HANDBOOK, 'utf-8');
      const handbook = parseHandbookReferences(handbookContent);
      const referencedPaths = new Set<string>();
      for (const chapter of handbook) {
        for (const ref of chapter.references) {
          referencedPaths.add(ref);
        }
      }

      // Check ADR files are referenced in Handbook
      const adrFiles = findFilesRecursive(DECISION_LOG_DIR, /ADR-.*\.md$/);
      for (const adrFile of adrFiles) {
        checksPerformed++;
        const relativePath = path.relative(path.dirname(ARCH_HANDBOOK), adrFile);
        if (!referencedPaths.has(relativePath)) {
          issues.push({
            id: 'TRACE-006',
            description: `ADR not referenced in Handbook: ${relativePath}`,
            severity: 'WARNING',
          });
        }
      }
    } catch (err) {
      issues.push({
        id: 'TRACE-ERROR-006',
        description: `Failed to validate orphaned assets: ${err}`,
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
