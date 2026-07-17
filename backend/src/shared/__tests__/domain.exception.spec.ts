import {
  DomainException,
  InvariantViolationException,
  BusinessRuleViolationException,
} from '../exception/domain.exception';

describe('DomainException', () => {
  it('should create exception with message and code', () => {
    const error = new DomainException('Something went wrong', 'CUSTOM_CODE');

    expect(error.message).toBe('Something went wrong');
    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.name).toBe('DomainException');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainException);
  });

  it('should accept metadata', () => {
    const error = new DomainException('Error', 'CODE', { key: 'value' });

    expect(error.metadata).toEqual({ key: 'value' });
  });

  it('should have default code', () => {
    const error = new DomainException('Error');

    expect(error.code).toBe('DOMAIN_ERROR');
  });
});

describe('InvariantViolationException', () => {
  it('should create exception with invariant id', () => {
    const error = new InvariantViolationException(
      'remainingLessons cannot be negative',
      'CONTRACT-001',
    );

    expect(error.message).toBe('remainingLessons cannot be negative');
    expect(error.code).toBe('INVARIANT_VIOLATION');
    expect(error.name).toBe('InvariantViolationException');
    expect(error.metadata).toEqual({ invariantId: 'CONTRACT-001' });
    expect(error).toBeInstanceOf(DomainException);
  });
});

describe('BusinessRuleViolationException', () => {
  it('should create exception with rule id', () => {
    const error = new BusinessRuleViolationException(
      'Student must be ACTIVE to enroll',
      'ENROLL-002',
    );

    expect(error.message).toBe('Student must be ACTIVE to enroll');
    expect(error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(error.name).toBe('BusinessRuleViolationException');
    expect(error.metadata).toEqual({ ruleId: 'ENROLL-002' });
    expect(error).toBeInstanceOf(DomainException);
  });
});
