/**
 * Governance Platform - Registry
 *
 * Automatic task discovery, registration, and execution ordering.
 * The registry is the single source of truth for governance tasks.
 */

import { GovernanceTask, TaskRegistration, GovernanceResult, GovernanceConfig } from './types';

// ============================================================
// Registry
// ============================================================

export class GovernanceRegistry {
  private tasks: Map<string, TaskRegistration> = new Map();
  private config: GovernanceConfig;

  constructor(config: GovernanceConfig) {
    this.config = config;
  }

  // ── Registration ──

  /**
   * Register a governance task.
   * Throws if task ID already registered.
   */
  register(task: GovernanceTask, options?: { enabled?: boolean; order?: number }): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task "${task.id}" is already registered`);
    }

    this.tasks.set(task.id, {
      task,
      enabled: options?.enabled ?? true,
      order: options?.order ?? this.tasks.size,
    });
  }

  /**
   * Register multiple tasks at once.
   */
  registerAll(tasks: Array<{ task: GovernanceTask; enabled?: boolean; order?: number }>): void {
    for (const { task, enabled, order } of tasks) {
      this.register(task, { enabled, order });
    }
  }

  // ── Discovery ──

  /**
   * Get all registered tasks, sorted by execution order.
   * Respects enabled/disabled configuration.
   */
  getExecutionOrder(): GovernanceTask[] {
    const registrations = Array.from(this.tasks.values());

    // Apply configuration
    const enabled = registrations.filter(r => {
      // Check if explicitly disabled
      if (this.config.disabledTasks.includes(r.task.id)) {
        return false;
      }
      // Check if explicitly enabled (if list is non-empty)
      if (this.config.enabledTasks.length > 0) {
        return this.config.enabledTasks.includes(r.task.id);
      }
      // Use registration setting
      return r.enabled;
    });

    // Apply custom order from config
    const ordered = enabled.map(r => ({
      ...r,
      order: this.config.taskOrder[r.task.id] ?? r.order,
    }));

    // Sort by order
    ordered.sort((a, b) => a.order - b.order);

    return ordered.map(r => r.task);
  }

  /**
   * Get a specific task by ID.
   */
  getTask(id: string): GovernanceTask | undefined {
    return this.tasks.get(id)?.task;
  }

  /**
   * Get all registered task IDs.
   */
  getTaskIds(): string[] {
    return Array.from(this.tasks.keys());
  }

  /**
   * Get task count.
   */
  getTaskCount(): number {
    return this.tasks.size;
  }

  // ── Dependency Validation ──

  /**
   * Validate that all dependencies exist.
   * Returns list of errors (empty = valid).
   */
  validateDependencies(): string[] {
    const errors: string[] = [];
    const allIds = new Set(this.tasks.keys());

    for (const [id, registration] of this.tasks) {
      for (const dep of registration.task.dependencies) {
        if (!allIds.has(dep)) {
          errors.push(`Task "${id}" depends on "${dep}" which is not registered`);
        }
      }
    }

    return errors;
  }

  /**
   * Detect circular dependencies.
   * Returns list of cycles (empty = no cycles).
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (taskId: string, path: string[]): void => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const task = this.tasks.get(taskId)?.task;
      if (task) {
        for (const dep of task.dependencies) {
          if (!visited.has(dep)) {
            dfs(dep, [...path]);
          } else if (recursionStack.has(dep)) {
            // Found cycle
            const cycleStart = path.indexOf(dep);
            cycles.push(path.slice(cycleStart));
          }
        }
      }

      recursionStack.delete(taskId);
    };

    for (const id of this.tasks.keys()) {
      if (!visited.has(id)) {
        dfs(id, []);
      }
    }

    return cycles;
  }

  /**
   * Get tasks in topological order (respecting dependencies).
   * Throws if cycles detected.
   */
  getTopologicalOrder(): GovernanceTask[] {
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      throw new Error(`Circular dependencies detected: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
    }

    const tasks = this.getExecutionOrder();
    const sorted: GovernanceTask[] = [];
    const visited = new Set<string>();

    const visit = (task: GovernanceTask): void => {
      if (visited.has(task.id)) return;
      visited.add(task.id);

      // Visit dependencies first
      for (const depId of task.dependencies) {
        const depTask = this.getTask(depId);
        if (depTask) {
          visit(depTask);
        }
      }

      sorted.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    return sorted;
  }

  // ── Execution ──

  /**
   * Execute all tasks in dependency order.
   * Returns results in execution order.
   */
  async executeAll(): Promise<GovernanceResult[]> {
    const tasks = this.getTopologicalOrder();
    const results: GovernanceResult[] = [];

    for (const task of tasks) {
      const result = await task.execute();
      results.push(result);

      // Stop on failure if configured
      if (result.status === 'FAIL' && !this.config.failOnWarning) {
        // Continue even on failure (default behavior)
      }
    }

    return results;
  }

  /**
   * Execute a specific task by ID.
   */
  async executeTask(taskId: string): Promise<GovernanceResult> {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" is not registered`);
    }
    return task.execute();
  }

  // ── Introspection ──

  /**
   * Get registry summary.
   */
  getSummary(): {
    totalTasks: number;
    enabledTasks: number;
    taskIds: string[];
    dependencyErrors: string[];
    cycles: string[][];
  } {
    const tasks = this.getExecutionOrder();
    return {
      totalTasks: this.tasks.size,
      enabledTasks: tasks.length,
      taskIds: Array.from(this.tasks.keys()),
      dependencyErrors: this.validateDependencies(),
      cycles: this.detectCycles(),
    };
  }
}
