import { ISpecification } from '../specification/specification';
import {
  CompositeSpecification,
  AndSpecification,
  OrSpecification,
  NotSpecification,
} from '../specification/composite-specification';

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

describe('Specification', () => {
  describe('AndSpecification', () => {
    it('should return true when both are satisfied', () => {
      const spec = new AndSpecification(new IsPositive(), new IsEven());

      expect(spec.isSatisfiedBy(2)).toBe(true);
    });

    it('should return false when left is not satisfied', () => {
      const spec = new AndSpecification(new IsPositive(), new IsEven());

      expect(spec.isSatisfiedBy(-2)).toBe(false);
    });

    it('should return false when right is not satisfied', () => {
      const spec = new AndSpecification(new IsPositive(), new IsEven());

      expect(spec.isSatisfiedBy(3)).toBe(false);
    });
  });

  describe('OrSpecification', () => {
    it('should return true when left is satisfied', () => {
      const spec = new OrSpecification(new IsPositive(), new IsEven());

      expect(spec.isSatisfiedBy(1)).toBe(true);
    });

    it('should return true when right is satisfied', () => {
      const spec = new OrSpecification(new IsPositive(), new IsEven());

      expect(spec.isSatisfiedBy(-2)).toBe(true);
    });

    it('should return false when neither is satisfied', () => {
      const spec = new OrSpecification(new IsPositive(), new IsEven());

      expect(spec.isSatisfiedBy(-1)).toBe(false);
    });
  });

  describe('NotSpecification', () => {
    it('should return true when inner is not satisfied', () => {
      const spec = new NotSpecification(new IsPositive());

      expect(spec.isSatisfiedBy(-1)).toBe(true);
    });

    it('should return false when inner is satisfied', () => {
      const spec = new NotSpecification(new IsPositive());

      expect(spec.isSatisfiedBy(1)).toBe(false);
    });
  });

  describe('Composite methods', () => {
    it('should chain with and()', () => {
      const spec = new IsPositive().and(new IsEven());

      expect(spec.isSatisfiedBy(2)).toBe(true);
      expect(spec.isSatisfiedBy(3)).toBe(false);
    });

    it('should chain with or()', () => {
      const spec = new IsPositive().or(new IsEven());

      expect(spec.isSatisfiedBy(1)).toBe(true);
      expect(spec.isSatisfiedBy(-2)).toBe(true);
      expect(spec.isSatisfiedBy(-1)).toBe(false);
    });

    it('should chain with not()', () => {
      const spec = new IsPositive().not();

      expect(spec.isSatisfiedBy(-1)).toBe(true);
      expect(spec.isSatisfiedBy(1)).toBe(false);
    });

    it('should support complex chains', () => {
      const spec = new IsPositive()
        .and(new IsEven())
        .or(new IsGreaterThanTen());

      expect(spec.isSatisfiedBy(2)).toBe(true);   // positive AND even
      expect(spec.isSatisfiedBy(11)).toBe(true);  // > 10
      expect(spec.isSatisfiedBy(-1)).toBe(false);  // neither
    });
  });
});
