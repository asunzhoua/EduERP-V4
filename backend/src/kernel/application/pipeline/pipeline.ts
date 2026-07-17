/**
 * Pipeline — Middleware pipeline for cross-cutting concerns.
 *
 * Framework-independent. Zero NestJS imports.
 * Chains middleware before use case execution.
 */

import { IMiddleware } from './middleware';

export class Pipeline<TContext> {
  private readonly _middlewares: IMiddleware<TContext>[] = [];

  /**
   * Add a middleware to the pipeline.
   */
  use(middleware: IMiddleware<TContext>): Pipeline<TContext> {
    this._middlewares.push(middleware);
    return this;
  }

  /**
   * Execute the pipeline with a final handler.
   */
  async execute(context: TContext, handler: () => Promise<void>): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this._middlewares.length) {
        const middleware = this._middlewares[index++];
        await middleware.execute(context, next);
      } else {
        await handler();
      }
    };

    await next();
  }

  /**
   * Get the number of middleware in the pipeline.
   */
  get count(): number {
    return this._middlewares.length;
  }
}
