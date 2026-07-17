/**
 * Tests for GovernanceTaskBase
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue, GovernanceResult } from '../platform/types';

describe('GovernanceTaskBase', () => {
  class TestTask extends GovernanceTaskBase {
    readonly id = 'test-task';
    readonly name = 'Test Task';
    readonly description = 'A test task';
    readonly dependencies: string[] = [];

    protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
      return {
        issues: [
          { id: 'TEST-001', description: 'Test issue', severity: 'PASS' },
        ],
        statistics: {
          checksPerformed: 1,
        },
      };
    }
  }

  class FailingTask extends GovernanceTaskBase {
    readonly id = 'failing-task';
    readonly name = 'Failing Task';
    readonly description = 'A failing task';
    readonly dependencies: string[] = [];

    protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number> }> {
      throw new Error('Task failed intentionally');
    }
  }

  describe('execute()', () => {
    it('should return PASS status when no errors', async () => {
      const task = new TestTask();
      const result = await task.execute();

      expect(result.status).toBe('PASS');
      expect(result.taskId).toBe('test-task');
      expect(result.taskName).toBe('Test Task');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should measure duration', async () => {
      const task = new TestTask();
      const result = await task.execute();

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.finishedAt).toBeInstanceOf(Date);
    });

    it('should return FAIL status when task throws', async () => {
      const task = new FailingTask();
      const result = await task.execute();

      expect(result.status).toBe('FAIL');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
