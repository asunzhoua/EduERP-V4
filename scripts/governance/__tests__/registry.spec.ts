/**
 * Tests for GovernanceRegistry
 */

import { GovernanceRegistry } from '../platform/registry';
import { GovernanceConfig, GovernanceTask } from '../platform/types';
import { createConfig } from '../platform/config';

describe('GovernanceRegistry', () => {
  let registry: GovernanceRegistry;

  beforeEach(() => {
    const config = createConfig({});
    registry = new GovernanceRegistry(config);
  });

  describe('register()', () => {
    it('should register a task', () => {
      const task: GovernanceTask = {
        id: 'test-task',
        name: 'Test Task',
        description: 'A test task',
        dependencies: [],
        execute: async () => ({
          taskId: 'test-task',
          taskName: 'Test Task',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      registry.register(task);
      expect(registry.getTaskCount()).toBe(1);
      expect(registry.getTask('test-task')).toBe(task);
    });

    it('should throw on duplicate task ID', () => {
      const task: GovernanceTask = {
        id: 'duplicate',
        name: 'Duplicate',
        description: 'Test',
        dependencies: [],
        execute: async () => ({
          taskId: 'duplicate',
          taskName: 'Duplicate',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      registry.register(task);
      expect(() => registry.register(task)).toThrow('already registered');
    });
  });

  describe('validateDependencies()', () => {
    it('should return empty array when all dependencies exist', () => {
      const task1: GovernanceTask = {
        id: 'task1',
        name: 'Task 1',
        description: 'Test',
        dependencies: [],
        execute: async () => ({
          taskId: 'task1',
          taskName: 'Task 1',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      const task2: GovernanceTask = {
        id: 'task2',
        name: 'Task 2',
        description: 'Test',
        dependencies: ['task1'],
        execute: async () => ({
          taskId: 'task2',
          taskName: 'Task 2',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      registry.register(task1);
      registry.register(task2);

      const errors = registry.validateDependencies();
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing dependency', () => {
      const task: GovernanceTask = {
        id: 'task',
        name: 'Task',
        description: 'Test',
        dependencies: ['nonexistent'],
        execute: async () => ({
          taskId: 'task',
          taskName: 'Task',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      registry.register(task);

      const errors = registry.validateDependencies();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('nonexistent');
    });
  });

  describe('detectCycles()', () => {
    it('should return empty array when no cycles exist', () => {
      const task1: GovernanceTask = {
        id: 'task1',
        name: 'Task 1',
        description: 'Test',
        dependencies: [],
        execute: async () => ({
          taskId: 'task1',
          taskName: 'Task 1',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      const task2: GovernanceTask = {
        id: 'task2',
        name: 'Task 2',
        description: 'Test',
        dependencies: ['task1'],
        execute: async () => ({
          taskId: 'task2',
          taskName: 'Task 2',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      registry.register(task1);
      registry.register(task2);

      const cycles = registry.detectCycles();
      expect(cycles).toHaveLength(0);
    });

    it('should detect circular dependencies', () => {
      const task1: GovernanceTask = {
        id: 'task1',
        name: 'Task 1',
        description: 'Test',
        dependencies: ['task2'],
        execute: async () => ({
          taskId: 'task1',
          taskName: 'Task 1',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      const task2: GovernanceTask = {
        id: 'task2',
        name: 'Task 2',
        description: 'Test',
        dependencies: ['task1'],
        execute: async () => ({
          taskId: 'task2',
          taskName: 'Task 2',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      registry.register(task1);
      registry.register(task2);

      const cycles = registry.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);
    });
  });

  describe('executeAll()', () => {
    it('should execute all tasks in order', async () => {
      const executionOrder: string[] = [];

      const task1: GovernanceTask = {
        id: 'task1',
        name: 'Task 1',
        description: 'Test',
        dependencies: [],
        execute: async () => {
          executionOrder.push('task1');
          return {
            taskId: 'task1',
            taskName: 'Task 1',
            status: 'PASS',
            startedAt: new Date(),
            finishedAt: new Date(),
            durationMs: 0,
            errors: [],
            warnings: [],
            statistics: {},
          };
        },
      };

      const task2: GovernanceTask = {
        id: 'task2',
        name: 'Task 2',
        description: 'Test',
        dependencies: ['task1'],
        execute: async () => {
          executionOrder.push('task2');
          return {
            taskId: 'task2',
            taskName: 'Task 2',
            status: 'PASS',
            startedAt: new Date(),
            finishedAt: new Date(),
            durationMs: 0,
            errors: [],
            warnings: [],
            statistics: {},
          };
        },
      };

      registry.register(task1);
      registry.register(task2);

      await registry.executeAll();

      expect(executionOrder).toEqual(['task1', 'task2']);
    });
  });

  describe('getTopologicalOrder()', () => {
    it('should return tasks in topological order', () => {
      const task1: GovernanceTask = {
        id: 'task1',
        name: 'Task 1',
        description: 'Test',
        dependencies: [],
        execute: async () => ({
          taskId: 'task1',
          taskName: 'Task 1',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      const task2: GovernanceTask = {
        id: 'task2',
        name: 'Task 2',
        description: 'Test',
        dependencies: ['task1'],
        execute: async () => ({
          taskId: 'task2',
          taskName: 'Task 2',
          status: 'PASS',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errors: [],
          warnings: [],
          statistics: {},
        }),
      };

      registry.register(task2);
      registry.register(task1);

      const order = registry.getTopologicalOrder();
      expect(order.map(t => t.id)).toEqual(['task1', 'task2']);
    });
  });
});
