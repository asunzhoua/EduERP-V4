/**
 * WP2 (P0): Event Validation — Three-Way Cross-Reference
 *
 * Validates consistency between EventCatalog, EventSchema, and code.
 * Addresses friction points GF-001, GF-003, GF-006.
 *
 * Output: reports/EventValidation.json + reports/EventValidation.md
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseEventCatalog,
  parseEventSchema,
} from './shared/markdown-parser';
import {
  parseEventClass,
  parsePublishCalls,
} from './shared/code-parser';
import {
  EVENT_CATALOG,
  EVENT_SCHEMA,
  EVENTS_DIR,
  MODULES_DIR,
  REPORTS_DIR,
  findFilesRecursive,
} from './shared/paths';
import { buildReport, writeJSONReport, writeMDReport, getExitCode } from './shared/report';
import type { CheckResult } from './shared/report';

// ── File Discovery ──

function findAllServiceFiles(): string[] {
  return findFilesRecursive(MODULES_DIR, '.service.ts');
}

function findAllEventClassFiles(): string[] {
  return findFilesRecursive(EVENTS_DIR, '.event.ts');
}

// ── Checks ──

export function runEventValidation(): ReturnType<typeof buildReport> {
  const results: CheckResult[] = [];

  // Parse documents
  const catalogContent = fs.readFileSync(EVENT_CATALOG, 'utf-8');
  const schemaContent = fs.readFileSync(EVENT_SCHEMA, 'utf-8');

  const catalogEvents = parseEventCatalog(catalogContent);
  const schemaEvents = parseEventSchema(schemaContent);

  // Parse code: event classes
  const eventClassFiles = findAllEventClassFiles();
  const eventClasses = eventClassFiles
    .map((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      return parseEventClass(content, f);
    })
    .filter(Boolean);

  // Parse code: publish() calls from all service files
  const serviceFiles = findAllServiceFiles();
  const publishCalls = serviceFiles.flatMap((f) => {
    const content = fs.readFileSync(f, 'utf-8');
    return parsePublishCalls(content, f);
  });

  // Derived sets
  const catalogNames = new Set(catalogEvents.map((e) => e.name));
  const schemaNames = new Set(schemaEvents.map((s) => s.name));
  const classNames = new Set(eventClasses.map((c) => c!.eventName));
  const publishedNames = new Set(publishCalls.map((p) => p.eventName));

  // WP2.1: Every EventCatalog event has EventSchema entry
  const missingSchema = catalogEvents.filter((e) => !schemaNames.has(e.name));
  results.push({
    id: 'WP2.1',
    description: 'Every EventCatalog event has EventSchema entry',
    severity: missingSchema.length === 0 ? 'PASS' : 'FAIL',
    details:
      missingSchema.length > 0
        ? `Missing schema: ${missingSchema.map((e) => e.name).join(', ')}`
        : `All ${catalogEvents.length} catalog events have schema entries`,
  });

  // WP2.2: CURRENT/DESIGNED events have event class in src/events/
  // CURRENT without class = FAIL, DESIGNED without class = WARNING (not yet implemented)
  const currentEvents = catalogEvents.filter((e) => e.status === 'CURRENT');
  const designedEvents = catalogEvents.filter((e) => e.status === 'DESIGNED');
  const missingCurrentClasses = currentEvents.filter((e) => !classNames.has(e.name));
  const missingDesignedClasses = designedEvents.filter((e) => !classNames.has(e.name));

  if (missingCurrentClasses.length > 0) {
    results.push({
      id: 'WP2.2',
      description: 'CURRENT/DESIGNED events have event class in code',
      severity: 'FAIL',
      details: `CURRENT without class: ${missingCurrentClasses.map((e) => e.name).join(', ')}`,
    });
  } else if (missingDesignedClasses.length > 0) {
    results.push({
      id: 'WP2.2',
      description: 'CURRENT/DESIGNED events have event class in code',
      severity: 'WARNING',
      details: `DESIGNED without class (${missingDesignedClasses.length}): ${missingDesignedClasses.map((e) => e.name).join(', ')}`,
    });
  } else {
    results.push({
      id: 'WP2.2',
      description: 'CURRENT/DESIGNED events have event class in code',
      severity: 'PASS',
      details: `All ${currentEvents.length + designedEvents.length} CURRENT/DESIGNED events have code classes`,
    });
  }

  // WP2.3: Event class fields match Schema payload fields
  // Excludes envelope fields (eventId, time/timestamp) and nested array fields (attendance[])
  // "in schema but not class" = WARNING (schema may be ahead of code)
  // "in class but not schema" = FAIL (code has undocumented fields)
  const ENVELOPE_FIELDS = new Set(['eventId', 'time', 'timestamp']);
  const fieldMismatches: { event: string; missing: string[]; extra: string[] }[] = [];
  for (const cls of eventClasses) {
    if (!cls) continue;
    const schema = schemaEvents.find((s) => s.name === cls.eventName);
    if (!schema) continue;

    // Filter to scalar payload fields only (exclude nested arrays like attendance[])
    const schemaScalarFields = schema.fields
      .filter((f) => !f.name.includes('[]') && !ENVELOPE_FIELDS.has(f.name));
    const classScalarFields = cls.fields.filter((f) => !ENVELOPE_FIELDS.has(f));

    const schemaFieldNames = new Set(schemaScalarFields.map((f) => f.name));
    const classFieldNames = new Set(classScalarFields);

    const inSchemaNotClass = schemaScalarFields.filter((f) => !classFieldNames.has(f.name)).map((f) => f.name);
    const inClassNotSchema = classScalarFields.filter((f) => !schemaFieldNames.has(f));

    if (inSchemaNotClass.length > 0 || inClassNotSchema.length > 0) {
      fieldMismatches.push({ event: cls.eventName, missing: inSchemaNotClass, extra: inClassNotSchema });
    }
  }

  const hasExtraFields = fieldMismatches.some((m) => m.extra.length > 0);
  const hasMissingFields = fieldMismatches.some((m) => m.missing.length > 0);
  const wp23Severity = hasExtraFields ? 'FAIL' : hasMissingFields ? 'WARNING' : 'PASS';
  const wp23Details = fieldMismatches.map((m) => {
    const parts: string[] = [];
    if (m.missing.length > 0) parts.push(`in schema but not class: ${m.missing.join(', ')}`);
    if (m.extra.length > 0) parts.push(`in class but not schema: ${m.extra.join(', ')}`);
    return `${m.event}: ${parts.join('; ')}`;
  }).join('; ');

  results.push({
    id: 'WP2.3',
    description: 'Event class fields match Schema payload fields',
    severity: wp23Severity,
    details: wp23Details || `All ${eventClasses.length} event class fields match schemas`,
  });

  // WP2.4: Every publish() call registers event in EventCatalog
  const unregisteredPublishes = publishCalls.filter((p) => !catalogNames.has(p.eventName));
  results.push({
    id: 'WP2.4',
    description: 'Every publish() call has event registered in EventCatalog',
    severity: unregisteredPublishes.length === 0 ? 'PASS' : 'FAIL',
    details:
      unregisteredPublishes.length > 0
        ? `Unregistered: ${unregisteredPublishes.map((p) => p.eventName).join(', ')}`
        : `All ${publishCalls.length} publish() calls are registered`,
  });

  // WP2.5: Publish payload fields match Schema defined fields
  const payloadMismatches: string[] = [];
  for (const call of publishCalls) {
    const schema = schemaEvents.find((s) => s.name === call.eventName);
    if (!schema) continue;

    const schemaFieldNames = new Set(schema.fields.map((f) => f.name));
    // Filter out common envelope/meta fields that are added by EventBus
    const envelopeFields = new Set(['eventId', 'timestamp', 'version']);

    const callFieldsFiltered = call.payloadFields.filter(
      (f) => !envelopeFields.has(f) && f !== 'event' && f !== 'Event',
    );

    const missingInSchema = callFieldsFiltered.filter((f) => !schemaFieldNames.has(f));
    if (missingInSchema.length > 0) {
      payloadMismatches.push(
        `${call.eventName}: fields in publish but not schema: ${missingInSchema.join(', ')}`,
      );
    }
  }
  results.push({
    id: 'WP2.5',
    description: 'Publish payload fields match Schema defined fields',
    severity: payloadMismatches.length === 0 ? 'PASS' : 'FAIL',
    details:
      payloadMismatches.length > 0
        ? payloadMismatches.join('; ')
        : `All ${publishCalls.length} publish payloads match schemas`,
  });

  // WP2.6: No orphan event classes (code classes not in Catalog)
  const orphans = eventClasses.filter((c) => c && !catalogNames.has(c.eventName));
  results.push({
    id: 'WP2.6',
    description: 'No orphan event classes (code classes not in Catalog)',
    severity: orphans.length === 0 ? 'PASS' : 'WARNING',
    details:
      orphans.length > 0
        ? `Orphans: ${orphans.map((c) => c!.eventName).join(', ')}`
        : `All ${eventClasses.length} event classes are cataloged`,
  });

  // WP2.7: CURRENT status accuracy — only events with publish() calls should be CURRENT
  const currentWithoutPublish = currentEvents.filter((e) => !publishedNames.has(e.name));
  results.push({
    id: 'WP2.7',
    description: 'CURRENT status accuracy (only events with publish() calls)',
    severity: currentWithoutPublish.length === 0 ? 'PASS' : 'WARNING',
    details:
      currentWithoutPublish.length > 0
        ? `CURRENT without publish(): ${currentWithoutPublish.map((e) => e.name).join(', ')}`
        : `All ${currentEvents.length} CURRENT events have publish() calls`,
  });

  // Build report
  const report = buildReport('EventValidation', results);

  // Write outputs
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  writeJSONReport('EventValidation', report);
  writeMDReport('EventValidation', report);

  return report;
}

// ── CLI Entry Point ──

if (require.main === module) {
  const report = runEventValidation();
  console.log(
    `\nEvent Validation: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${report.summary.warn} WARN`,
  );
  process.exit(getExitCode(report));
}
