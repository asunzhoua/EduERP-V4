import { OptimisticLock, OptimisticLockException } from '../optimistic-lock';

describe('OptimisticLock', () => {
  describe('check()', () => {
    it('should pass when versions match', () => {
      expect(() => {
        OptimisticLock.check('Lesson', 1, 1, 1);
      }).not.toThrow();
    });

    it('should throw OptimisticLockException when versions mismatch', () => {
      expect(() => {
        OptimisticLock.check('Lesson', 1, 1, 2);
      }).toThrow(OptimisticLockException);
    });

    it('should include details in exception', () => {
      try {
        OptimisticLock.check('Lesson', 1, 1, 2);
      } catch (error) {
        expect(error).toBeInstanceOf(OptimisticLockException);
        expect(error.code).toBe('OPTIMISTIC_LOCK');
        expect(error.metadata).toEqual({
          entityType: 'Lesson',
          entityId: 1,
          expectedVersion: 1,
          actualVersion: 2,
        });
      }
    });
  });
});
