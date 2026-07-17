import { ValueObject } from '../entity/value-object';

class Money extends ValueObject<{ amount: number; currency: string }> {
  constructor(amount: number, currency: string) {
    super({ amount, currency });
  }

  get amount(): number {
    return this._value.amount;
  }

  get currency(): string {
    return this._value.currency;
  }
}

describe('ValueObject', () => {
  it('should create value object with value', () => {
    const money = new Money(100, 'CNY');

    expect(money.amount).toBe(100);
    expect(money.currency).toBe('CNY');
  });

  it('should return frozen value', () => {
    const money = new Money(100, 'CNY');

    expect(Object.isFrozen(money.value)).toBe(true);
  });

  describe('equals()', () => {
    it('should return true for same values', () => {
      const a = new Money(100, 'CNY');
      const b = new Money(100, 'CNY');

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different values', () => {
      const a = new Money(100, 'CNY');
      const b = new Money(200, 'CNY');

      expect(a.equals(b)).toBe(false);
    });

    it('should return false for null', () => {
      const a = new Money(100, 'CNY');

      expect(a.equals(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      const a = new Money(100, 'CNY');

      expect(a.equals(undefined)).toBe(false);
    });

    it('should return true for same instance', () => {
      const a = new Money(100, 'CNY');

      expect(a.equals(a)).toBe(true);
    });
  });

  describe('toString()', () => {
    it('should return JSON string of value', () => {
      const money = new Money(100, 'CNY');

      expect(money.toString()).toBe('{"amount":100,"currency":"CNY"}');
    });
  });
});
