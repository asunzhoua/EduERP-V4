/**
 * Governance Task: Event Validation
 *
 * Validates event catalog vs schema vs code.
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import { parseEventCatalog, parseEventSchema } from '../shared/markdown-parser';
import { parseEventClass, parsePublishCalls, EventClassInfo, PublishCall } from '../shared/code-parser';
import { EVENT_CATALOG, EVENT_SCHEMA, EVENTS_DIR, MODULES_DIR, findFilesRecursive } from '../shared/paths';
import * as fs from 'fs';

export class EventValidationTask extends GovernanceTaskBase {
  readonly id = 'event-validation';
  readonly name = 'Event Validation';
  readonly description = 'Validates event catalog, schema, and code consistency';
  readonly dependencies = ['freeze-audit'];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    try {
      // Read and parse catalog and schema
      const catalogContent = fs.readFileSync(EVENT_CATALOG, 'utf-8');
      const schemaContent = fs.readFileSync(EVENT_SCHEMA, 'utf-8');
      const catalog = parseEventCatalog(catalogContent);
      const schema = parseEventSchema(schemaContent);

      // Scan event files for classes
      const eventFiles = findFilesRecursive(EVENTS_DIR, '.event.ts');
      const eventClasses: EventClassInfo[] = [];
      for (const eventFile of eventFiles) {
        const content = fs.readFileSync(eventFile, 'utf-8');
        const ec = parseEventClass(content, eventFile);
        if (ec) eventClasses.push(ec);
      }

      // Scan module files for publish calls
      const moduleFiles = findFilesRecursive(MODULES_DIR, '.service.ts');
      const publishCalls: PublishCall[] = [];
      for (const moduleFile of moduleFiles) {
        const content = fs.readFileSync(moduleFile, 'utf-8');
        publishCalls.push(...parsePublishCalls(content, moduleFile));
      }

      // WP2.1: Every EventCatalog event has EventSchema entry
      const schemaNames = new Set(schema.map(s => s.name));
      for (const event of catalog) {
        checksPerformed++;
        if (!schemaNames.has(event.name)) {
          issues.push({
            id: 'EVENT-001',
            description: `Event "${event.name}" has no EventSchema entry`,
            severity: 'FAIL',
          });
        }
      }

      // WP2.2: CURRENT/DESIGNED events have event class
      const currentDesigned = catalog.filter(e => e.status === 'CURRENT' || e.status === 'DESIGNED');
      for (const event of currentDesigned) {
        checksPerformed++;
        const prefix = event.name.split('.')[0];
        const hasClass = eventClasses.some(ec => ec.name.toLowerCase().includes(prefix));
        if (!hasClass) {
          issues.push({
            id: 'EVENT-002',
            description: `${event.status} event "${event.name}" has no event class in code`,
            severity: 'WARNING',
          });
        }
      }

      // WP2.6: No orphan event classes
      for (const ec of eventClasses) {
        checksPerformed++;
        const catalogPrefix = ec.eventName.split('.')[0];
        const inCatalog = catalog.some(e => e.name.toLowerCase().includes(catalogPrefix));
        if (!inCatalog) {
          issues.push({
            id: 'EVENT-006',
            description: `Event class "${ec.name}" is not registered in EventCatalog`,
            severity: 'WARNING',
          });
        }
      }

    } catch (err) {
      issues.push({
        id: 'EVENT-ERROR',
        description: `Event validation failed: ${err}`,
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
