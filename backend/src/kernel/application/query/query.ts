/**
 * IQuery — Interface for queries.
 *
 * Framework-independent. Zero NestJS imports.
 * Queries represent requests for information without side effects.
 */

export interface IQuery<TResult> {
  /**
   * Unique query identifier.
   */
  readonly queryId: string;

  /**
   * Timestamp when query was created.
   */
  readonly timestamp: Date;
}

/**
 * Base query with common fields.
 */
export abstract class QueryBase<TResult> implements IQuery<TResult> {
  public readonly queryId: string;
  public readonly timestamp: Date;

  constructor(queryId?: string, timestamp?: Date) {
    this.queryId = queryId || crypto.randomUUID();
    this.timestamp = timestamp || new Date();
  }
}
