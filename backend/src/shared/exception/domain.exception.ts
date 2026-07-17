/**
 * DomainException — Base exception for all domain errors.
 *
 * Framework-independent. Zero NestJS imports.
 */

export class DomainException extends Error {
  public readonly code: string;
  public readonly metadata: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'DOMAIN_ERROR',
    metadata: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DomainException';
    this.code = code;
    this.metadata = metadata;
  }
}

/**
 * InvariantViolation — Thrown when an aggregate invariant is violated.
 */
export class InvariantViolationException extends DomainException {
  constructor(
    message: string,
    invariantId: string,
    metadata: Record<string, unknown> = {},
  ) {
    super(message, 'INVARIANT_VIOLATION', { invariantId, ...metadata });
    this.name = 'InvariantViolationException';
  }
}

/**
 * BusinessRuleViolation — Thrown when a business rule (specification) fails.
 */
export class BusinessRuleViolationException extends DomainException {
  constructor(
    message: string,
    ruleId: string,
    metadata: Record<string, unknown> = {},
  ) {
    super(message, 'BUSINESS_RULE_VIOLATION', { ruleId, ...metadata });
    this.name = 'BusinessRuleViolationException';
  }
}
