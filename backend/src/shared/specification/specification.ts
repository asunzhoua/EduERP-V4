/**
 * ISpecification — Interface for business rule specifications.
 *
 * Framework-independent. Zero NestJS imports.
 * Specifications are composable predicates that encapsulate business rules.
 */

export interface ISpecification<T> {
  /**
   * Check if candidate satisfies this specification.
   */
  isSatisfiedBy(candidate: T): boolean;
}
