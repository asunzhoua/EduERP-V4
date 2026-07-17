/**
 * Tests for TraceabilityValidationTask
 */

import { TraceabilityValidationTask } from '../tasks/traceability-validation';

describe('TraceabilityValidationTask', () => {
  let task: TraceabilityValidationTask;

  beforeEach(() => {
    task = new TraceabilityValidationTask();
  });

  describe('task properties', () => {
    it('should have correct id', () => {
      expect(task.id).toBe('traceability-validation');
    });

    it('should have correct name', () => {
      expect(task.name).toBe('Traceability Validation');
    });

    it('should depend on freeze-audit', () => {
      expect(task.dependencies).toContain('freeze-audit');
    });
  });

  describe('execute()', () => {
    it('should return a GovernanceResult', async () => {
      const result = await task.execute();

      expect(result).toBeDefined();
      expect(result.taskId).toBe('traceability-validation');
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
