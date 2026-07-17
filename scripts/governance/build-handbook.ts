/**
 * WP4 (P1): Handbook Index Builder
 *
 * Scans ArchitectureHandbook.md cross-references and verifies they resolve.
 *
 * Output: reports/HandbookValidation.json + reports/HandbookValidation.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseHandbookReferences } from './shared/markdown-parser';
import {
  ARCH_HANDBOOK,
  DOCS_DIR,
  REPORTS_DIR,
  findFilesRecursive,
} from './shared/paths';
import { buildReport, writeJSONReport, writeMDReport, getExitCode } from './shared/report';
import type { CheckResult } from './shared/report';

function extractAppendixADocs(content: string): string[] {
  // Look for Appendix A section and extract listed document paths
  const appendixMatch = content.match(/## Appendix A[\s\S]*?(?=## |$)/);
  if (!appendixMatch) return [];

  const docs: string[] = [];
  // Match markdown links or file references
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(appendixMatch[0])) !== null) {
    docs.push(match[2]);
  }

  // Also match inline code paths like `docs/foo/bar.md`
  const codeRegex = /`([^`]+\.md)`/g;
  while ((match = codeRegex.exec(appendixMatch[0])) !== null) {
    if (!docs.includes(match[1])) {
      docs.push(match[1]);
    }
  }

  return docs;
}

// ── Checks ──

export function runHandbookValidation(): ReturnType<typeof buildReport> {
  const results: CheckResult[] = [];

  const handbookContent = fs.readFileSync(ARCH_HANDBOOK, 'utf-8');
  const handbookDir = path.dirname(ARCH_HANDBOOK);
  const chapters = parseHandbookReferences(handbookContent);

  // WP4.1: All [text](path) links resolve to existing files
  const allRefs = chapters.flatMap((c) =>
    c.references.map((r) => ({ chapter: c.title, ref: r })),
  );
  const unresolvedRefs = allRefs.filter(({ ref }) => {
    const resolved = path.resolve(handbookDir, ref);
    return !fs.existsSync(resolved);
  });

  results.push({
    id: 'WP4.1',
    description: 'All Handbook cross-references resolve to existing files',
    severity: unresolvedRefs.length === 0 ? 'PASS' : 'FAIL',
    details:
      unresolvedRefs.length > 0
        ? `Unresolved (${unresolvedRefs.length}): ${unresolvedRefs.map((r) => `${r.chapter}: ${r.ref}`).join('; ')}`
        : `All ${allRefs.length} references resolve`,
  });

  // WP4.2: Appendix A listed documents exist
  // Appendix A paths are relative to docs/ directory
  const appendixDocs = extractAppendixADocs(handbookContent);
  const missingAppendix = appendixDocs.filter((doc) => {
    // Strip leading docs/ if present since we resolve relative to DOCS_DIR
    const cleanDoc = doc.replace(/^docs\//, '');
    const resolved = path.resolve(DOCS_DIR, cleanDoc);
    return !fs.existsSync(resolved);
  });

  results.push({
    id: 'WP4.2',
    description: 'Appendix A listed documents exist on disk',
    severity: appendixDocs.length === 0
      ? 'WARNING'
      : missingAppendix.length === 0
        ? 'PASS'
        : 'FAIL',
    details:
      appendixDocs.length === 0
        ? 'No Appendix A section found'
        : missingAppendix.length > 0
          ? `Missing: ${missingAppendix.join(', ')}`
          : `All ${appendixDocs.length} Appendix A documents exist`,
  });

  // WP4.3: Referenced documents have version headers
  const referencedFiles = [...new Set(allRefs.map(({ ref }) => ref))];
  const missingVersionHeader: string[] = [];

  for (const ref of referencedFiles) {
    const resolved = path.resolve(handbookDir, ref);
    if (!fs.existsSync(resolved)) continue;
    if (!resolved.endsWith('.md')) continue;

    const content = fs.readFileSync(resolved, 'utf-8');
    if (!/> \*\*Version\*\*:/.test(content)) {
      missingVersionHeader.push(ref);
    }
  }

  results.push({
    id: 'WP4.3',
    description: 'Referenced documents have version headers',
    severity: missingVersionHeader.length === 0 ? 'PASS' : 'WARNING',
    details:
      missingVersionHeader.length > 0
        ? `Missing version header: ${missingVersionHeader.join(', ')}`
        : `All ${referencedFiles.length} referenced docs have version headers`,
  });

  // WP4.4: Unreferenced docs in docs/ (informational)
  const allDocs = findFilesRecursive(DOCS_DIR, '.md');
  const relativeDocs = allDocs.map((f) => {
    const rel = path.relative(DOCS_DIR, f).replace(/\\/g, '/');
    return rel;
  });
  const handbookRelRefs = new Set(referencedFiles);

  // Also include the handbook itself and any docs referenced by Appendix A
  const appendixRelRefs = new Set(appendixDocs.map((d) => d.replace(/^\.\.?\//, '')));

  const unreferenced = relativeDocs.filter(
    (d) => !handbookRelRefs.has(d) && !appendixRelRefs.has(d),
  );

  results.push({
    id: 'WP4.4',
    description: 'Unreferenced docs in docs/ (informational)',
    severity: 'PASS', // Always PASS — informational only
    details: `${unreferenced.length} docs not referenced by Handbook (${relativeDocs.length} total)`,
  });

  // Build report
  const report = buildReport('HandbookValidation', results);

  // Write outputs
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  writeJSONReport('HandbookValidation', report);
  writeMDReport('HandbookValidation', report);

  return report;
}

// ── CLI Entry Point ──

if (require.main === module) {
  const report = runHandbookValidation();
  console.log(
    `\nHandbook Validation: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${report.summary.warn} WARN`,
  );
  process.exit(getExitCode(report));
}
