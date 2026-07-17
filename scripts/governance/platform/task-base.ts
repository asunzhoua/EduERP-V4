/**
 * Governance Platform - Task Base
 *
 * Abstract base class for governance tasks.
 * Provides common execution pattern and performance measurement.
 */

import { GovernanceTask, GovernanceResult, GovernanceIssue, GovernanceSeverity } from './types';

// ============================================================
// Task Base
// ============================================================

/**
 * Abstract base class for governance tasks.
 * Handles timing, error handling, and result construction.
 */
export abstract class GovernanceTaskBase implements GovernanceTask {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly dependencies: string[];

  /**
   * Execute the task logic.
   * Subclasses implement this method.
   */
  protected abstract executeTask(): Promise<{
    issues: GovernanceIssue[];
    statistics: Record<string, number>;
    metadata?: Record<string, unknown>;
  }>;

  /**
   * Execute the task with timing and error handling.
   */
  async execute(): Promise<GovernanceResult> {
    const startedAt = new Date();
    let issues: GovernanceIssue[] = [];
    let statistics: Record<string, number> = {};
    let metadata: Record<string, unknown> | undefined;

    try {
      const result = await this.executeTask();
      issues = result.issues;
      statistics = result.statistics;
      metadata = result.metadata;
    } catch (err) {
      issues.push({
        id: `${this.id.toUpperCase()}-ERROR`,
        description: `Task execution failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'FAIL',
        details: err instanceof Error ? err.stack : undefined,
      });
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    // Determine overall status
    const hasErrors = issues.some(i => i.severity === 'FAIL');
    const hasWarnings = issues.some(i => i.severity === 'WARNING');
    const status = hasErrors ? 'FAIL' : hasWarnings ? 'WARNING' : 'PASS';

    return {
      taskId: this.id,
      taskName: this.name,
      status,
      startedAt,
      finishedAt,
      durationMs,
      errors: issues.filter(i => i.severity === 'FAIL'),
      warnings: issues.filter(i => i.severity === 'WARNING'),
      statistics,
      metadata,
    };
  }
}

// ============================================================
// Task Adapters
// ============================================================

/**
 * Adapter to wrap existing synchronous validator functions.
 *
 * Usage:
 * ```typescript
 * const task = createSyncTask(
 *   'freeze-audit',
 *   'Freeze Audit',
 *   'Validates governance document consistency',
 *   [],
 *   runFreezeAuditSync
 * );
 * ```
 */
export function createSyncTask(
  id: string,
  name: string,
  description: string,
  dependencies: string[],
  fn: () => GovernanceIssue[]
): GovernanceTask {
  return new (class extends GovernanceTaskBase {
    readonly id = id;
    readonly name = name;
    readonly description = description;
    readonly dependencies = dependencies;

    protected async executeTask() {
      const issues = fn();
      return {
        issues,
        statistics: {
          checksPerformed: issues.length,
          errors: issues.filter(i => i.severity === 'FAIL').length,
          warnings: issues.filter(i => i.severity === 'WARNING').length,
        },
      };
    }
  })();
}

/**
 * Adapter to wrap existing async validator functions.
 */
export function createAsyncTask(
  id: string,
  name: string,
  description: string,
  dependencies: string[],
  fn: () => Promise<GovernanceIssue[]>
): GovernanceTask {
  return new (class extends GovernanceTaskBase {
    readonly id = id;
    readonly name = name;
    readonly description = description;
    readonly dependencies = dependencies;

    protected async executeTask() {
      const issues = await fn();
      return {
        issues,
        statistics: {
          checksPerformed: issues.length,
          errors: issues.filter(i => i.severity === 'FAIL').length,
          warnings: issues.filter(i => i.severity === 'WARNING').length,
        },
      };
    }
  })();
}
