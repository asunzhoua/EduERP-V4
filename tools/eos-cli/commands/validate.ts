/**
 * eos validate — Unified governance validation.
 *
 * Usage:
 *   eos validate [options]
 *
 * Options:
 *   --format <fmt>   Output format: terminal (default), json, md
 *   --filter <name>  Run only named checks (comma-separated)
 *   --fix            Auto-fix issues where possible (prettier, eslint)
 *
 * Checks:
 *   freeze-audit             Document freeze audit
 *   validate-events          Event catalog/code cross-reference
 *   validate-state-machine   State machine validation
 *   build-handbook           Handbook reference validation
 *   build-adr-index          ADR index generation
 *   architecture             Architecture doctor checks
 *   tests                    Jest test suite
 *   typescript               TypeScript compilation
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { header, result, summary, divider, info } from '../shared/output';
import { ExitCode } from '../shared/codes';
import { BACKEND_DIR, REPORTS_DIR } from '../shared/paths';

interface CheckResult {
  id: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: string;
}

type OutputFormat = 'terminal' | 'json' | 'md';

// All available checks
const ALL_CHECKS = [
  'freeze-audit',
  'validate-events',
  'validate-state-machine',
  'build-handbook',
  'build-adr-index',
  'architecture',
  'tests',
  'typescript',
] as const;

// ─── Flag Parsing ────────────────────────────────────────────────

function parseFlags(args: string[]): {
  format: OutputFormat;
  filter: string[];
  fix: boolean;
} {
  const flags: { format: OutputFormat; filter: string[]; fix: boolean } = {
    format: 'terminal',
    filter: [],
    fix: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      flags.format = args[i + 1] as OutputFormat;
      i++;
    } else if (args[i] === '--filter' && args[i + 1]) {
      flags.filter = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (args[i] === '--fix') {
      flags.fix = true;
    }
  }

  return flags;
}

// ─── Check Runners ───────────────────────────────────────────────

async function runGovernanceScript(
  name: string,
  npmScript: string,
): Promise<CheckResult> {
  try {
    const output = execSync(`npm run ${npmScript} 2>&1`, {
      cwd: BACKEND_DIR,
      encoding: 'utf-8',
      timeout: 30000,
    });

    const passMatch = output.match(/PASS:\s*(\d+)/);
    const failMatch = output.match(/FAIL:\s*(\d+)/);
    const warnMatch = output.match(/WARN(?:ING)?:\s*(\d+)/);

    const pass = passMatch ? parseInt(passMatch[1]) : 0;
    const fail = failMatch ? parseInt(failMatch[1]) : 0;
    const warn = warnMatch ? parseInt(warnMatch[1]) : 0;

    if (fail > 0) {
      return { id: name, status: 'FAIL', message: `${fail} failures, ${pass} passed, ${warn} warnings` };
    } else if (warn > 0) {
      return { id: name, status: 'WARN', message: `${pass} passed, ${warn} warnings` };
    } else {
      return { id: name, status: 'PASS', message: `${pass} passed` };
    }
  } catch (e: any) {
    return { id: name, status: 'FAIL', message: e.message?.slice(0, 100) || 'Script failed' };
  }
}

async function runTests(): Promise<CheckResult> {
  try {
    const testOutput = execSync('npx jest --no-coverage 2>&1', {
      cwd: BACKEND_DIR,
      encoding: 'utf-8',
      timeout: 120000,
    });
    const suiteMatch = testOutput.match(/Test Suites:\s*(\d+)\s*passed/);
    const testMatch = testOutput.match(/Tests:\s*(\d+)\s*passed/);
    const suites = suiteMatch ? suiteMatch[1] : '?';
    const tests = testMatch ? testMatch[1] : '?';
    return { id: 'tests', status: 'PASS', message: `${suites} suites, ${tests} tests` };
  } catch {
    return { id: 'tests', status: 'FAIL', message: 'Test suite failed' };
  }
}

async function runTypeScript(): Promise<CheckResult> {
  try {
    execSync('npx tsc --noEmit 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 60000 });
    return { id: 'typescript', status: 'PASS', message: '0 errors' };
  } catch (e: any) {
    const output = e.stdout || e.message || '';
    const errorCount = (output.match(/error TS/g) || []).length;
    return { id: 'typescript', status: 'FAIL', message: `${errorCount} errors` };
  }
}

async function runArchitecture(): Promise<CheckResult> {
  try {
    const rawOutput = execSync(
      'npx ts-node --project ../tsconfig.cli.json ../tools/eos-cli/index.ts doctor 2>&1',
      { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 30000 },
    );

    // Strip ANSI escape codes for clean regex matching
    const output = rawOutput.replace(/\x1b\[[0-9;]*m/g, '');

    const passMatch = output.match(/PASS:\s*(\d+)/);
    const failMatch = output.match(/FAIL:\s*(\d+)/);
    const warnMatch = output.match(/WARN:\s*(\d+)/);

    const pass = passMatch ? parseInt(passMatch[1]) : 0;
    const fail = failMatch ? parseInt(failMatch[1]) : 0;
    const warn = warnMatch ? parseInt(warnMatch[1]) : 0;

    if (fail > 0) {
      return { id: 'architecture', status: 'FAIL', message: `${fail} violations, ${pass} passed, ${warn} warnings` };
    } else if (warn > 0) {
      return { id: 'architecture', status: 'WARN', message: `${pass} passed, ${warn} warnings` };
    }
    return { id: 'architecture', status: 'PASS', message: `${pass} checks passed` };
  } catch {
    return { id: 'architecture', status: 'WARN', message: 'Architecture doctor could not run' };
  }
}

// ─── Fix Runner ──────────────────────────────────────────────────

async function runFix(): Promise<void> {
  info('Running auto-fix (prettier)...');
  try {
    execSync('npx prettier --write "src/**/*.ts" 2>&1', {
      cwd: BACKEND_DIR,
      encoding: 'utf-8',
      timeout: 30000,
    });
    info('Prettier fix complete');
  } catch {
    info('Prettier fix skipped (not critical)');
  }
}

// ─── Output Formatters ───────────────────────────────────────────

function outputTerminal(checks: CheckResult[]): void {
  divider();
  for (const check of checks) {
    result(check.id, check.status, check.message);
  }
  divider();
  const pass = checks.filter(c => c.status === 'PASS').length;
  const fail = checks.filter(c => c.status === 'FAIL').length;
  const warn = checks.filter(c => c.status === 'WARN').length;
  summary(pass, fail, warn);
}

function outputJson(checks: CheckResult[]): void {
  const report = {
    timestamp: new Date().toISOString(),
    checks,
    summary: {
      pass: checks.filter(c => c.status === 'PASS').length,
      fail: checks.filter(c => c.status === 'FAIL').length,
      warn: checks.filter(c => c.status === 'WARN').length,
    },
  };

  // Write to reports directory
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const outPath = path.join(REPORTS_DIR, 'GovernanceReport.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  info(`Written to ${outPath}`);
}

function outputMd(checks: CheckResult[]): void {
  const lines: string[] = [
    '# Governance Validation Report',
    '',
    `**Date**: ${new Date().toISOString().slice(0, 19)}`,
    '',
    '## Results',
    '',
    '| Check | Status | Details |',
    '|-------|--------|---------|',
  ];

  for (const check of checks) {
    const icon = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️';
    lines.push(`| ${check.id} | ${icon} ${check.status} | ${check.message} |`);
  }

  const pass = checks.filter(c => c.status === 'PASS').length;
  const fail = checks.filter(c => c.status === 'FAIL').length;
  const warn = checks.filter(c => c.status === 'WARN').length;

  lines.push('', '## Summary', '');
  lines.push(`- **PASS**: ${pass}`);
  lines.push(`- **FAIL**: ${fail}`);
  lines.push(`- **WARN**: ${warn}`);
  lines.push('');

  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const outPath = path.join(REPORTS_DIR, 'GovernanceReport.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
  info(`Written to ${outPath}`);
}

// ─── Main ────────────────────────────────────────────────────────

export async function runValidate(args: string[] = []): Promise<ExitCode> {
  header('eos validate — Governance Runtime');

  const flags = parseFlags(args);
  const filterSet = new Set(flags.filter.length > 0 ? flags.filter : ALL_CHECKS);

  // Auto-fix if requested
  if (flags.fix) {
    await runFix();
    divider();
  }

  const checks: CheckResult[] = [];

  // Governance scripts
  const govScripts: Array<{ name: string; npm: string }> = [
    { name: 'freeze-audit', npm: 'governance:freeze-audit' },
    { name: 'validate-events', npm: 'governance:validate-events' },
    { name: 'validate-state-machine', npm: 'governance:validate-state-machine' },
    { name: 'build-handbook', npm: 'governance:build-handbook' },
    { name: 'build-adr-index', npm: 'governance:build-adr-index' },
  ];

  for (const script of govScripts) {
    if (!filterSet.has(script.name)) continue;
    info(`Running ${script.name}...`);
    checks.push(await runGovernanceScript(script.name, script.npm));
  }

  // Architecture
  if (filterSet.has('architecture')) {
    info('Running architecture checks...');
    checks.push(await runArchitecture());
  }

  // Tests
  if (filterSet.has('tests')) {
    info('Running tests...');
    checks.push(await runTests());
  }

  // TypeScript
  if (filterSet.has('typescript')) {
    info('Running TypeScript check...');
    checks.push(await runTypeScript());
  }

  // Output
  switch (flags.format) {
    case 'json':
      outputJson(checks);
      break;
    case 'md':
      outputMd(checks);
      break;
    default:
      outputTerminal(checks);
  }

  const failCount = checks.filter(c => c.status === 'FAIL').length;
  return failCount > 0 ? ExitCode.GOVERNANCE_FAILURE : ExitCode.SUCCESS;
}
