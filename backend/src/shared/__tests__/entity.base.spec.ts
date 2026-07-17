import { BaseEntity } from '../entity/entity.base';

class TestEntity extends BaseEntity {
  constructor(id: number, createdBy: number, createdAt?: Date) {
    super(id, createdBy, createdAt);
  }
}

describe('BaseEntity', () => {
  it('should create entity with required fields', () => {
    const entity = new TestEntity(1, 100);

    expect(entity.id).toBe(1);
    expect(entity.createdBy).toBe(100);
    expect(entity.createdAt).toBeInstanceOf(Date);
    expect(entity.updatedAt).toBeNull();
    expect(entity.updatedBy).toBeNull();
    expect(entity.version).toBe(1);
    expect(entity.deleted).toBe(false);
  });

  it('should accept custom createdAt', () => {
    const date = new Date('2026-01-01');
    const entity = new TestEntity(1, 100, date);

    expect(entity.createdAt).toBe(date);
  });

  describe('touch()', () => {
    it('should update audit fields and increment version', () => {
      const entity = new TestEntity(1, 100);
      const beforeTouch = entity.version;

      entity.touch(200);

      expect(entity.updatedBy).toBe(200);
      expect(entity.updatedAt).toBeInstanceOf(Date);
      expect(entity.version).toBe(beforeTouch + 1);
    });
  });

  describe('softDelete()', () => {
    it('should mark entity as deleted', () => {
      const entity = new TestEntity(1, 100);

      entity.softDelete();

      expect(entity.deleted).toBe(true);
    });
  });

  describe('restore()', () => {
    it('should restore soft-deleted entity', () => {
      const entity = new TestEntity(1, 100);
      entity.softDelete();

      entity.restore();

      expect(entity.deleted).toBe(false);
    });
  });

  describe('equals()', () => {
    it('should return true for same id', () => {
      const a = new TestEntity(1, 100);
      const b = new TestEntity(1, 200);

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different ids', () => {
      const a = new TestEntity(1, 100);
      const b = new TestEntity(2, 100);

      expect(a.equals(b)).toBe(false);
    });

    it('should return false for null', () => {
      const a = new TestEntity(1, 100);

      expect(a.equals(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      const a = new TestEntity(1, 100);

      expect(a.equals(undefined)).toBe(false);
    });

    it('should return true for same instance', () => {
      const a = new TestEntity(1, 100);

      expect(a.equals(a)).toBe(true);
    });
  });
});
