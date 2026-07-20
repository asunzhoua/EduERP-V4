/**
 * IUseCase — Interface for use cases.
 *
 * Framework-independent. Zero NestJS imports.
 * A use case encapsulates a single business operation.
 */

import { Result } from '../../shared/result/result';

export interface IUseCase<TCommand, TResult> {
  /**
   * Execute the use case with the given command/input.
   */
  execute(command: TCommand): Promise<Result<TResult>>;
}
