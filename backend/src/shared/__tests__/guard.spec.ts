import { Guard } from '../guard/guard';
import { DomainException } from '../exception/domain.exception';

describe('Guard', () => {
  describe('againstNull()', () => {
    it('should throw for null', () => {
      expect(() => Guard.againstNull(null, 'name')).toThrow(DomainException);
    });

    it('should throw for undefined', () => {
      expect(() => Guard.againstNull(undefined, 'name')).toThrow(DomainException);
    });

    it('should not throw for valid value', () => {
      expect(() => Guard.againstNull('hello', 'name')).not.toThrow();
    });

    it('should not throw for 0', () => {
      expect(() => Guard.againstNull(0, 'name')).not.toThrow();
    });

    it('should not throw for empty string', () => {
      expect(() => Guard.againstNull('', 'name')).not.toThrow();
    });
  });

  describe('againstEmpty()', () => {
    it('should throw for empty string', () => {
      expect(() => Guard.againstEmpty('', 'name')).toThrow(DomainException);
    });

    it('should throw for whitespace only', () => {
      expect(() => Guard.againstEmpty('   ', 'name')).toThrow(DomainException);
    });

    it('should throw for null', () => {
      expect(() => Guard.againstEmpty(null as any, 'name')).toThrow(DomainException);
    });

    it('should not throw for valid string', () => {
      expect(() => Guard.againstEmpty('hello', 'name')).not.toThrow();
    });
  });

  describe('againstRange()', () => {
    it('should throw for value below min', () => {
      expect(() => Guard.againstRange(0, 1, 10, 'age')).toThrow(DomainException);
    });

    it('should throw for value above max', () => {
      expect(() => Guard.againstRange(11, 1, 10, 'age')).toThrow(DomainException);
    });

    it('should not throw for value in range', () => {
      expect(() => Guard.againstRange(5, 1, 10, 'age')).not.toThrow();
    });

    it('should not throw for boundary values', () => {
      expect(() => Guard.againstRange(1, 1, 10, 'age')).not.toThrow();
      expect(() => Guard.againstRange(10, 1, 10, 'age')).not.toThrow();
    });
  });

  describe('againstOneOf()', () => {
    it('should throw for value not in allowed list', () => {
      expect(() => Guard.againstOneOf('invalid', ['A', 'B'], 'status')).toThrow(
        DomainException,
      );
    });

    it('should not throw for value in allowed list', () => {
      expect(() => Guard.againstOneOf('A', ['A', 'B'], 'status')).not.toThrow();
    });
  });

  describe('againstNotEqual()', () => {
    it('should throw for equal values', () => {
      expect(() => Guard.againstNotEqual('same', 'same', 'field')).toThrow(
        DomainException,
      );
    });

    it('should not throw for different values', () => {
      expect(() => Guard.againstNotEqual('a', 'b', 'field')).not.toThrow();
    });
  });

  describe('againstEmptyArray()', () => {
    it('should throw for empty array', () => {
      expect(() => Guard.againstEmptyArray([], 'items')).toThrow(DomainException);
    });

    it('should throw for non-array', () => {
      expect(() => Guard.againstEmptyArray(null as any, 'items')).toThrow(
        DomainException,
      );
    });

    it('should not throw for non-empty array', () => {
      expect(() => Guard.againstEmptyArray([1], 'items')).not.toThrow();
    });
  });
});
