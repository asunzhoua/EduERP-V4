import { Result } from '../result/result';

describe('Result', () => {
  describe('ok()', () => {
    it('should create success result', () => {
      const result = Result.ok(42);

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBe(42);
    });
  });

  describe('fail()', () => {
    it('should create failure result', () => {
      const error = new Error('Something went wrong');
      const result = Result.fail(error);

      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('value getter', () => {
    it('should throw on failure', () => {
      const result = Result.fail(new Error('fail'));

      expect(() => result.value).toThrow('Cannot get value from a failed result');
    });
  });

  describe('error getter', () => {
    it('should throw on success', () => {
      const result = Result.ok(42);

      expect(() => result.error).toThrow('Cannot get error from a successful result');
    });
  });

  describe('combine()', () => {
    it('should return ok when all results are ok', () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)];

      const combined = Result.combine(results);

      expect(combined.isSuccess).toBe(true);
    });

    it('should return first failure', () => {
      const error = new Error('fail');
      const results = [Result.ok(1), Result.fail(error), Result.ok(3)];

      const combined = Result.combine(results);

      expect(combined.isFailure).toBe(true);
      expect(combined.error).toBe(error);
    });
  });

  describe('map()', () => {
    it('should transform success value', () => {
      const result = Result.ok(5);

      const mapped = result.map((x) => x * 2);

      expect(mapped.value).toBe(10);
    });

    it('should not transform failure', () => {
      const error = new Error('fail');
      const result = Result.fail<number>(error);

      const mapped = result.map((x) => x * 2);

      expect(mapped.isFailure).toBe(true);
      expect(mapped.error).toBe(error);
    });
  });

  describe('flatMap()', () => {
    it('should chain success results', () => {
      const result = Result.ok(5);
      const doubled = (x: number) => Result.ok(x * 2);

      const chained = result.flatMap(doubled);

      expect(chained.value).toBe(10);
    });

    it('should short-circuit on failure', () => {
      const error = new Error('fail');
      const result = Result.fail<number>(error);
      const doubled = (x: number) => Result.ok(x * 2);

      const chained = result.flatMap(doubled);

      expect(chained.isFailure).toBe(true);
      expect(chained.error).toBe(error);
    });

    it('should propagate inner failure', () => {
      const result = Result.ok(5);
      const failFn = (_x: number) => Result.fail<number>(new Error('inner fail'));

      const chained = result.flatMap(failFn);

      expect(chained.isFailure).toBe(true);
      expect(chained.error.message).toBe('inner fail');
    });
  });
});
