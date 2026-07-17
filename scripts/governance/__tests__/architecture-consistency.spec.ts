/**
 * Tests for ArchitectureConsistencyTask
 */

import { ArchitectureConsistencyTask } from '../tasks/architecture-consistency';

describe('ArchitectureConsistencyTask', () => {
  let task: ArchitectureConsistencyTask;

  beforeEach(() => {
    task = new ArchitectureConsistencyTask();
  });

  describe('task properties', () => {
    it('should have correct id', () => {
      expect(task.id).toBe('architecture-consistency');
    });

    it('should have correct name', () => {
      expect(task.name).toBe('Architecture Consistency');
    });

    it('should depend on freeze-audit', () => {
      expect(task.dependencies).toContain('freeze-audit');
    });
  });

  describe('execute()', () => {
    it('should return a GovernanceResult', async () => {
      const result = await task.execute();

      expect(result).toBeDefined();
      expect(result.taskId).toBe('architecture-consistency');
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
