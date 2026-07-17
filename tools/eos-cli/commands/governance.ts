/**
 * eos governance — Self Governance Engine
 *
 * Usage:
 *   eos governance init                    Initialize .governance/ structure
 *   eos governance issue list              List all issues
 *   eos governance issue add <title>       Add a new issue
 *   eos governance issue close <id>        Close an issue
 *   eos governance debt list               List all debt items
 *   eos governance debt add <title>        Add a new debt item
 *   eos governance debt resolve <id>       Resolve a debt item
 *   eos governance decisions review        Review all ADRs
 *   eos governance snapshot                Take repository snapshot
 *   eos governance summary                 Show governance summary
 *   eos governance next-mission            Generate next mission suggestion
 */
import * as fs from 'fs';
import * as path from 'path';
import { ExitCode } from '../shared/codes';
import { header, result, divider, info, error } from '../shared/output';
import { AUDIT_DIR } from '../shared/paths';
import type {
  Issue, IssuePriority, IssueStatus, IssueCategory,
  DebtItem, DebtSeverity, DebtCategory, DebtStatus,
  DecisionRecord, DecisionVerdict,
  EvolutionEntry, RepoSnapshot,
} from '../shared/governance-types';

// ── Paths ───────────────────────────────────────────────────────

const GOV_DIR = path.resolve(AUDIT_DIR, '..', '.governance');
const ISSUES_DIR = path.join(GOV_DIR, 'issues');
const DEBT_DIR = path.join(GOV_DIR, 'debt');
const DECISIONS_DIR = path.join(GOV_DIR, 'decisions');
const EVOLUTION_DIR = path.join(GOV_DIR, 'evolution');
const SNAPSHOTS_FILE = path.join(GOV_DIR, 'snapshots.json');

function ensureDirs(): void {
  for (const dir of [GOV_DIR, ISSUES_DIR, DEBT_DIR, DECISIONS_DIR, EVOLUTION_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function loadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveJson(filePath: string, data: unknown): void {
  ensureDirs();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadAll<T>(dir: string): T[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

function nextId(prefix: string, items: { id: string }[]): string {
  let max = 0;
  for (const item of items) {
    const match = item.id.match(new RegExp(`${prefix}-(\\d+)`));
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

// ── Issue Commands ──────────────────────────────────────────────

function listIssues(): void {
  const issues = loadAll<Issue>(ISSUES_DIR);
  if (issues.length === 0) {
    info('No issues tracked.');
    return;
  }

  divider();
  const open = issues.filter(i => i.status !== 'closed').length;
  const closed = issues.filter(i => i.status === 'closed').length;
  console.log(`  Issues: ${issues.length} total, ${open} open, ${closed} closed\n`);

  for (const issue of issues.sort((a, b) => {
    const pOrder = { P1: 0, P2: 1, P3: 2 };
    return pOrder[a.priority] - pOrder[b.priority];
  })) {
    const icon = issue.priority === 'P1' ? '🔴' : issue.priority === 'P2' ? '🟡' : '🔵';
    const statusIcon = issue.status === 'closed' ? '✅' : issue.status === 'resolved' ? '🔧' : '📋';
    result(issue.id, issue.status === 'closed' ? 'PASS' : issue.priority === 'P1' ? 'FAIL' : 'INFO',
      `${icon} ${statusIcon} [${issue.priority}] ${issue.title} (${issue.status})`);
  }
}

function addIssue(title: string, priority: IssuePriority = 'P2', category: IssueCategory = 'quality', location: string = '', description: string = ''): Issue {
  const issues = loadAll<Issue>(ISSUES_DIR);
  const id = nextId('ISS', issues);

  const issue: Issue = {
    id,
    title,
    priority,
    status: 'open',
    category,
    description: description || title,
    location: location || 'unknown',
    discoveredAt: new Date().toISOString(),
    discoveredBy: 'eos governance',
    history: [{
      timestamp: new Date().toISOString(),
      action: 'created',
      to: 'open',
    }],
  };

  saveJson(path.join(ISSUES_DIR, `${id}.json`), issue);
  result(id, 'PASS', `Issue created: [${priority}] ${title}`);
  return issue;
}

function closeIssue(id: string): void {
  const filePath = path.join(ISSUES_DIR, `${id}.json`);
  const issue = loadJson<Issue>(filePath);
  if (!issue) { error(`Issue not found: ${id}`); return; }

  issue.status = 'closed';
  issue.resolvedAt = new Date().toISOString();
  issue.history.push({
    timestamp: new Date().toISOString(),
    action: 'closed',
    from: issue.status,
    to: 'closed',
  });

  saveJson(filePath, issue);
  result(id, 'PASS', `Issue closed: ${issue.title}`);
}

// ── Debt Commands ───────────────────────────────────────────────

function listDebt(): void {
  const items = loadAll<DebtItem>(DEBT_DIR);
  if (items.length === 0) {
    info('No debt items tracked.');
    return;
  }

  divider();
  const active = items.filter(d => d.status !== 'resolved' && d.status !== 'wont-fix').length;
  console.log(`  Debt Items: ${items.length} total, ${active} active\n`);

  for (const item of items.sort((a, b) => {
    const sOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return sOrder[a.severity] - sOrder[b.severity];
  })) {
    const icon = item.severity === 'critical' ? '🔴' : item.severity === 'high' ? '🟠' : item.severity === 'medium' ? '🟡' : '🔵';
    const statusIcon = item.status === 'resolved' ? '✅' : item.status === 'wont-fix' ? '🚫' : '📋';
    result(item.id, item.severity === 'critical' ? 'FAIL' : 'INFO',
      `${icon} ${statusIcon} [${item.severity}] ${item.title} (${item.status})`);
  }
}

function addDebt(title: string, severity: DebtSeverity = 'medium', category: DebtCategory = 'code', location: string = '', reason: string = '', impact: string = '', cost: string = ''): DebtItem {
  const items = loadAll<DebtItem>(DEBT_DIR);
  const id = nextId('DEBT', items);

  const debt: DebtItem = {
    id,
    title,
    severity,
    category,
    status: 'identified',
    description: title,
    location: location || 'unknown',
    reason: reason || 'Identified during governance scan',
    impact: impact || 'Unknown impact',
    estimatedCost: cost || 'Unknown',
    discoveredAt: new Date().toISOString(),
    history: [{
      timestamp: new Date().toISOString(),
      action: 'identified',
    }],
  };

  saveJson(path.join(DEBT_DIR, `${id}.json`), debt);
  result(id, 'PASS', `Debt item created: [${severity}] ${title}`);
  return debt;
}

function resolveDebt(id: string): void {
  const filePath = path.join(DEBT_DIR, `${id}.json`);
  const debt = loadJson<DebtItem>(filePath);
  if (!debt) { error(`Debt item not found: ${id}`); return; }

  debt.status = 'resolved';
  debt.history.push({
    timestamp: new Date().toISOString(),
    action: 'resolved',
  });

  saveJson(filePath, debt);
  result(id, 'PASS', `Debt resolved: ${debt.title}`);
}

// ── Snapshot Command ────────────────────────────────────────────

function takeSnapshot(): RepoSnapshot {
  const projectRoot = path.resolve(AUDIT_DIR, '..');
  const backendSrc = path.join(projectRoot, 'backend', 'src');

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

  function countLines(dir: string, ext: string): number {
    if (!fs.existsSync(dir)) return 0;
    let lines = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', 'dist'].includes(entry.name)) {
        lines += countLines(full, ext);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        try {
          const content = fs.readFileSync(full, 'utf-8');
          lines += content.split('\n').length;
        } catch { /* skip unreadable */ }
      }
    }
    return lines;
  }

  const modulesDir = path.join(backendSrc, 'modules');
  const modules = fs.existsSync(modulesDir)
    ? fs.readdirSync(modulesDir, { withFileTypes: true }).filter(d => d.isDirectory()).length
    : 0;

  // Count empty dirs (only .gitkeep)
  let emptyDirs = 0;
  function checkEmptyDirs(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = entries.filter(e => e.isFile());
    const dirs = entries.filter(e => e.isDirectory());
    if (files.length === 1 && files[0].name === '.gitkeep' && dirs.length === 0) {
      emptyDirs++;
    }
    for (const d of dirs) {
      if (!['node_modules', 'dist'].includes(d.name)) {
        checkEmptyDirs(path.join(dir, d.name));
      }
    }
  }
  checkEmptyDirs(backendSrc);

  // Count test cases
  let testCases = 0;
  function countTests(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !['node_modules', 'dist'].includes(entry.name)) {
        countTests(full);
      } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
        try {
          const content = fs.readFileSync(full, 'utf-8');
          testCases += (content.match(/\b(it|test)\s*\(/g) || []).length;
        } catch { /* skip */ }
      }
    }
  }
  countTests(backendSrc);

  const snapshot: RepoSnapshot = {
    timestamp: new Date().toISOString(),
    metrics: {
      backendTsFiles: countFiles(backendSrc, '.ts') - countFiles(backendSrc, '.spec.ts'),
      backendSpecFiles: countFiles(backendSrc, '.spec.ts'),
      backendTsLines: countLines(backendSrc, '.ts') - countLines(backendSrc, '.spec.ts'),
      cliTsFiles: countFiles(path.join(projectRoot, 'tools', 'eos-cli'), '.ts'),
      cliTsLines: countLines(path.join(projectRoot, 'tools', 'eos-cli'), '.ts'),
      governanceTsFiles: countFiles(path.join(projectRoot, 'scripts', 'governance'), '.ts'),
      governanceTsLines: countLines(path.join(projectRoot, 'scripts', 'governance'), '.ts'),
      docsMdFiles: countFiles(path.join(projectRoot, 'docs'), '.md'),
      templateFiles: countFiles(path.join(projectRoot, 'tools', 'eos-cli', 'generators', 'templates'), '.ts') + countFiles(path.join(projectRoot, 'tools', 'eos-cli', 'generators', 'templates'), '.md'),
      testSuites: countFiles(backendSrc, '.spec.ts'),
      testCases,
      modules,
      emptyDirs,
      healthScore: 0, // filled by health check
      duplicateFunctions: 0,
      duplicateFiles: 0,
    },
  };

  // Append to snapshots
  let snapshots: RepoSnapshot[] = [];
  if (fs.existsSync(SNAPSHOTS_FILE)) {
    snapshots = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf-8'));
  }
  snapshots.push(snapshot);
  saveJson(SNAPSHOTS_FILE, snapshots);

  return snapshot;
}

// ── Summary Command ─────────────────────────────────────────────

function showSummary(): void {
  const issues = loadAll<Issue>(ISSUES_DIR);
  const debt = loadAll<DebtItem>(DEBT_DIR);

  divider();
  console.log('  Self Governance Summary\n');

  // Issues
  const openP1 = issues.filter(i => i.priority === 'P1' && i.status !== 'closed').length;
  const openP2 = issues.filter(i => i.priority === 'P2' && i.status !== 'closed').length;
  const openP3 = issues.filter(i => i.priority === 'P3' && i.status !== 'closed').length;
  const totalClosed = issues.filter(i => i.status === 'closed').length;

  result('Issues', openP1 > 0 ? 'FAIL' : openP2 > 0 ? 'WARN' : 'PASS',
    `${issues.length} total — P1: ${openP1}, P2: ${openP2}, P3: ${openP3}, Closed: ${totalClosed}`);

  // Debt
  const criticalDebt = debt.filter(d => d.severity === 'critical' && d.status !== 'resolved').length;
  const highDebt = debt.filter(d => d.severity === 'high' && d.status !== 'resolved').length;
  const resolvedDebt = debt.filter(d => d.status === 'resolved').length;

  result('Debt', criticalDebt > 0 ? 'FAIL' : highDebt > 0 ? 'WARN' : 'PASS',
    `${debt.length} total — Critical: ${criticalDebt}, High: ${highDebt}, Resolved: ${resolvedDebt}`);

  // Snapshots
  if (fs.existsSync(SNAPSHOTS_FILE)) {
    const snapshots: RepoSnapshot[] = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf-8'));
    result('Snapshots', 'INFO', `${snapshots.length} snapshots recorded`);
    if (snapshots.length >= 2) {
      const first = snapshots[0].metrics;
      const last = snapshots[snapshots.length - 1].metrics;
      const filesDiff = last.backendTsFiles - first.backendTsFiles;
      const linesDiff = last.backendTsLines - first.backendTsLines;
      result('Trend', filesDiff <= 0 && linesDiff <= 0 ? 'PASS' : 'WARN',
        `Files: ${filesDiff >= 0 ? '+' : ''}${filesDiff}, Lines: ${linesDiff >= 0 ? '+' : ''}${linesDiff}`);
    }
  }

  divider();
}

// ── Flag Parsing ────────────────────────────────────────────────

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

// ── Main ────────────────────────────────────────────────────────

export async function runGovernance(args: string[] = []): Promise<ExitCode> {
  header('eos governance — Self Governance Engine');

  const subcommand = args[0] || 'summary';
  const sub2 = args[1] || '';
  const flags = parseFlags(args.slice(2));

  switch (subcommand) {
    case 'init':
      ensureDirs();
      result('INIT', 'PASS', '.governance/ structure initialized');
      break;

    case 'issue':
      switch (sub2) {
        case 'list': listIssues(); break;
        case 'add': {
          const title = args[2];
          if (!title) { error('Usage: eos governance issue add <title> [--priority P1|P2|P3] [--category bug|quality|...]'); return ExitCode.GENERAL_ERROR; }
          addIssue(title, (flags.priority as IssuePriority) || 'P2', (flags.category as IssueCategory) || 'quality', flags.location || '', flags.description || '');
          break;
        }
        case 'close': {
          const id = args[2];
          if (!id) { error('Usage: eos governance issue close <id>'); return ExitCode.GENERAL_ERROR; }
          closeIssue(id);
          break;
        }
        default:
          error('Usage: eos governance issue <list|add|close>');
          return ExitCode.GENERAL_ERROR;
      }
      break;

    case 'debt':
      switch (sub2) {
        case 'list': listDebt(); break;
        case 'add': {
          const title = args[2];
          if (!title) { error('Usage: eos governance debt add <title> [--severity critical|high|medium|low]'); return ExitCode.GENERAL_ERROR; }
          addDebt(title, (flags.severity as DebtSeverity) || 'medium', (flags.category as DebtCategory) || 'code', flags.location || '', flags.reason || '', flags.impact || '', flags.cost || '');
          break;
        }
        case 'resolve': {
          const id = args[2];
          if (!id) { error('Usage: eos governance debt resolve <id>'); return ExitCode.GENERAL_ERROR; }
          resolveDebt(id);
          break;
        }
        default:
          error('Usage: eos governance debt <list|add|resolve>');
          return ExitCode.GENERAL_ERROR;
      }
      break;

    case 'snapshot':
      ensureDirs();
      const snap = takeSnapshot();
      result('SNAPSHOT', 'PASS', `Captured: ${snap.metrics.backendTsFiles} TS files, ${snap.metrics.backendTsLines} lines, ${snap.metrics.testCases} tests`);
      break;

    case 'summary':
      ensureDirs();
      showSummary();
      break;

    default:
      error(`Unknown subcommand: ${subcommand}`);
      console.log('Available: init, issue, debt, snapshot, summary');
      return ExitCode.GENERAL_ERROR;
  }

  return ExitCode.SUCCESS;
}
