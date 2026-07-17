/**
 * IQueryHandler — Interface for query handlers.
 *
 * Framework-independent. Zero NestJS imports.
 * Each query has exactly one handler that retrieves information.
 */

import { IQuery } from './query';
import { Result } from '../../../shared/result/result';

export interface IQueryHandler<TQuery extends IQuery<TResult>, TResult> {
  /**
   * Execute the query.
   */
  execute(query: TQuery): Promise<Result<TResult>>;
}
