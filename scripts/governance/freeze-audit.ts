/**
 * WP1 (P0): Freeze Audit Automation
 *
 * Automates the manual Sprint4.x-FreezeAudit.md process.
 * Validates consistency between governance documents and code.
 *
 * Output: reports/FreezeAudit.json + reports/FreezeAudit.md
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseEventCatalog,
  parseEventSchema,
  parseStateMachineCatalog,
  parseHandbookReferences,
  parseADRMetadata,
} from './shared/markdown-parser';
import { parseEventClass } from './shared/code-parser';
import {
  EVENT_CATALOG,
  EVENT_SCHEMA,
  SM_CATALOG,
  ARCH_HANDBOOK,
  DECISION_LOG_DIR,
  BACKEND_SRC,
  EVENTS_DIR,
  REPORTS_DIR,
  findFilesRecursive,
} from './shared/paths';
import { buildReport, writeJSONReport, writeMDReport, getExitCode } from './shared/report';
import type { CheckResult } from './shared/report';

function findEventClasses(): string[] {
  return findFilesRecursive(EVENTS_DIR, '.event.ts');
}

function findADRFiles(): string[] {
  if (!fs.existsSync(DECISION_LOG_DIR)) return [];
  return fs
    .readdirSync(DECISION_LOG_DIR)
    .filter((f) => /^(ADR|DEC)-\d+/.test(f))
    .map((f) => path.join(DECISION_LOG_DIR, f));
}

function findGovernanceDocs(): string[] {
  const docs = [
    EVENT_CATALOG,
    EVENT_SCHEMA,
    SM_CATALOG,
    ARCH_HANDBOOK,
  ];
  return docs.filter((f) => fs.existsSync(f));
}

// ── Checks ──

export function runFreezeAudit(): ReturnType<typeof buildReport> {
  const results: CheckResult[] = [];

  // Read all documents
  const catalogContent = fs.readFileSync(EVENT_CATALOG, 'utf-8');
  const schemaContent = fs.readFileSync(EVENT_SCHEMA, 'utf-8');
  const smContent = fs.readFileSync(SM_CATALOG, 'utf-8');
  const handbookContent = fs.readFileSync(ARCH_HANDBOOK, 'utf-8');

  const events = parseEventCatalog(catalogContent);
  const schemas = parseEventSchema(schemaContent);
  const machines = parseStateMachineCatalog(smContent);
  const chapters = parseHandbookReferences(handbookContent);

  // WP1.1: EventCatalog events exist in EventSchema
  const catalogNames = events.map((e) => e.name);
  const schemaNames = schemas.map((s) => s.name);
  const missingInSchema = catalogNames.filter((n) => !schemaNames.includes(n));
  results.push({
    id: 'WP1.1',
    description: 'All EventCatalog events have EventSchema entries',
    severity: missingInSchema.length === 0 ? 'PASS' : 'FAIL',
    details:
      missingInSchema.length > 0
        ? `Missing in schema: ${missingInSchema.join(', ')}`
        : `All ${catalogNames.length} events have schema entries`,
  });

  // WP1.2: Owner/domain matches between Catalog and Schema
  const ownerMismatches: string[] = [];
  for (const event of events) {
    const schema = schemas.find((s) => s.name === event.name);
    if (schema && event.owner && schema.owner) {
      // Normalize: extract the primary domain keyword
      const catalogDomain = event.owner.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
      const schemaDomain = schema.owner.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
      if (catalogDomain !== schemaDomain && !catalogDomain.includes(schemaDomain) && !schemaDomain.includes(catalogDomain)) {
        ownerMismatches.push(`${event.name}: catalog="${event.owner}" vs schema="${schema.owner}"`);
      }
    }
  }
  results.push({
    id: 'WP1.2',
    description: 'Owner/domain matches between Catalog and Schema',
    severity: ownerMismatches.length === 0 ? 'PASS' : 'FAIL',
    details:
      ownerMismatches.length > 0
        ? `Mismatches: ${ownerMismatches.join('; ')}`
        : 'All owners match',
  });

  // WP1.3: State machines count is 9
  results.push({
    id: 'WP1.3',
    description: 'StateMachineCatalog contains exactly 9 state machines',
    severity: machines.length === 9 ? 'PASS' : machines.length > 0 ? 'WARNING' : 'FAIL',
    details: `Found ${machines.length} state machines`,
  });

  // WP1.4: Document version headers present
  const govDocs = findGovernanceDocs();
  const missingVersion: string[] = [];
  for (const doc of govDocs) {
    const content = fs.readFileSync(doc, 'utf-8');
    if (!/> \*\*Version\*\*:/.test(content)) {
      missingVersion.push(path.relative(path.join(__dirname, '..', '..'), doc));
    }
  }
  results.push({
    id: 'WP1.4',
    description: 'All governance documents have version headers',
    severity: missingVersion.length === 0 ? 'PASS' : 'WARNING',
    details:
      missingVersion.length > 0
        ? `Missing version header: ${missingVersion.join(', ')}`
        : `All ${govDocs.length} documents have version headers`,
  });

  // WP1.5: ArchitectureHandbook cross-references resolve to files
  const handbookDir = path.dirname(ARCH_HANDBOOK);
  const unresolvedRefs: string[] = [];
  for (const chapter of chapters) {
    for (const ref of chapter.references) {
      const resolved = path.resolve(handbookDir, ref);
      if (!fs.existsSync(resolved)) {
        unresolvedRefs.push(`${chapter.title}: ${ref}`);
      }
    }
  }
  results.push({
    id: 'WP1.5',
    description: 'ArchitectureHandbook cross-references resolve to existing files',
    severity: unresolvedRefs.length === 0 ? 'PASS' : 'FAIL',
    details:
      unresolvedRefs.length > 0
        ? `Unresolved: ${unresolvedRefs.join('; ')}`
        : `All ${chapters.flatMap((c) => c.references).length} references resolve`,
  });

  // WP1.6: ADR files have required metadata
  const adrFiles = findADRFiles();
  const adrIssues: string[] = [];
  for (const adrFile of adrFiles) {
    const content = fs.readFileSync(adrFile, 'utf-8');
    const fileName = path.basename(adrFile);
    const meta = parseADRMetadata(content, fileName);
    if (!meta.status) adrIssues.push(`${fileName}: missing Status`);
    if (!meta.date) adrIssues.push(`${fileName}: missing Date`);
  }
  results.push({
    id: 'WP1.6',
    description: 'ADR/DEC files have required metadata (Status, Date)',
    severity: adrIssues.length === 0 ? 'PASS' : 'FAIL',
    details:
      adrIssues.length > 0
        ? `Issues: ${adrIssues.join('; ')}`
        : `All ${adrFiles.length} ADR files have required metadata`,
  });

  // WP1.7: CURRENT events have code classes
  const currentEvents = events.filter((e) => e.status === 'CURRENT');
  const eventClassFiles = findEventClasses();
  const classNames = eventClassFiles.map((f) => {
    const content = fs.readFileSync(f, 'utf-8');
    const cls = parseEventClass(content, f);
    return cls ? cls.eventName : null;
  }).filter(Boolean) as string[];

  const missingClasses = currentEvents.filter((e) => !classNames.includes(e.name));
  results.push({
    id: 'WP1.7',
    description: 'CURRENT events have corresponding event classes in code',
    severity: missingClasses.length === 0 ? 'PASS' : 'FAIL',
    details:
      missingClasses.length > 0
        ? `Missing classes: ${missingClasses.join(', ')}`
        : `All ${currentEvents.length} CURRENT events have code classes`,
  });

  // WP1.8: Event naming convention valid (lowercase dot notation)
  const invalidNames = events.filter((e) => !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(e.name));
  results.push({
    id: 'WP1.8',
    description: 'All event names follow lowercase dot notation convention',
    severity: invalidNames.length === 0 ? 'PASS' : 'FAIL',
    details:
      invalidNames.length > 0
        ? `Invalid names: ${invalidNames.map((e) => e.name).join(', ')}`
        : `All ${events.length} event names are valid`,
  });

  // Build report
  const report = buildReport('FreezeAudit', results);

  // Write outputs
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  writeJSONReport('FreezeAudit', report);
  writeMDReport('FreezeAudit', report);

  return report;
}

// ── CLI Entry Point ──

if (require.main === module) {
  const report = runFreezeAudit();
  console.log(`\nFreeze Audit: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${report.summary.warn} WARN`);
  process.exit(getExitCode(report));
}
