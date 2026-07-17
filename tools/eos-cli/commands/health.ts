/**
 * eos health — Repository Health with Telemetry.
 *
 * Usage:
 *   eos health [options]
 *
 * Options:
 *   --reports      Generate detailed health reports to reports/
 *   --format <f>   Output format: terminal (default), json, md
 *
 * Scoring Categories (each 0-10):
 *   TypeScript     Compilation health
 *   Tests          Test suite health
 *   Governance     Governance check results
 *   Architecture   Architecture compliance
 *   Documentation  Knowledge system completeness
 *
 * Total Score: weighted average (max 100)
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { header, result, summary, divider, info } from '../shared/output';
import { ExitCode } from '../shared/codes';
import { REPORTS_DIR, BACKEND_DIR, DOCS_DIR, BACKEND_SRC, PROJECT_ROOT } from '../shared/paths';

interface HealthCheck {
  category: string;
  score: number;
  max: number;
  details: string;
  items: Array<{ name: string; score: number; detail: string }>;
}

type OutputFormat = 'terminal' | 'json' | 'md';

// ─── Flag Parsing ────────────────────────────────────────────────

function parseFlags(args: string[]): { reports: boolean; format: OutputFormat } {
  const flags = { reports: false, format: 'terminal' as OutputFormat };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--reports') flags.reports = true;
    if (args[i] === '--format' && args[i + 1]) { flags.format = args[i + 1] as OutputFormat; i++; }
  }
  return flags;
}

// ─── Helpers ─────────────────────────────────────────────────────

function countFiles(dir: string, ext: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist'].includes(entry.name)) {
      count += countFiles(full, ext);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      count++;
    }
  }
  return count;
}

// ─── Health Checks ───────────────────────────────────────────────

function checkTypeScript(): HealthCheck {
  const items: HealthCheck['items'] = [];

  try {
    execSync('npx tsc --noEmit 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 60000 });
    items.push({ name: 'Compilation', score: 10, detail: '0 errors' });
  } catch (e: any) {
    const output = e.stdout || '';
    const errors = (output.match(/error TS/g) || []).length;
    items.push({ name: 'Compilation', score: Math.max(0, 10 - errors), detail: `${errors} errors` });
  }

  // Check for tsconfig issues
  const tsconfigPath = path.join(BACKEND_DIR, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    items.push({ name: 'tsconfig.json', score: 10, detail: 'Exists' });
  } else {
    items.push({ name: 'tsconfig.json', score: 0, detail: 'Missing' });
  }

  const score = items.reduce((s, i) => s + i.score, 0);
  return { category: 'TypeScript', score, max: items.length * 10, details: items.map(i => i.detail).join(', '), items };
}

function checkTests(): HealthCheck {
  const items: HealthCheck['items'] = [];

  try {
    const out = execSync('npx jest --no-coverage 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 120000 });
    const suiteMatch = out.match(/Test Suites:\s*(\d+)\s*passed/);
    const testMatch = out.match(/Tests:\s*(\d+)\s*passed/);
    const suites = suiteMatch ? parseInt(suiteMatch[1]) : 0;
    const tests = testMatch ? parseInt(testMatch[1]) : 0;

    items.push({ name: 'Suite Count', score: Math.min(10, Math.round(suites / 1.5)), detail: `${suites} suites` });
    items.push({ name: 'Test Count', score: Math.min(10, Math.round(tests / 20)), detail: `${tests} tests` });
    items.push({ name: 'Pass Rate', score: 10, detail: '100%' });
  } catch {
    items.push({ name: 'Suite Count', score: 0, detail: 'Tests failing' });
    items.push({ name: 'Test Count', score: 0, detail: 'Tests failing' });
    items.push({ name: 'Pass Rate', score: 0, detail: 'Tests failing' });
  }

  // Test file coverage
  const tsFiles = countFiles(BACKEND_SRC, '.ts');
  const specFiles = countFiles(BACKEND_SRC, '.spec.ts');
  const ratio = specFiles / Math.max(tsFiles, 1);
  items.push({ name: 'File Coverage', score: Math.min(10, Math.round(ratio * 50)), detail: `${specFiles}/${tsFiles} (${(ratio * 100).toFixed(1)}%)` });

  const score = items.reduce((s, i) => s + i.score, 0);
  return { category: 'Tests', score, max: items.length * 10, details: items.map(i => i.detail).join(', '), items };
}

function checkGovernance(): HealthCheck {
  const items: HealthCheck['items'] = [];

  // Check governance report
  const reportPath = path.join(REPORTS_DIR, 'GovernanceReport.json');
  if (fs.existsSync(reportPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      const pass = report.summary?.pass || 0;
      const fail = report.summary?.fail || 0;
      const warn = report.summary?.warn || 0;
      items.push({ name: 'Report Exists', score: 10, detail: `${pass} PASS, ${fail} FAIL, ${warn} WARN` });
      items.push({ name: 'No Failures', score: fail === 0 ? 10 : Math.max(0, 10 - fail * 3), detail: `${fail} failures` });
    } catch {
      items.push({ name: 'Report Exists', score: 5, detail: 'Could not parse' });
    }
  } else {
    items.push({ name: 'Report Exists', score: 0, detail: 'Not found (run eos validate)' });
  }

  // Check governance documents (in various subdirectories under docs/)
  const docPaths = [
    'EventCatalog/EventCatalog.md',
    'EventCatalog/EventSchema.md',
    'StateMachine/StateMachineCatalog.md',
    'architecture/ArchitectureHandbook.md',
  ];
  let docsExist = 0;
  for (const doc of docPaths) {
    if (fs.existsSync(path.join(DOCS_DIR, doc))) docsExist++;
  }
  items.push({ name: 'Gov Documents', score: Math.round((docsExist / docPaths.length) * 10), detail: `${docsExist}/${docPaths.length} exist` });

  // Check ADRs
  const adrDir = path.join(DOCS_DIR, 'DecisionLog');
  if (fs.existsSync(adrDir)) {
    const adrs = fs.readdirSync(adrDir).filter(f => f.startsWith('ADR-') && f.endsWith('.md'));
    items.push({ name: 'ADRs', score: Math.min(10, adrs.length), detail: `${adrs.length} ADRs` });
  } else {
    items.push({ name: 'ADRs', score: 0, detail: 'No DecisionLog directory' });
  }

  const score = items.reduce((s, i) => s + i.score, 0);
  return { category: 'Governance', score, max: items.length * 10, details: items.map(i => i.detail).join(', '), items };
}

function checkArchitecture(): HealthCheck {
  const items: HealthCheck['items'] = [];

  // Run architecture doctor
  try {
    const output = execSync(
      'npx ts-node --project ../tsconfig.cli.json ../tools/eos-cli/index.ts doctor 2>&1',
      { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 30000 },
    );

    const failMatch = output.match(/FAIL:\s*(\d+)/);
    const warnMatch = output.match(/WARN:\s*(\d+)/);
    const passMatch = output.match(/PASS:\s*(\d+)/);

    const fail = failMatch ? parseInt(failMatch[1]) : 0;
    const warn = warnMatch ? parseInt(warnMatch[1]) : 0;
    const pass = passMatch ? parseInt(passMatch[1]) : 0;

    items.push({ name: 'DDD Compliance', score: fail === 0 ? 10 : Math.max(0, 10 - fail * 3), detail: `${pass} PASS, ${fail} FAIL, ${warn} WARN` });
  } catch {
    items.push({ name: 'DDD Compliance', score: 5, detail: 'Doctor could not run' });
  }

  // Module count
  const modulesDir = path.join(BACKEND_SRC, 'modules');
  if (fs.existsSync(modulesDir)) {
    const mods = fs.readdirSync(modulesDir, { withFileTypes: true }).filter(d => d.isDirectory()).length;
    items.push({ name: 'Module Count', score: Math.min(10, mods), detail: `${mods} modules` });
  }

  // Repository count
  const repos = countFiles(BACKEND_SRC, '.repository.ts');
  items.push({ name: 'Repository Layer', score: Math.min(10, repos), detail: `${repos} repositories` });

  const score = items.reduce((s, i) => s + i.score, 0);
  return { category: 'Architecture', score, max: items.length * 10, details: items.map(i => i.detail).join(', '), items };
}

function checkDocumentation(): HealthCheck {
  const items: HealthCheck['items'] = [];

  // Knowledge artifacts
  const knowledgeDir = path.join(DOCS_DIR, 'governance', 'knowledge');
  if (fs.existsSync(knowledgeDir)) {
    const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));
    items.push({ name: 'Knowledge Files', score: Math.min(10, files.length), detail: `${files.length} files` });

    // Check if recent
    let newest = 0;
    for (const f of files) {
      const stat = fs.statSync(path.join(knowledgeDir, f));
      if (stat.mtimeMs > newest) newest = stat.mtimeMs;
    }
    const ageHours = Math.floor((Date.now() - newest) / (1000 * 60 * 60));
    items.push({ name: 'Knowledge Freshness', score: ageHours < 24 ? 10 : ageHours < 168 ? 7 : 3, detail: `${ageHours}h old` });
  } else {
    items.push({ name: 'Knowledge Files', score: 0, detail: 'No knowledge directory' });
  }

  // README
  const readmePath = path.join(PROJECT_ROOT, 'README.md');
  items.push({ name: 'README', score: fs.existsSync(readmePath) ? 10 : 0, detail: fs.existsSync(readmePath) ? 'Exists' : 'Missing' });

  // Docs directory
  const docsDir = path.join(PROJECT_ROOT, 'docs');
  if (fs.existsSync(docsDir)) {
    const docFiles = countFiles(docsDir, '.md');
    items.push({ name: 'Documentation Files', score: Math.min(10, Math.round(docFiles / 10)), detail: `${docFiles} docs` });
  }

  const score = items.reduce((s, i) => s + i.score, 0);
  return { category: 'Documentation', score, max: items.length * 10, details: items.map(i => i.detail).join(', '), items };
}

// ─── Report Writers ──────────────────────────────────────────────

function writeJsonReport(checks: HealthCheck[]): void {
  const totalScore = checks.reduce((s, c) => s + c.score, 0);
  const totalMax = checks.reduce((s, c) => s + c.max, 0);

  const report = {
    timestamp: new Date().toISOString(),
    healthScore: Math.round((totalScore / totalMax) * 100),
    categories: checks.map(c => ({
      category: c.category,
      score: c.score,
      max: c.max,
      percentage: Math.round((c.score / c.max) * 100),
      details: c.details,
      items: c.items,
    })),
  };

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, 'HealthReport.json'), JSON.stringify(report, null, 2), 'utf-8');
  info('Written to reports/HealthReport.json');
}

function writeMdReport(checks: HealthCheck[]): void {
  const totalScore = checks.reduce((s, c) => s + c.score, 0);
  const totalMax = checks.reduce((s, c) => s + c.max, 0);

  const lines = [
    '# Repository Health Report',
    '',
    `**Date**: ${new Date().toISOString().slice(0, 19)}`,
    `**Health Score**: ${Math.round((totalScore / totalMax) * 100)}/100`,
    '',
    '## Categories',
    '',
    '| Category | Score | Percentage | Details |',
    '|----------|-------|------------|---------|',
  ];

  for (const c of checks) {
    const pct = Math.round((c.score / c.max) * 100);
    const icon = pct >= 80 ? '✅' : pct >= 50 ? '⚠️' : '❌';
    lines.push(`| ${icon} ${c.category} | ${c.score}/${c.max} | ${pct}% | ${c.details} |`);
  }

  lines.push('', '## Detailed Breakdown', '');

  for (const c of checks) {
    lines.push(`### ${c.category}`, '');
    for (const item of c.items) {
      const icon = item.score >= 8 ? '✅' : item.score >= 5 ? '⚠️' : '❌';
      lines.push(`- ${icon} **${item.name}**: ${item.detail} (${item.score}/10)`);
    }
    lines.push('');
  }

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, 'HealthReport.md'), lines.join('\n'), 'utf-8');
  info('Written to reports/HealthReport.md');
}

// ─── Main ────────────────────────────────────────────────────────

export async function runHealth(args: string[] = []): Promise<ExitCode> {
  header('eos health — Repository Health');

  const flags = parseFlags(args);

  const checks: HealthCheck[] = [];

  info('Running health checks...');
  checks.push(checkTypeScript());
  checks.push(checkTests());
  checks.push(checkGovernance());
  checks.push(checkArchitecture());
  checks.push(checkDocumentation());

  // Output
  divider();
  let totalScore = 0;
  let totalMax = 0;

  for (const check of checks) {
    const pct = Math.round((check.score / check.max) * 100);
    const severity = pct >= 80 ? 'PASS' : pct >= 50 ? 'WARN' : 'FAIL';
    result(check.category, severity, `${check.score}/${check.max} (${pct}%) — ${check.details}`);
    totalScore += check.score;
    totalMax += check.max;
  }

  const healthScore = Math.round((totalScore / totalMax) * 100);
  divider();
  console.log(`  📊 Health Score: ${healthScore}/100`);

  // Generate reports if requested
  if (flags.reports) {
    divider();
    writeJsonReport(checks);
    writeMdReport(checks);
  }

  summary(
    checks.filter(c => c.score >= c.max * 0.8).length,
    checks.filter(c => c.score < c.max * 0.5).length,
    checks.filter(c => c.score >= c.max * 0.5 && c.score < c.max * 0.8).length,
  );

  return healthScore >= 80 ? ExitCode.SUCCESS : ExitCode.GENERAL_ERROR;
}
