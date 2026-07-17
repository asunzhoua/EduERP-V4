/**
 * InvariantValidator — Validates aggregate invariants before persistence.
 *
 * Framework-independent. Zero NestJS imports.
 * Calls aggregate.validateInvariants() and catches InvariantViolationException.
 */

import { AggregateRoot } from '../../shared/entity/aggregate-root';
import { InvariantViolationException } from '../../shared/exception/domain.exception';

export class InvariantValidationResult {
  constructor(
    public readonly isValid: boolean,
    public readonly errors: InvariantViolationException[],
  ) {}
}

export class InvariantValidator {
  /**
   * Validate all invariants for an aggregate.
   * Returns result without throwing.
   */
  static validate(aggregate: AggregateRoot): InvariantValidationResult {
    const errors: InvariantViolationException[] = [];

    try {
      aggregate.validateInvariants();
    } catch (error) {
      if (error instanceof InvariantViolationException) {
        errors.push(error);
      } else {
        throw error;
      }
    }

    return new InvariantValidationResult(errors.length === 0, errors);
  }

  /**
   * Validate and throw on first violation.
   */
  static validateOrThrow(aggregate: AggregateRoot): void {
    const result = this.validate(aggregate);

    if (!result.isValid) {
      throw result.errors[0];
    }
  }
}
