/**
 * Governance Platform - Core Types
 *
 * Unified type definitions for the Governance execution model.
 * All governance tasks return GovernanceResult.
 */

// ============================================================
// Severity & Status
// ============================================================

export type GovernanceSeverity = 'PASS' | 'WARNING' | 'FAIL';
export type GovernanceStatus = 'PASS' | 'WARNING' | 'FAIL';

// ============================================================
// GovernanceIssue
// ============================================================

/**
 * A single issue found during governance execution.
 */
export interface GovernanceIssue {
  /** Unique issue identifier (e.g., "FREEZE-001") */
  id: string;
  /** Human-readable description */
  description: string;
  /** Severity level */
  severity: GovernanceSeverity;
  /** Optional detailed explanation */
  details?: string;
  /** File path where issue was found */
  file?: string;
  /** Line number (if applicable) */
  line?: number;
}

// ============================================================
// GovernanceResult
// ============================================================

/**
 * Result returned by every GovernanceTask execution.
 * Unified across all governance operations.
 */
export interface GovernanceResult {
  /** Unique task identifier (e.g., "freeze-audit") */
  taskId: string;
  /** Human-readable task name (e.g., "Freeze Audit") */
  taskName: string;
  /** Overall status: PASS if no errors, WARNING if warnings only, FAIL if any errors */
  status: GovernanceStatus;
  /** Execution start time */
  startedAt: Date;
  /** Execution end time */
  finishedAt: Date;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Issues found (errors) */
  errors: GovernanceIssue[];
  /** Issues found (warnings) */
  warnings: GovernanceIssue[];
  /** Optional statistics about the execution */
  statistics: Record<string, number>;
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================
// GovernanceTask
// ============================================================

/**
 * Interface that all governance tasks must implement.
 *
 * Example:
 * ```typescript
 * class FreezeAuditTask implements GovernanceTask {
 *   id = 'freeze-audit';
 *   name = 'Freeze Audit';
 *   description = 'Validates governance document consistency';
 *   dependencies = [];
 *
 *   async execute(): Promise<GovernanceResult> {
 *     // ... implementation
 *   }
 * }
 * ```
 */
export interface GovernanceTask {
  /** Unique task identifier */
  readonly id: string;
  /** Human-readable task name */
  readonly name: string;
  /** Task description */
  readonly description: string;
  /** Task IDs that must complete before this task runs */
  readonly dependencies: string[];
  /** Execute the task and return results */
  execute(): Promise<GovernanceResult>;
}

// ============================================================
// Task Registration
// ============================================================

/**
 * Metadata about a registered task.
 */
export interface TaskRegistration {
  /** Task implementation */
  task: GovernanceTask;
  /** Whether this task is enabled */
  enabled: boolean;
  /** Execution order (lower = earlier) */
  order: number;
}

// ============================================================
// Governance Configuration
// ============================================================

/**
 * Configuration for the governance platform.
 */
export interface GovernanceConfig {
  /** Directory for report output */
  reportDir: string;
  /** Whether to fail on warnings */
  failOnWarning: boolean;
  /** Verbosity level: 0 = quiet, 1 = normal, 2 = verbose */
  verbosity: number;
  /** Enabled task IDs (empty = all enabled) */
  enabledTasks: string[];
  /** Disabled task IDs */
  disabledTasks: string[];
  /** Custom execution order (task ID -> order number) */
  taskOrder: Record<string, number>;
  /** ArchitectureBaseline output path */
  baselinePath: string;
}

// ============================================================
// Performance Metrics
// ============================================================

/**
 * Performance metrics for a single task execution.
 */
export interface TaskPerformance {
  /** Task ID */
  taskId: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Memory usage in bytes (if available) */
  memoryBytes?: number;
  /** Number of artifacts processed */
  artifactsProcessed: number;
  /** Number of checks performed */
  checksPerformed: number;
}

/**
 * Aggregated performance report.
 */
export interface PerformanceReport {
  /** Report generation timestamp */
  timestamp: string;
  /** Total execution time */
  totalDurationMs: number;
  /** Individual task metrics */
  tasks: TaskPerformance[];
  /** Summary statistics */
  summary: {
    totalTasks: number;
    totalDurationMs: number;
    totalArtifacts: number;
    totalChecks: number;
  };
}
