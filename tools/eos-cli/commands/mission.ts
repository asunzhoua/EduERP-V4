/**
 * eos mission — Mission Runtime.
 *
 * Usage:
 *   eos mission list                    List all missions
 *   eos mission status <id>             Show mission status
 *   eos mission run <id>                Run a mission
 *   eos mission retry <id>              Retry a failed mission
 *   eos mission checkpoint <id>         Save checkpoint
 *   eos mission resume <id>             Resume from checkpoint
 *   eos mission ledger                  Show progress ledger
 *
 * Mission File (.audit/missions/<id>.json):
 *   { id, name, status, steps[], checkpoint, history[] }
 *
 * Status: pending | running | paused | completed | failed
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { header, result, divider, info, error } from '../shared/output';
import { ExitCode } from '../shared/codes';
import { AUDIT_DIR, BACKEND_DIR } from '../shared/paths';

interface MissionStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface Mission {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  steps: MissionStep[];
  checkpoint?: {
    stepIndex: number;
    timestamp: string;
    data: Record<string, unknown>;
  };
  history: Array<{
    action: string;
    timestamp: string;
    details?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

// ─── Paths ───────────────────────────────────────────────────────

const MISSIONS_DIR = path.join(AUDIT_DIR, 'missions');

function ensureMissionsDir(): void {
  if (!fs.existsSync(MISSIONS_DIR)) {
    fs.mkdirSync(MISSIONS_DIR, { recursive: true });
  }
}

function missionPath(id: string): string {
  return path.join(MISSIONS_DIR, `${id}.json`);
}

function loadMission(id: string): Mission | null {
  const p = missionPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveMission(mission: Mission): void {
  ensureMissionsDir();
  mission.updatedAt = new Date().toISOString();
  fs.writeFileSync(missionPath(mission.id), JSON.stringify(mission, null, 2), 'utf-8');
}

function listMissions(): Mission[] {
  ensureMissionsDir();
  const files = fs.readdirSync(MISSIONS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => JSON.parse(fs.readFileSync(path.join(MISSIONS_DIR, f), 'utf-8')));
}

// ─── Built-in Missions ───────────────────────────────────────────

function createGovernanceFullMission(): Mission {
  return {
    id: 'governance-full',
    name: 'Full Governance Validation',
    description: 'Run all governance checks, tests, and architecture analysis',
    status: 'pending',
    steps: [
      { id: 'typescript', name: 'TypeScript Compilation', status: 'pending' },
      { id: 'freeze-audit', name: 'Freeze Audit', status: 'pending' },
      { id: 'validate-events', name: 'Event Validation', status: 'pending' },
      { id: 'validate-state-machine', name: 'State Machine Validation', status: 'pending' },
      { id: 'build-handbook', name: 'Handbook Validation', status: 'pending' },
      { id: 'build-adr-index', name: 'ADR Index', status: 'pending' },
      { id: 'architecture', name: 'Architecture Doctor', status: 'pending' },
      { id: 'tests', name: 'Test Suite', status: 'pending' },
    ],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createHealthTelemetryMission(): Mission {
  return {
    id: 'health-telemetry',
    name: 'Health Telemetry Report',
    description: 'Generate comprehensive health reports',
    status: 'pending',
    steps: [
      { id: 'health-check', name: 'Run Health Checks', status: 'pending' },
      { id: 'generate-reports', name: 'Generate Reports', status: 'pending' },
    ],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createKnowledgeSyncMission(): Mission {
  return {
    id: 'knowledge-sync',
    name: 'Knowledge Sync',
    description: 'Full rebuild of knowledge artifacts',
    status: 'pending',
    steps: [
      { id: 'scan', name: 'Scan Codebase', status: 'pending' },
      { id: 'generate', name: 'Generate Artifacts', status: 'pending' },
    ],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Command Handlers ────────────────────────────────────────────

function handleList(): void {
  ensureMissionsDir();

  // Ensure built-in missions exist
  const builtIns = [createGovernanceFullMission(), createHealthTelemetryMission(), createKnowledgeSyncMission()];
  for (const mission of builtIns) {
    if (!fs.existsSync(missionPath(mission.id))) {
      saveMission(mission);
    }
  }

  const missions = listMissions();
  if (missions.length === 0) {
    info('No missions found.');
    return;
  }

  for (const m of missions) {
    const completedSteps = m.steps.filter(s => s.status === 'completed').length;
    const totalSteps = m.steps.length;
    const pct = Math.round((completedSteps / totalSteps) * 100);
    const icon = m.status === 'completed' ? '✅' : m.status === 'failed' ? '❌' : m.status === 'running' ? '🔄' : '⏳';
    result(m.id, m.status === 'completed' ? 'PASS' : m.status === 'failed' ? 'FAIL' : 'INFO',
      `${icon} ${m.name} — ${pct}% (${completedSteps}/${totalSteps} steps)`);
  }
}

function handleStatus(id: string): void {
  const mission = loadMission(id);
  if (!mission) {
    error(`Mission not found: ${id}`);
    return;
  }

  divider();
  console.log(`  Mission: ${mission.name}`);
  console.log(`  ID: ${mission.id}`);
  console.log(`  Status: ${mission.status}`);
  console.log(`  Description: ${mission.description}`);
  console.log(`  Created: ${mission.createdAt}`);
  console.log(`  Updated: ${mission.updatedAt}`);
  divider();

  console.log('  Steps:');
  for (let i = 0; i < mission.steps.length; i++) {
    const step = mission.steps[i];
    const icon = step.status === 'completed' ? '✅' : step.status === 'failed' ? '❌' :
                 step.status === 'running' ? '🔄' : step.status === 'skipped' ? '⏭️' : '⏳';
    const checkpoint = mission.checkpoint?.stepIndex === i ? ' ◀ CHECKPOINT' : '';
    console.log(`    ${icon} ${step.name}${checkpoint}`);
    if (step.error) console.log(`       Error: ${step.error}`);
  }

  if (mission.checkpoint) {
    divider();
    console.log(`  Checkpoint: step ${mission.checkpoint.stepIndex} at ${mission.checkpoint.timestamp}`);
  }
}

function handleRun(id: string): boolean {
  const mission = loadMission(id);
  if (!mission) {
    error(`Mission not found: ${id}`);
    return false;
  }

  mission.status = 'running';
  mission.history.push({ action: 'run', timestamp: new Date().toISOString() });

  // Start from checkpoint if exists, otherwise from beginning
  const startIdx = mission.checkpoint?.stepIndex || 0;

  for (let i = startIdx; i < mission.steps.length; i++) {
    const step = mission.steps[i];
    if (step.status === 'completed') continue;

    step.status = 'running';
    step.startedAt = new Date().toISOString();
    info(`Running step: ${step.name}`);

    // Execute step
    const success = executeStep(step);

    step.completedAt = new Date().toISOString();
    if (success) {
      step.status = 'completed';
      result(step.id, 'PASS', step.name);
    } else {
      step.status = 'failed';
      mission.status = 'failed';
      mission.checkpoint = { stepIndex: i, timestamp: new Date().toISOString(), data: {} };
      result(step.id, 'FAIL', step.name);
      saveMission(mission);
      return false;
    }

    // Save checkpoint after each step
    mission.checkpoint = { stepIndex: i + 1, timestamp: new Date().toISOString(), data: {} };
    saveMission(mission);
  }

  mission.status = 'completed';
  mission.history.push({ action: 'completed', timestamp: new Date().toISOString() });
  saveMission(mission);

  divider();
  result('MISSION', 'PASS', `${mission.name} completed`);
  return true;
}

function executeStep(step: MissionStep): boolean {
  try {
    switch (step.id) {
      case 'typescript':
        execSync('npx tsc --noEmit 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 60000 });
        return true;

      case 'freeze-audit':
        execSync('npm run governance:freeze-audit 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 30000 });
        return true;

      case 'validate-events':
        execSync('npm run governance:validate-events 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 30000 });
        return true;

      case 'validate-state-machine':
        execSync('npm run governance:validate-state-machine 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 30000 });
        return true;

      case 'build-handbook':
        execSync('npm run governance:build-handbook 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 30000 });
        return true;

      case 'build-adr-index':
        execSync('npm run governance:build-adr-index 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 30000 });
        return true;

      case 'architecture':
        execSync('npx ts-node --project ../tsconfig.cli.json ../tools/eos-cli/index.ts doctor 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 30000 });
        return true;

      case 'tests':
        execSync('npx jest --no-coverage 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 120000 });
        return true;

      case 'health-check':
        execSync('npx ts-node --project ../tsconfig.cli.json ../tools/eos-cli/index.ts health 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 120000 });
        return true;

      case 'generate-reports':
        execSync('npx ts-node --project ../tsconfig.cli.json ../tools/eos-cli/index.ts health --reports 2>&1', { cwd: BACKEND_DIR, encoding: 'utf-8', timeout: 120000 });
        return true;

      case 'scan':
      case 'generate':
        // Knowledge steps are no-ops (the knowledge command handles this)
        return true;

      default:
        step.error = `Unknown step: ${step.id}`;
        return false;
    }
  } catch (e: any) {
    step.error = e.message?.slice(0, 200) || 'Step failed';
    return false;
  }
}

function handleRetry(id: string): void {
  const mission = loadMission(id);
  if (!mission) {
    error(`Mission not found: ${id}`);
    return;
  }

  if (mission.status !== 'failed') {
    error(`Mission is not in failed state (current: ${mission.status})`);
    return;
  }

  // Reset failed steps
  for (const step of mission.steps) {
    if (step.status === 'failed') {
      step.status = 'pending';
      step.error = undefined;
    }
  }

  mission.status = 'pending';
  mission.history.push({ action: 'retry', timestamp: new Date().toISOString() });
  saveMission(mission);

  info(`Mission ${id} reset for retry. Run 'eos mission run ${id}' to execute.`);
}

function handleCheckpoint(id: string): void {
  const mission = loadMission(id);
  if (!mission) {
    error(`Mission not found: ${id}`);
    return;
  }

  // Find current step
  const currentIdx = mission.steps.findIndex(s => s.status === 'running' || s.status === 'pending');
  if (currentIdx === -1) {
    info('No steps to checkpoint.');
    return;
  }

  mission.checkpoint = {
    stepIndex: currentIdx,
    timestamp: new Date().toISOString(),
    data: {},
  };
  mission.history.push({ action: 'checkpoint', timestamp: new Date().toISOString(), details: `Step ${currentIdx}` });
  saveMission(mission);

  result('CHECKPOINT', 'PASS', `Saved at step ${currentIdx}: ${mission.steps[currentIdx].name}`);
}

function handleResume(id: string): void {
  const mission = loadMission(id);
  if (!mission) {
    error(`Mission not found: ${id}`);
    return;
  }

  if (!mission.checkpoint) {
    error('No checkpoint found for this mission.');
    return;
  }

  mission.status = 'running';
  mission.history.push({ action: 'resume', timestamp: new Date().toISOString() });
  saveMission(mission);

  info(`Resuming from checkpoint at step ${mission.checkpoint.stepIndex}. Run 'eos mission run ${id}' to continue.`);
}

function handleLedger(): void {
  const missions = listMissions();
  if (missions.length === 0) {
    info('No missions in ledger.');
    return;
  }

  console.log('\n  Progress Ledger');
  console.log('  ───────────────\n');

  for (const m of missions) {
    const completed = m.steps.filter(s => s.status === 'completed').length;
    const failed = m.steps.filter(s => s.status === 'failed').length;
    const total = m.steps.length;
    const pct = Math.round((completed / total) * 100);

    const statusIcon = m.status === 'completed' ? '✅' : m.status === 'failed' ? '❌' : '⏳';
    console.log(`  ${statusIcon} ${m.name} (${m.id})`);
    console.log(`     Status: ${m.status} | Steps: ${completed}/${total} (${pct}%) | Failed: ${failed}`);
    console.log(`     Created: ${m.createdAt}`);

    if (m.history.length > 0) {
      const lastAction = m.history[m.history.length - 1];
      console.log(`     Last action: ${lastAction.action} at ${lastAction.timestamp}`);
    }
    console.log('');
  }
}

// ─── Main ────────────────────────────────────────────────────────

export async function runMission(args: string[] = []): Promise<ExitCode> {
  header('eos mission — Mission Runtime');

  const subcommand = args[0] || 'list';
  const missionId = args[1];

  switch (subcommand) {
    case 'list':
      handleList();
      break;

    case 'status':
      if (!missionId) { error('Usage: eos mission status <id>'); return ExitCode.GENERAL_ERROR; }
      handleStatus(missionId);
      break;

    case 'run':
      if (!missionId) { error('Usage: eos mission run <id>'); return ExitCode.GENERAL_ERROR; }
      if (!handleRun(missionId)) return ExitCode.MISSION_FAILURE;
      break;

    case 'retry':
      if (!missionId) { error('Usage: eos mission retry <id>'); return ExitCode.GENERAL_ERROR; }
      handleRetry(missionId);
      break;

    case 'checkpoint':
      if (!missionId) { error('Usage: eos mission checkpoint <id>'); return ExitCode.GENERAL_ERROR; }
      handleCheckpoint(missionId);
      break;

    case 'resume':
      if (!missionId) { error('Usage: eos mission resume <id>'); return ExitCode.GENERAL_ERROR; }
      handleResume(missionId);
      break;

    case 'ledger':
      handleLedger();
      break;

    default:
      error(`Unknown subcommand: ${subcommand}`);
      console.log('Available: list, status, run, retry, checkpoint, resume, ledger');
      return ExitCode.GENERAL_ERROR;
  }

  return ExitCode.SUCCESS;
}
