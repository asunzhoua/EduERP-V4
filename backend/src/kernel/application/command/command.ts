/**
 * ICommand — Interface for commands.
 *
 * Framework-independent. Zero NestJS imports.
 * Commands represent intentions to change system state.
 */

export interface ICommand {
  /**
   * Unique command identifier.
   */
  readonly commandId: string;

  /**
   * Timestamp when command was created.
   */
  readonly timestamp: Date;
}

/**
 * Base command with common fields.
 */
export abstract class CommandBase implements ICommand {
  public readonly commandId: string;
  public readonly timestamp: Date;

  constructor(commandId?: string, timestamp?: Date) {
    this.commandId = commandId || crypto.randomUUID();
    this.timestamp = timestamp || new Date();
  }
}
