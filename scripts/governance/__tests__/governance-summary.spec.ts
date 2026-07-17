/**
 * Tests for GovernanceSummaryTask
 */

import { GovernanceSummaryTask } from '../tasks/governance-summary';

describe('GovernanceSummaryTask', () => {
  let task: GovernanceSummaryTask;

  beforeEach(() => {
    task = new GovernanceSummaryTask();
  });

  describe('task properties', () => {
    it('should have correct id', () => {
      expect(task.id).toBe('governance-summary');
    });

    it('should have correct name', () => {
      expect(task.name).toBe('Governance Summary');
    });

    it('should depend on all validation tasks', () => {
      expect(task.dependencies).toContain('freeze-audit');
      expect(task.dependencies).toContain('event-validation');
      expect(task.dependencies).toContain('traceability-validation');
      expect(task.dependencies).toContain('drift-detection');
      expect(task.dependencies).toContain('architecture-consistency');
      expect(task.dependencies).toContain('friction-enforcement');
    });
  });

  describe('execute()', () => {
    it('should return a GovernanceResult', async () => {
      const result = await task.execute();

      expect(result).toBeDefined();
      expect(result.taskId).toBe('governance-summary');
      expect(result.status).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should have statistics', async () => {
      const result = await task.execute();

      expect(result.statistics).toBeDefined();
      expect(result.statistics.checksPerformed).toBeGreaterThan(0);
    });
  });
});
