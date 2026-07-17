/**
 * CompositePolicy — Combine multiple policies.
 *
 * Framework-independent. Zero NestJS imports.
 * Supports All, Any, None composition patterns.
 */

import { IPolicy, PolicyResult } from './policy';

/**
 * CompositePolicy — Combines multiple policies using All, Any, or None logic.
 */
export class CompositePolicy<TContext> implements IPolicy<TContext> {
  readonly name: string;
  private readonly _policies: IPolicy<TContext>[];
  private readonly _strategy: 'all' | 'any' | 'none';

  private constructor(
    name: string,
    policies: IPolicy<TContext>[],
    strategy: 'all' | 'any' | 'none',
  ) {
    this.name = name;
    this._policies = policies;
    this._strategy = strategy;
  }

  /**
   * Create a composite that requires ALL policies to be satisfied.
   */
  static all<TContext>(
    name: string,
    policies: IPolicy<TContext>[],
  ): CompositePolicy<TContext> {
    return new CompositePolicy(name, policies, 'all');
  }

  /**
   * Create a composite that requires ANY policy to be satisfied.
   */
  static any<TContext>(
    name: string,
    policies: IPolicy<TContext>[],
  ): CompositePolicy<TContext> {
    return new CompositePolicy(name, policies, 'any');
  }

  /**
   * Create a composite that requires NONE of the policies to be satisfied.
   */
  static none<TContext>(
    name: string,
    policies: IPolicy<TContext>[],
  ): CompositePolicy<TContext> {
    return new CompositePolicy(name, policies, 'none');
  }

  evaluate(context: TContext): boolean {
    switch (this._strategy) {
      case 'all':
        return this._policies.every((p) => p.evaluate(context));
      case 'any':
        return this._policies.some((p) => p.evaluate(context));
      case 'none':
        return this._policies.every((p) => !p.evaluate(context));
    }
  }

  /**
   * Evaluate with diagnostics — returns detailed results.
   */
  evaluateWithDiagnostics(context: TContext): PolicyResult[] {
    return this._policies.map((p) => ({
      satisfied: p.evaluate(context),
      policyName: p.name,
      reason: p.evaluate(context)
        ? undefined
        : `Policy '${p.name}' not satisfied`,
    }));
  }
}
