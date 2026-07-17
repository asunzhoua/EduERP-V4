import { AggregateRoot } from '../../../shared/entity/aggregate-root';
import { InvariantViolationException } from '../../../shared/exception/domain.exception';
import { InvariantValidator } from '../invariant-validator';

class ValidAggregate extends AggregateRoot {
  constructor(id: number) {
    super(id, 100);
  }

  validateInvariants(): void {
    this.invariant(true, 'VALID-001', 'Should pass');
  }
}

class InvalidAggregate extends AggregateRoot {
  constructor(id: number) {
    super(id, 100);
  }

  validateInvariants(): void {
    this.invariant(false, 'INVALID-001', 'Should fail');
  }
}

describe('InvariantValidator', () => {
  describe('validate()', () => {
    it('should return valid result for valid aggregate', () => {
      const aggregate = new ValidAggregate(1);

      const result = InvariantValidator.validate(aggregate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid result for invalid aggregate', () => {
      const aggregate = new InvalidAggregate(1);

      const result = InvariantValidator.validate(aggregate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBeInstanceOf(InvariantViolationException);
    });
  });

  describe('validateOrThrow()', () => {
    it('should not throw for valid aggregate', () => {
      const aggregate = new ValidAggregate(1);

      expect(() => InvariantValidator.validateOrThrow(aggregate)).not.toThrow();
    });

    it('should throw for invalid aggregate', () => {
      const aggregate = new InvalidAggregate(1);

      expect(() => InvariantValidator.validateOrThrow(aggregate)).toThrow(
        InvariantViolationException,
      );
    });
  });
});
