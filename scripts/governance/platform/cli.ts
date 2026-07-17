/**
 * Governance Platform - CLI
 *
 * Unified CLI entry point for governance operations.
 * Uses the registry for task discovery and execution.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GovernanceRegistry } from './registry';
import { loadConfig, createConfig } from './config';
import { GovernanceConfig, GovernanceResult, TaskPerformance, PerformanceReport } from './types';
import { REPORTS_DIR } from '../shared/paths';
import { writeJSONReport, writeMDReport } from '../shared/report';

// ============================================================
// CLI Colors
// ============================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function colorize(color: string, text: string): string {
  return `${color}${text}${colors.reset}`;
}

// ============================================================
// CLI Interface
// ============================================================

export interface CLIOptions {
  command: string;
  args: string[];
  config?: GovernanceConfig;
}

/**
 * Parse CLI arguments.
 */
export function parseArgs(args: string[]): CLIOptions {
  const [command, ...rest] = args.slice(2); // Skip node and script path
  return {
    command: command || 'check',
    args: rest,
  };
}

/**
 * Print usage information.
 */
function printUsage(): void {
  console.log(`
${colorize(colors.bold, 'Governance Platform CLI')}

${colorize(colors.cyan, 'Usage:')}
  governance <command> [options]

${colorize(colors.cyan, 'Commands:')}
  check           Run all governance tasks (default)
  list            List all registered tasks
  task <id>       Run a specific task
  baseline        Generate ArchitectureBaseline
  report          Generate governance report
  validate        Validate task dependencies
  graph           Generate dependency graph (Mermaid)

${colorize(colors.cyan, 'Options:')}
  --verbose       Enable verbose output
  --quiet         Suppress output
  --config <path> Use custom configuration file
  --help          Show this help message
`);
}

/**
 * Print task list.
 */
function printTaskList(registry: GovernanceRegistry): void {
  const tasks = registry.getExecutionOrder();
  const summary = registry.getSummary();

  console.log(`\n${colorize(colors.bold, 'Registered Governance Tasks')}\n`);
  console.log(`${colorize(colors.dim, 'Total:')} ${summary.totalTasks}`);
  console.log(`${colorize(colors.dim, 'Enabled:')} ${summary.enabledTasks}`);
  console.log(`${colorize(colors.dim, 'Dependency Errors:')} ${summary.dependencyErrors.length}`);
  console.log(`${colorize(colors.dim, 'Cycles:')} ${summary.cycles.length}\n`);

  console.log(`${colorize(colors.bold, 'Execution Order:')}\n`);
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const deps = task.dependencies.length > 0 ? ` (depends on: ${task.dependencies.join(', ')})` : '';
    console.log(`  ${colorize(colors.green, `${i + 1}.`)} ${task.name}${colorize(colors.dim, deps)}`);
  }
  console.log('');
}

/**
 * Print execution result.
 */
function printResult(result: GovernanceResult, verbose: boolean = false): void {
  const statusColor = result.status === 'PASS' ? colors.green : result.status === 'WARNING' ? colors.yellow : colors.red;
  const statusIcon = result.status === 'PASS' ? '✓' : result.status === 'WARNING' ? '⚠' : '✗';

  console.log(`\n${colorize(statusColor, `${statusIcon} ${result.taskName}`)}`);
  console.log(`  ${colorize(colors.dim, 'Status:')} ${colorize(statusColor, result.status)}`);
  console.log(`  ${colorize(colors.dim, 'Duration:')} ${result.durationMs}ms`);

  if (result.errors.length > 0) {
    console.log(`  ${colorize(colors.red, `Errors: ${result.errors.length}`)}`);
    if (verbose) {
      for (const error of result.errors) {
        console.log(`    ${colorize(colors.red, '•')} ${error.description}`);
      }
    }
  }

  if (result.warnings.length > 0) {
    console.log(`  ${colorize(colors.yellow, `Warnings: ${result.warnings.length}`)}`);
    if (verbose) {
      for (const warning of result.warnings) {
        console.log(`    ${colorize(colors.yellow, '•')} ${warning.description}`);
      }
    }
  }

  if (Object.keys(result.statistics).length > 0 && verbose) {
    console.log(`  ${colorize(colors.dim, 'Statistics:')}`);
    for (const [key, value] of Object.entries(result.statistics)) {
      console.log(`    ${key}: ${value}`);
    }
  }
}

/**
 * Print performance report.
 */
function printPerformanceReport(report: PerformanceReport): void {
  console.log(`\n${colorize(colors.bold, 'Performance Report')}\n`);
  console.log(`${colorize(colors.dim, 'Total Duration:')} ${report.summary.totalDurationMs}ms`);
  console.log(`${colorize(colors.dim, 'Total Tasks:')} ${report.summary.totalTasks}`);
  console.log(`${colorize(colors.dim, 'Total Checks:')} ${report.summary.totalChecks}\n`);

  console.log(`${colorize(colors.bold, 'Task Breakdown:')}\n`);
  for (const task of report.tasks) {
    const duration = `${task.durationMs}ms`;
    console.log(`  ${task.taskId.padEnd(25)} ${duration.padStart(10)} ${String(task.checksPerformed).padStart(5)} checks`);
  }
  console.log('');
}

/**
 * Generate dependency graph in Mermaid format.
 */
function generateDependencyGraph(registry: GovernanceRegistry): string {
  const tasks = registry.getExecutionOrder();
  const lines: string[] = ['graph TD'];

  // Define nodes with styles
  for (const task of tasks) {
    const label = task.name.replace(/[^a-zA-Z0-9 ]/g, '');
    lines.push(`  ${task.id}["${label}"]`);
  }

  // Define edges (dependencies)
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      lines.push(`  ${dep} --> ${task.id}`);
    }
  }

  // Add styling
  lines.push('');
  lines.push('  classDef default fill:#e1f5fe,stroke:#0288d1,stroke-width:2px');
  lines.push('  classDef pass fill:#c8e6c9,stroke:#388e3c,stroke-width:2px');
  lines.push('  classDef warn fill:#fff9c4,stroke:#f9a825,stroke-width:2px');
  lines.push('  classDef fail fill:#ffcdd2,stroke:#d32f2f,stroke-width:2px');

  return lines.join('\n');
}

/**
 * Print dependency graph.
 */
function printDependencyGraph(registry: GovernanceRegistry): void {
  const graph = generateDependencyGraph(registry);
  console.log(`\n${colorize(colors.bold, '═══ Dependency Graph (Mermaid) ═══')}\n`);
  console.log('```mermaid');
  console.log(graph);
  console.log('```\n');
}

// ============================================================
// CLI Commands
// ============================================================

/**
 * Execute the check command (run all tasks).
 */
async function executeCheck(registry: GovernanceRegistry, verbose: boolean): Promise<number> {
  console.log(colorize(colors.bold, '\n═══ Governance Check ═══\n'));

  const results = await registry.executeAll();
  let exitCode = 0;

  for (const result of results) {
    printResult(result, verbose);
    if (result.status === 'FAIL') {
      exitCode = 1;
    }
  }

  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARNING').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`\n${colorize(colors.bold, '═══ Summary ═══')}`);
  console.log(`  ${colorize(colors.green, `PASS: ${passed}`)}`);
  console.log(`  ${colorize(colors.yellow, `WARN: ${warned}`)}`);
  console.log(`  ${colorize(colors.red, `FAIL: ${failed}`)}`);
  console.log('');

  return exitCode;
}

/**
 * Execute a specific task.
 */
async function executeTask(registry: GovernanceRegistry, taskId: string, verbose: boolean): Promise<number> {
  console.log(colorize(colors.bold, `\n═══ Task: ${taskId} ═══\n`));

  try {
    const result = await registry.executeTask(taskId);
    printResult(result, verbose);
    return result.status === 'FAIL' ? 1 : 0;
  } catch (err) {
    console.error(colorize(colors.red, `Error: ${err instanceof Error ? err.message : String(err)}`));
    return 1;
  }
}

/**
 * Generate performance report.
 */
async function generatePerformanceReport(registry: GovernanceRegistry): Promise<PerformanceReport> {
  const tasks = registry.getExecutionOrder();
  const taskMetrics: TaskPerformance[] = [];

  for (const task of tasks) {
    const result = await task.execute();
    taskMetrics.push({
      taskId: result.taskId,
      durationMs: result.durationMs,
      artifactsProcessed: result.statistics['artifactsProcessed'] || 0,
      checksPerformed: result.statistics['checksPerformed'] || 0,
    });
  }

  const totalDurationMs = taskMetrics.reduce((sum, t) => sum + t.durationMs, 0);
  const totalArtifacts = taskMetrics.reduce((sum, t) => sum + t.artifactsProcessed, 0);
  const totalChecks = taskMetrics.reduce((sum, t) => sum + t.checksPerformed, 0);

  return {
    timestamp: new Date().toISOString(),
    totalDurationMs,
    tasks: taskMetrics,
    summary: {
      totalTasks: tasks.length,
      totalDurationMs,
      totalArtifacts,
      totalChecks,
    },
  };
}

// ============================================================
// Main CLI Entry Point
// ============================================================

/**
 * Run the governance CLI.
 */
export async function runCLI(args: string[]): Promise<number> {
  const options = parseArgs(args);
  const config = loadConfig();

  // Handle --help
  if (options.args.includes('--help') || options.command === 'help' || options.command === '--help') {
    printUsage();
    return 0;
  }

  // Create registry
  const registry = new GovernanceRegistry(config);

  // Import and register all tasks
  await registerAllTasks(registry);

  // Handle commands
  switch (options.command) {
    case 'check':
      return executeCheck(registry, options.args.includes('--verbose'));

    case 'list':
      printTaskList(registry);
      return 0;

    case 'task':
      const taskId = options.args[0];
      if (!taskId) {
        console.error(colorize(colors.red, 'Error: task ID required'));
        return 1;
      }
      return executeTask(registry, taskId, options.args.includes('--verbose'));

    case 'baseline':
      console.log(colorize(colors.bold, '\n═══ ArchitectureBaseline ═══\n'));
      const baselineResult = await registry.executeTask('build-baseline');
      printResult(baselineResult, options.args.includes('--verbose'));
      return baselineResult.status === 'FAIL' ? 1 : 0;

    case 'report':
      console.log(colorize(colors.bold, '\n═══ Performance Report ═══\n'));
      const perfReport = await generatePerformanceReport(registry);
      printPerformanceReport(perfReport);

      // Write report
      const reportPath = path.join(REPORTS_DIR, 'governance-performance.json');
      fs.writeFileSync(reportPath, JSON.stringify(perfReport, null, 2), 'utf-8');
      console.log(colorize(colors.green, `Report written to: ${reportPath}`));
      return 0;

    case 'validate':
      console.log(colorize(colors.bold, '\n═══ Validation ═══\n'));
      const summary = registry.getSummary();
      console.log(`Total tasks: ${summary.totalTasks}`);
      console.log(`Enabled tasks: ${summary.enabledTasks}`);
      console.log(`Dependency errors: ${summary.dependencyErrors.length}`);
      console.log(`Cycles: ${summary.cycles.length}`);

      if (summary.dependencyErrors.length > 0) {
        console.error(colorize(colors.red, '\nDependency errors:'));
        for (const error of summary.dependencyErrors) {
          console.error(`  ${error}`);
        }
        return 1;
      }

      if (summary.cycles.length > 0) {
        console.error(colorize(colors.red, '\nCircular dependencies:'));
        for (const cycle of summary.cycles) {
          console.error(`  ${cycle.join(' -> ')}`);
        }
        return 1;
      }

      console.log(colorize(colors.green, '\n✓ All validations passed'));
      return 0;

    case 'graph':
      printDependencyGraph(registry);

      // Also write to file if requested
      if (options.args.includes('--output')) {
        const outputPath = path.join(REPORTS_DIR, 'governance-dependency-graph.mmd');
        const graphContent = generateDependencyGraph(registry);
        fs.writeFileSync(outputPath, graphContent, 'utf-8');
        console.log(colorize(colors.green, `Graph written to: ${outputPath}`));
      }
      return 0;

    default:
      console.error(colorize(colors.red, `Unknown command: ${options.command}`));
      printUsage();
      return 1;
  }
}

// ============================================================
// Task Registration
// ============================================================

/**
 * Register all governance tasks with the registry.
 */
async function registerAllTasks(registry: GovernanceRegistry): Promise<void> {
  // Import task implementations
  const { FreezeAuditTask } = await import('../tasks/freeze-audit');
  const { EventValidationTask } = await import('../tasks/event-validation');
  const { StateMachineValidationTask } = await import('../tasks/state-machine-validation');
  const { HandbookValidationTask } = await import('../tasks/handbook-validation');
  const { ADRIndexTask } = await import('../tasks/adr-index');
  const { BaselineTask } = await import('../tasks/baseline');
  const { TraceabilityValidationTask } = await import('../tasks/traceability-validation');
  const { DriftDetectionTask } = await import('../tasks/drift-detection');
  const { FrictionEnforcementTask } = await import('../tasks/friction-enforcement');
  const { ArchitectureConsistencyTask } = await import('../tasks/architecture-consistency');
  const { GovernanceSummaryTask } = await import('../tasks/governance-summary');

  // Register tasks (dependencies are defined in the task classes)
  registry.register(new FreezeAuditTask(), { order: 1 });
  registry.register(new EventValidationTask(), { order: 2 });
  registry.register(new StateMachineValidationTask(), { order: 3 });
  registry.register(new HandbookValidationTask(), { order: 4 });
  registry.register(new ADRIndexTask(), { order: 5 });
  registry.register(new TraceabilityValidationTask(), { order: 6 });
  registry.register(new DriftDetectionTask(), { order: 7 });
  registry.register(new FrictionEnforcementTask(), { order: 8 });
  registry.register(new ArchitectureConsistencyTask(), { order: 9 });
  registry.register(new GovernanceSummaryTask(), { order: 10 });
  registry.register(new BaselineTask(), { order: 11 });
}

// ============================================================
// CLI Entry Point
// ============================================================

if (require.main === module) {
  runCLI(process.argv).then(exitCode => {
    process.exit(exitCode);
  });
}
