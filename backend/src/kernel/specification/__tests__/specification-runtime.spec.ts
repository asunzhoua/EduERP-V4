import { CompositeSpecification } from '../../../shared/specification/composite-specification';
import { ISpecification } from '../../../shared/specification/specification';
import { SpecificationRuntime } from '../specification-runtime';

class IsPositive extends CompositeSpecification<number> {
  isSatisfiedBy(candidate: number): boolean {
    return candidate > 0;
  }
}

class IsEven extends CompositeSpecification<number> {
  isSatisfiedBy(candidate: number): boolean {
    return candidate % 2 === 0;
  }
}

class IsGreaterThanTen extends CompositeSpecification<number> {
  isSatisfiedBy(candidate: number): boolean {
    return candidate > 10;
  }
}

describe('SpecificationRuntime', () => {
  let runtime: SpecificationRuntime;

  beforeEach(() => {
    runtime = new SpecificationRuntime();
  });

  describe('register() and get()', () => {
    it('should register and retrieve a specification', () => {
      const isPositive = new IsPositive();

      runtime.register('isPositive', isPositive);

      expect(runtime.has('isPositive')).toBe(true);
      expect(runtime.get<number>('isPositive')).toBe(isPositive);
    });

    it('should return undefined for unregistered specification', () => {
      expect(runtime.has('unknown')).toBe(false);
      expect(runtime.get('unknown')).toBeUndefined();
    });
  });

  describe('named()', () => {
    it('should create a named specification and register it', () => {
      const isPositive = new IsPositive();
      const named = runtime.named('isPositive', isPositive);

      expect(named.name).toBe('isPositive');
      expect(named.isSatisfiedBy(5)).toBe(true);
      expect(named.isSatisfiedBy(-1)).toBe(false);
      expect(runtime.has('isPositive')).toBe(true);
    });
  });

  describe('evaluate()', () => {
    it('should return satisfied result when candidate passes', () => {
      const isPositive = new IsPositive();

      const result = runtime.evaluate(5, isPositive, 'isPositive');

      expect(result.satisfied).toBe(true);
      expect(result.specificationName).toBe('isPositive');
      expect(result.reason).toBeUndefined();
    });

    it('should return unsatisfied result when candidate fails', () => {
      const isPositive = new IsPositive();

      const result = runtime.evaluate(-1, isPositive, 'isPositive');

      expect(result.satisfied).toBe(false);
      expect(result.specificationName).toBe('isPositive');
      expect(result.reason).toContain('not satisfied');
    });

    it('should use default name when not provided', () => {
      const isPositive = new IsPositive();

      const result = runtime.evaluate(5, isPositive);

      expect(result.specificationName).toBe('unnamed');
    });
  });

  describe('evaluateMany()', () => {
    it('should evaluate multiple candidates', () => {
      const isPositive = new IsPositive();
      const candidates = [1, -2, 3, -4, 5];

      const results = runtime.evaluateMany(candidates, isPositive, 'isPositive');

      expect(results).toHaveLength(5);
      expect(results.filter((r) => r.satisfied)).toHaveLength(3);
      expect(results.filter((r) => !r.satisfied)).toHaveLength(2);
    });
  });

  describe('evaluateAll()', () => {
    it('should evaluate candidate against multiple specifications', () => {
      const isPositive = new IsPositive();
      const isEven = new IsEven();
      const isGreaterThanTen = new IsGreaterThanTen();

      const results = runtime.evaluateAll(12, [
        { spec: isPositive, name: 'isPositive' },
        { spec: isEven, name: 'isEven' },
        { spec: isGreaterThanTen, name: 'isGreaterThanTen' },
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.satisfied)).toBe(true);
    });

    it('should report failures', () => {
      const isPositive = new IsPositive();
      const isEven = new IsEven();
      const isGreaterThanTen = new IsGreaterThanTen();

      const results = runtime.evaluateAll(-5, [
        { spec: isPositive, name: 'isPositive' },
        { spec: isEven, name: 'isEven' },
        { spec: isGreaterThanTen, name: 'isGreaterThanTen' },
      ]);

      expect(results.filter((r) => r.satisfied)).toHaveLength(0);
      expect(results.filter((r) => !r.satisfied)).toHaveLength(3);
    });
  });

  describe('allSatisfy()', () => {
    it('should return true when all candidates satisfy', () => {
      const isPositive = new IsPositive();

      expect(runtime.allSatisfy([1, 2, 3], isPositive)).toBe(true);
    });

    it('should return false when any candidate fails', () => {
      const isPositive = new IsPositive();

      expect(runtime.allSatisfy([1, -2, 3], isPositive)).toBe(false);
    });

    it('should return true for empty array', () => {
      const isPositive = new IsPositive();

      expect(runtime.allSatisfy([], isPositive)).toBe(true);
    });
  });

  describe('anySatisfy()', () => {
    it('should return true when at least one candidate satisfies', () => {
      const isPositive = new IsPositive();

      expect(runtime.anySatisfy([-1, -2, 3], isPositive)).toBe(true);
    });

    it('should return false when no candidate satisfies', () => {
      const isPositive = new IsPositive();

      expect(runtime.anySatisfy([-1, -2, -3], isPositive)).toBe(false);
    });
  });

  describe('filter()', () => {
    it('should filter candidates satisfying specification', () => {
      const isEven = new IsEven();
      const candidates = [1, 2, 3, 4, 5, 6];

      const result = runtime.filter(candidates, isEven);

      expect(result).toEqual([2, 4, 6]);
    });

    it('should return empty array when no match', () => {
      const isEven = new IsEven();
      const candidates = [1, 3, 5];

      const result = runtime.filter(candidates, isEven);

      expect(result).toEqual([]);
    });
  });

  describe('findFirst()', () => {
    it('should return first matching candidate', () => {
      const isEven = new IsEven();
      const candidates = [1, 2, 3, 4];

      const result = runtime.findFirst(candidates, isEven);

      expect(result).toBe(2);
    });

    it('should return undefined when no match', () => {
      const isEven = new IsEven();
      const candidates = [1, 3, 5];

      const result = runtime.findFirst(candidates, isEven);

      expect(result).toBeUndefined();
    });
  });
});
