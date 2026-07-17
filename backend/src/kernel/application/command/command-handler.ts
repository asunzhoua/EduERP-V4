/**
 * ICommandHandler — Interface for command handlers.
 *
 * Framework-independent. Zero NestJS imports.
 * Each command has exactly one handler that executes the business logic.
 */

import { ICommand } from './command';
import { Result } from '../../../shared/result/result';

export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  /**
   * Execute the command.
   */
  execute(command: TCommand): Promise<Result<TResult>>;
}
