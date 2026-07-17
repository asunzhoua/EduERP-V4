import { AggregateRoot } from '../../shared/entity/aggregate-root';
import { FakeRepository } from '../fake-repository';

class TestAggregate extends AggregateRoot {
  constructor(id: number, createdBy: number) {
    super(id, createdBy);
  }
}

describe('FakeRepository', () => {
  let repo: FakeRepository<TestAggregate>;

  beforeEach(() => {
    repo = new FakeRepository<TestAggregate>();
  });

  describe('save() and findById()', () => {
    it('should save and retrieve aggregate', async () => {
      const aggregate = new TestAggregate(1, 100);

      await repo.save(aggregate);
      const found = await repo.findById(1);

      expect(found).toBe(aggregate);
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findById(999);

      expect(found).toBeNull();
    });
  });

  describe('findAll()', () => {
    it('should return all aggregates', async () => {
      const a1 = new TestAggregate(1, 100);
      const a2 = new TestAggregate(2, 100);

      await repo.save(a1);
      await repo.save(a2);

      const all = await repo.findAll();

      expect(all).toHaveLength(2);
      expect(all).toContain(a1);
      expect(all).toContain(a2);
    });

    it('should return empty array when no data', async () => {
      const all = await repo.findAll();

      expect(all).toHaveLength(0);
    });
  });

  describe('delete()', () => {
    it('should delete aggregate', async () => {
      const aggregate = new TestAggregate(1, 100);
      await repo.save(aggregate);

      await repo.delete(1);
      const found = await repo.findById(1);

      expect(found).toBeNull();
    });

    it('should not throw for non-existent id', async () => {
      await expect(repo.delete(999)).resolves.not.toThrow();
    });
  });

  describe('exists()', () => {
    it('should return true for existing aggregate', async () => {
      const aggregate = new TestAggregate(1, 100);
      await repo.save(aggregate);

      const exists = await repo.exists(1);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent aggregate', async () => {
      const exists = await repo.exists(999);

      expect(exists).toBe(false);
    });
  });

  describe('count()', () => {
    it('should return count of aggregates', async () => {
      await repo.save(new TestAggregate(1, 100));
      await repo.save(new TestAggregate(2, 100));
      await repo.save(new TestAggregate(3, 100));

      const count = await repo.count();

      expect(count).toBe(3);
    });
  });

  describe('clear()', () => {
    it('should clear all data', async () => {
      await repo.save(new TestAggregate(1, 100));
      await repo.save(new TestAggregate(2, 100));

      repo.clear();

      const count = await repo.count();
      expect(count).toBe(0);
    });
  });

  describe('all getter', () => {
    it('should return all aggregates', async () => {
      const a1 = new TestAggregate(1, 100);
      const a2 = new TestAggregate(2, 100);

      await repo.save(a1);
      await repo.save(a2);

      expect(repo.all).toHaveLength(2);
      expect(repo.all).toContain(a1);
      expect(repo.all).toContain(a2);
    });
  });
});
