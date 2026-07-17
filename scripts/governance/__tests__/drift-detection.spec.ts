/**
 * Tests for DriftDetectionTask
 */

import { DriftDetectionTask } from '../tasks/drift-detection';

describe('DriftDetectionTask', () => {
  let task: DriftDetectionTask;

  beforeEach(() => {
    task = new DriftDetectionTask();
  });

  describe('task properties', () => {
    it('should have correct id', () => {
      expect(task.id).toBe('drift-detection');
    });

    it('should have correct name', () => {
      expect(task.name).toBe('Drift Detection');
    });

    it('should depend on freeze-audit', () => {
      expect(task.dependencies).toContain('freeze-audit');
    });
  });

  describe('execute()', () => {
    it('should return a GovernanceResult', async () => {
      const result = await task.execute();

      expect(result).toBeDefined();
      expect(result.taskId).toBe('drift-detection');
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
