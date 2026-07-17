/**
 * Tests for FrictionEnforcementTask
 */

import { FrictionEnforcementTask } from '../tasks/friction-enforcement';

describe('FrictionEnforcementTask', () => {
  let task: FrictionEnforcementTask;

  beforeEach(() => {
    task = new FrictionEnforcementTask();
  });

  describe('task properties', () => {
    it('should have correct id', () => {
      expect(task.id).toBe('friction-enforcement');
    });

    it('should have correct name', () => {
      expect(task.name).toBe('Friction Enforcement');
    });

    it('should depend on freeze-audit', () => {
      expect(task.dependencies).toContain('freeze-audit');
    });
  });

  describe('execute()', () => {
    it('should return a GovernanceResult', async () => {
      const result = await task.execute();

      expect(result).toBeDefined();
      expect(result.taskId).toBe('friction-enforcement');
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
