#!/usr/bin/env node
/**
 * eos — EduOS Developer Platform CLI
 *
 * Usage:
 *   eos <command> [options]
 *
 * Commands:
 *   doctor      Architecture analysis and diagnostics
 *   health      Repository health report with scoring
 *   validate    Unified governance validation (runs all checks)
 *   freeze      Run freeze audit
 *   knowledge   Knowledge system operations
 *   repo        Repository statistics and information
 *   generate    Project scaffolding (aggregate, entity, service, etc.)
 *   mission     Mission runtime management (queue, checkpoint, retry)
 *   help        Show this help message
 *
 * Exit Codes:
 *   0  Success
 *   1  General error
 *   2  Validation failure
 *   3  Architecture violation
 *   4  Governance failure
 *   5  Mission failure
 */

import { ExitCode } from './shared/codes';
import { error, header, info } from './shared/output';

const COMMANDS: Record<string, (args: string[]) => Promise<ExitCode>> = {
  doctor: async () => (await import('./commands/doctor')).runDoctor(),
  health: async (args) => (await import('./commands/health')).runHealth(args),
  validate: async (args) => (await import('./commands/validate')).runValidate(args),
  freeze: async () => (await import('./commands/freeze')).runFreeze(),
  knowledge: async (args) => (await import('./commands/knowledge')).runKnowledge(args),
  repo: async () => (await import('./commands/repo')).runRepo(),
  generate: async (args) => (await import('./commands/generate')).runGenerate(args),
  mission: async (args) => (await import('./commands/mission')).runMission(args),
  governance: async (args) => (await import('./commands/governance')).runGovernance(args),
};

function showHelp(): void {
  header('eos — EduOS Developer Platform CLI');
  console.log('Usage: eos <command> [options]\n');
  console.log('Commands:');
  console.log('  doctor      Architecture analysis and diagnostics');
  console.log('  health      Repository health report with scoring');
  console.log('  validate    Unified governance validation');
  console.log('  freeze      Run freeze audit');
  console.log('  knowledge   Knowledge system operations');
  console.log('  repo        Repository statistics');
  console.log('  generate    Project scaffolding (aggregate, entity, service, etc.)');
  console.log('  mission     Mission runtime (queue, checkpoint, retry)');
  console.log('  governance  Self Governance Engine (issues, debt, snapshots)');
  console.log('  help        Show this help\n');
  console.log('Exit Codes:');
  console.log('  0  Success');
  console.log('  1  General error');
  console.log('  2  Validation failure');
  console.log('  3  Architecture violation');
  console.log('  4  Governance failure');
  console.log('  5  Mission failure');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(ExitCode.SUCCESS);
  }

  const handler = COMMANDS[command];
  if (!handler) {
    error(`Unknown command: ${command}`);
    console.log('Run `eos help` for available commands.');
    process.exit(ExitCode.GENERAL_ERROR);
  }

  try {
    const exitCode = await handler(args.slice(1));
    process.exit(exitCode);
  } catch (e: any) {
    error(e.message || 'Command failed');
    process.exit(ExitCode.GENERAL_ERROR);
  }
}

main();
