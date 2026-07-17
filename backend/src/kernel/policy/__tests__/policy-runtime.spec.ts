import { IPolicy } from '../policy';
import { CompositePolicy } from '../composite-policy';
import { PolicyContext } from '../policy-context';

class AgeCheckPolicy implements IPolicy<{ age: number }> {
  readonly name = 'ageCheck';
  evaluate(context: { age: number }): boolean {
    return context.age >= 18;
  }
}

class EmailCheckPolicy implements IPolicy<{ email: string }> {
  readonly name = 'emailCheck';
  evaluate(context: { email: string }): boolean {
    return context.email.includes('@');
  }
}

describe('PolicyRuntime', () => {
  describe('IPolicy', () => {
    it('should evaluate a policy', () => {
      const policy = new AgeCheckPolicy();
      const ctx = new PolicyContext({ age: 20 });

      expect(policy.evaluate(ctx.data)).toBe(true);
      expect(policy.name).toBe('ageCheck');
    });

    it('should fail when policy is not satisfied', () => {
      const policy = new AgeCheckPolicy();
      const ctx = new PolicyContext({ age: 15 });

      expect(policy.evaluate(ctx.data)).toBe(false);
    });
  });

  describe('CompositePolicy.all()', () => {
    it('should return true when all policies pass', () => {
      const composite = CompositePolicy.all('bothChecks', [
        new AgeCheckPolicy(),
        { name: 'emailCheck', evaluate: (ctx: { age: number; email: string }) => ctx.email.includes('@') } as IPolicy<{ age: number; email: string }>,
      ]);

      expect(composite.evaluate({ age: 20, email: 'test@example.com' })).toBe(true);
    });

    it('should return false when any policy fails', () => {
      const composite = CompositePolicy.all('bothChecks', [
        new AgeCheckPolicy(),
        { name: 'emailCheck', evaluate: (ctx: { age: number; email: string }) => ctx.email.includes('@') } as IPolicy<{ age: number; email: string }>,
      ]);

      expect(composite.evaluate({ age: 15, email: 'test@example.com' })).toBe(false);
    });

    it('should have correct name', () => {
      const composite = CompositePolicy.all('myPolicy', []);
      expect(composite.name).toBe('myPolicy');
    });
  });

  describe('CompositePolicy.any()', () => {
    it('should return true when at least one policy passes', () => {
      const composite = CompositePolicy.any('eitherCheck', [
        { name: 'alwaysFail', evaluate: () => false } as IPolicy<{}>,
        { name: 'alwaysPass', evaluate: () => true } as IPolicy<{}>,
      ]);

      expect(composite.evaluate({})).toBe(true);
    });

    it('should return false when no policy passes', () => {
      const composite = CompositePolicy.any('eitherCheck', [
        { name: 'alwaysFail1', evaluate: () => false } as IPolicy<{}>,
        { name: 'alwaysFail2', evaluate: () => false } as IPolicy<{}>,
      ]);

      expect(composite.evaluate({})).toBe(false);
    });
  });

  describe('CompositePolicy.none()', () => {
    it('should return true when no policy passes', () => {
      const composite = CompositePolicy.none('noneCheck', [
        { name: 'alwaysFail', evaluate: () => false } as IPolicy<{}>,
        { name: 'alsoFail', evaluate: () => false } as IPolicy<{}>,
      ]);

      expect(composite.evaluate({})).toBe(true);
    });

    it('should return false when any policy passes', () => {
      const composite = CompositePolicy.none('noneCheck', [
        { name: 'alwaysPass', evaluate: () => true } as IPolicy<{}>,
        { name: 'alsoFail', evaluate: () => false } as IPolicy<{}>,
      ]);

      expect(composite.evaluate({})).toBe(false);
    });
  });

  describe('evaluateWithDiagnostics()', () => {
    it('should return diagnostic results for each policy', () => {
      const composite = CompositePolicy.all('diagnosticTest', [
        new AgeCheckPolicy(),
        { name: 'emailCheck', evaluate: (ctx: { age: number; email: string }) => ctx.email.includes('@') } as IPolicy<{ age: number; email: string }>,
      ]);

      const results = composite.evaluateWithDiagnostics({ age: 15, email: 'bad' });

      expect(results).toHaveLength(2);
      expect(results[0].satisfied).toBe(false);
      expect(results[0].policyName).toBe('ageCheck');
      expect(results[0].reason).toContain('not satisfied');
      expect(results[1].satisfied).toBe(false);
    });
  });

  describe('PolicyContext', () => {
    it('should hold and retrieve data', () => {
      const ctx = new PolicyContext({ age: 25, name: 'Alice' });

      expect(ctx.data).toEqual({ age: 25, name: 'Alice' });
      expect(ctx.get('age')).toBe(25);
      expect(ctx.get('name')).toBe('Alice');
    });

    it('should check key existence', () => {
      const ctx = new PolicyContext({ age: 25 });

      expect(ctx.has('age')).toBe(true);
      expect(ctx.has('name' as any)).toBe(false);
    });

    it('should freeze data to prevent mutation', () => {
      const ctx = new PolicyContext({ age: 25 });

      expect(() => {
        (ctx.data as any).age = 30;
      }).toThrow();
    });
  });
});
