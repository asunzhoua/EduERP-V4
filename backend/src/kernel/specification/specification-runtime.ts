/**
 * SpecificationRuntime — Runtime for evaluating specifications.
 *
 * Framework-independent. Zero NestJS imports.
 * Provides batch evaluation, named specifications, and diagnostic results.
 */

import { ISpecification } from '../../shared/specification/specification';
import { CompositeSpecification } from '../../shared/specification/composite-specification';

/**
 * Result of evaluating a specification against a candidate.
 */
export interface SpecificationResult {
  readonly satisfied: boolean;
  readonly specificationName: string;
  readonly reason?: string;
}

/**
 * Named specification with metadata.
 */
export interface NamedSpecification<T> extends ISpecification<T> {
  readonly name: string;
}

/**
 * SpecificationRuntime — Provides batch evaluation, named specifications,
 * and diagnostic results for specification-based business rules.
 */
export class SpecificationRuntime {
  private readonly _registry = new Map<string, ISpecification<any>>();

  /**
   * Register a named specification.
   */
  register<T>(name: string, spec: ISpecification<T>): void {
    this._registry.set(name, spec);
  }

  /**
   * Get a registered specification by name.
   */
  get<T>(name: string): ISpecification<T> | undefined {
    return this._registry.get(name) as ISpecification<T> | undefined;
  }

  /**
   * Check if a specification is registered.
   */
  has(name: string): boolean {
    return this._registry.has(name);
  }

  /**
   * Evaluate a single specification against a candidate.
   * Returns a diagnostic result.
   */
  evaluate<T>(
    candidate: T,
    spec: ISpecification<T>,
    name = 'unnamed',
  ): SpecificationResult {
    const satisfied = spec.isSatisfiedBy(candidate);
    return {
      satisfied,
      specificationName: name,
      reason: satisfied ? undefined : `Specification '${name}' not satisfied`,
    };
  }

  /**
   * Evaluate multiple candidates against a specification.
   * Returns results for each candidate.
   */
  evaluateMany<T>(
    candidates: T[],
    spec: ISpecification<T>,
    name = 'unnamed',
  ): SpecificationResult[] {
    return candidates.map((candidate) =>
      this.evaluate(candidate, spec, name),
    );
  }

  /**
   * Evaluate a candidate against multiple specifications (AND logic).
   * Returns the first failure, or a success result if all pass.
   */
  evaluateAll<T>(
    candidate: T,
    specs: Array<{ spec: ISpecification<T>; name: string }>,
  ): SpecificationResult[] {
    return specs.map(({ spec, name }) =>
      this.evaluate(candidate, spec, name),
    );
  }

  /**
   * Check if all candidates satisfy a specification.
   */
  allSatisfy<T>(candidates: T[], spec: ISpecification<T>): boolean {
    return candidates.every((candidate) => spec.isSatisfiedBy(candidate));
  }

  /**
   * Check if any candidate satisfies a specification.
   */
  anySatisfy<T>(candidates: T[], spec: ISpecification<T>): boolean {
    return candidates.some((candidate) => spec.isSatisfiedBy(candidate));
  }

  /**
   * Filter candidates that satisfy a specification.
   */
  filter<T>(candidates: T[], spec: ISpecification<T>): T[] {
    return candidates.filter((candidate) => spec.isSatisfiedBy(candidate));
  }

  /**
   * Find first candidate that satisfies a specification.
   */
  findFirst<T>(candidates: T[], spec: ISpecification<T>): T | undefined {
    return candidates.find((candidate) => spec.isSatisfiedBy(candidate));
  }

  /**
   * Create a named specification wrapper.
   */
  named<T>(name: string, spec: ISpecification<T>): NamedSpecification<T> {
    const namedSpec: NamedSpecification<T> = {
      isSatisfiedBy: (candidate: T) => spec.isSatisfiedBy(candidate),
      name,
    };
    this.register(name, namedSpec);
    return namedSpec;
  }
}
