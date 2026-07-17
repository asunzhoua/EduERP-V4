/**
 * IPolicy — Interface for business policies.
 *
 * Framework-independent. Zero NestJS imports.
 * Policies encapsulate business rules that may trigger side effects.
 */

export interface IPolicy<TContext> {
  /**
   * Evaluate the policy against a context.
   * Returns true if the policy is satisfied.
   */
  evaluate(context: TContext): boolean;

  /**
   * Get the policy name for diagnostics.
   */
  readonly name: string;
}

/**
 * PolicyResult — Result of policy evaluation with diagnostics.
 */
export interface PolicyResult {
  readonly satisfied: boolean;
  readonly policyName: string;
  readonly reason?: string;
}
