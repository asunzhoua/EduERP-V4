/**
 * IMiddleware — Interface for pipeline middleware.
 *
 * Framework-independent. Zero NestJS imports.
 * Middleware wraps use case execution for cross-cutting concerns.
 */

export interface IMiddleware<TContext> {
  /**
   * Execute the middleware.
   * Call next() to proceed to the next middleware or the use case.
   */
  execute(context: TContext, next: () => Promise<void>): Promise<void>;
}
