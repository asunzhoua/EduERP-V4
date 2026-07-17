/**
 * WP3 (P1): State Machine Validation
 *
 * Validates 6 code state machines against StateMachineCatalog.md.
 * Generates Mermaid diagrams for each.
 *
 * Output: reports/StateMachineValidation.json + .md + reports/StateMachineDiagrams.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseStateMachineCatalog } from './shared/markdown-parser';
import { parseTransitions } from './shared/code-parser';
import {
  SM_CATALOG,
  MODULES_DIR,
  REPORTS_DIR,
  findFilesRecursive,
} from './shared/paths';
import { buildReport, writeJSONReport, writeMDReport, getExitCode } from './shared/report';
import type { CheckResult } from './shared/report';

// ── Service-to-Catalog Name Mapping ──

// Maps variable names and file paths to expected catalog section names
const SERVICE_CATALOG_MAP: Record<string, string> = {
  'lesson.service.ts': 'Lesson Status',
  'course.service.ts': 'Course Status',
  'class.service.ts': 'Class Status',
  'contract.service.ts': 'Contract Status',
  'lesson-attendance.service.ts': 'Attendance Workflow',
  'lesson-change-request.service.ts': 'Change Request Status',
};

// ── Mermaid Generation ──

function generateMermaid(name: string, transitions: { from: string; to: string }[]): string {
  const lines = [`stateDiagram-v2`, `    title: ${name}`];
  for (const t of transitions) {
    lines.push(`    ${t.from} --> ${t.to}`);
  }
  return lines.join('\n');
}

// ── Checks ──

export function runStateMachineValidation(): ReturnType<typeof buildReport> {
  const results: CheckResult[] = [];
  const mermaidDiagrams: string[] = [];

  // Parse catalog
  const smContent = fs.readFileSync(SM_CATALOG, 'utf-8');
  const catalogMachines = parseStateMachineCatalog(smContent);

  // Parse code state machines
  const serviceFiles = findFilesRecursive(MODULES_DIR, '.service.ts');
  const codeMachines = serviceFiles
    .map((f) => {
      const content = fs.readFileSync(f, 'utf-8');
      const transitions = parseTransitions(content, f);
      if (!transitions) return null;
      const fileName = path.basename(f);
      const catalogName = SERVICE_CATALOG_MAP[fileName] || fileName;
      return { ...transitions, catalogName, fileName };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  // WP3.1: Each VALID_*_TRANSITIONS has matching Catalog section
  const unmatchedCode: string[] = [];
  for (const cm of codeMachines) {
    const found = catalogMachines.find(
      (m) => m.name.toLowerCase().includes(cm.catalogName.toLowerCase().split(' ')[0]),
    );
    if (!found) {
      unmatchedCode.push(`${cm.fileName} (${cm.catalogName})`);
    }
  }
  results.push({
    id: 'WP3.1',
    description: 'Each code state machine has matching Catalog section',
    severity: unmatchedCode.length === 0 ? 'PASS' : 'FAIL',
    details:
      unmatchedCode.length > 0
        ? `Unmatched: ${unmatchedCode.join(', ')}`
        : `All ${codeMachines.length} code machines have catalog entries`,
  });

  // WP3.2 — WP3.6: Cross-reference transitions for matched machines
  const transitionIssues: string[] = [];

  for (const cm of codeMachines) {
    const catalogMachine = catalogMachines.find(
      (m) => m.name.toLowerCase().includes(cm.catalogName.toLowerCase().split(' ')[0]),
    );
    if (!catalogMachine) continue;

    const codeFromStates = new Set(Object.keys(cm.transitions));
    const codeToStates = new Set(
      Object.values(cm.transitions).flat(),
    );
    const catalogFromStates = new Set(catalogMachine.transitions.map((t) => t.from));
    const catalogToStates = new Set(catalogMachine.transitions.map((t) => t.to));

    // WP3.3: Catalog transitions present in code
    for (const ct of catalogMachine.transitions) {
      if (ct.to === '—' || ct.to === '' || ct.to === 'None') continue; // terminal
      const codeTargets = cm.transitions[ct.from] || [];
      if (!codeTargets.includes(ct.to)) {
        transitionIssues.push(`${cm.fileName}: catalog transition ${ct.from} -> ${ct.to} missing in code`);
      }
    }

    // WP3.4: Code transitions present in catalog
    for (const [from, targets] of Object.entries(cm.transitions)) {
      for (const to of targets) {
        const found = catalogMachine.transitions.some(
          (t) => t.from === from && t.to === to,
        );
        if (!found) {
          transitionIssues.push(`${cm.fileName}: code transition ${from} -> ${to} not in catalog`);
        }
      }
    }

    // WP3.5: Terminal states match
    const catalogTerminals = catalogMachine.terminalStates;
    const codeTerminals = Object.entries(cm.transitions)
      .filter(([_, targets]) => targets.length === 0)
      .map(([state]) => state);
    for (const ct of catalogTerminals) {
      if (!codeTerminals.includes(ct) && cm.transitions[ct] && cm.transitions[ct].length > 0) {
        transitionIssues.push(`${cm.fileName}: catalog terminal state ${ct} has code transitions`);
      }
    }

    // WP3.6: All enum values covered (no dead states)
    const allCodeStates = new Set([...codeFromStates, ...codeToStates]);
    const allCatalogStates = new Set([
      ...catalogFromStates,
      ...catalogToStates,
      ...catalogMachine.terminalStates,
    ]);
    for (const state of allCatalogStates) {
      if (state === '—' || state === '' || state === 'None') continue;
      if (!allCodeStates.has(state)) {
        transitionIssues.push(`${cm.fileName}: catalog state ${state} not in code transitions`);
      }
    }

    // WP3.7: Generate Mermaid diagram
    const allTransitions = catalogMachine.transitions
      .filter((t) => t.to !== '—' && t.to !== '' && t.to !== 'None')
      .map((t) => ({ from: t.from, to: t.to }));
    mermaidDiagrams.push(`## ${catalogMachine.name}\n\n${generateMermaid(catalogMachine.name, allTransitions)}\n`);
  }

  // Report WP3.2-WP3.6 combined
  results.push({
    id: 'WP3.2-3.6',
    description: 'Transition cross-reference (catalog vs code)',
    severity: transitionIssues.length === 0 ? 'PASS' : 'WARNING',
    details:
      transitionIssues.length > 0
        ? transitionIssues.join('; ')
        : `All ${codeMachines.length} machines have consistent transitions`,
  });

  // WP3.7: Mermaid diagrams generated
  results.push({
    id: 'WP3.7',
    description: 'Mermaid stateDiagram-v2 generated for each machine',
    severity: mermaidDiagrams.length > 0 ? 'PASS' : 'WARNING',
    details: `Generated ${mermaidDiagrams.length} diagrams`,
  });

  // Build report
  const report = buildReport('StateMachineValidation', results);

  // Write outputs
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  writeJSONReport('StateMachineValidation', report);
  writeMDReport('StateMachineValidation', report);

  // Write Mermaid diagrams
  const mermaidContent = `# State Machine Diagrams\n\n> Auto-generated by validate-state-machine.ts\n\n---\n\n${mermaidDiagrams.join('\n---\n\n')}`;
  fs.writeFileSync(path.join(REPORTS_DIR, 'StateMachineDiagrams.md'), mermaidContent, 'utf-8');

  return report;
}

// ── CLI Entry Point ──

if (require.main === module) {
  const report = runStateMachineValidation();
  console.log(
    `\nState Machine Validation: ${report.summary.pass} PASS, ${report.summary.fail} FAIL, ${report.summary.warn} WARN`,
  );
  process.exit(getExitCode(report));
}
