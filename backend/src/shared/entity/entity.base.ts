/**
 * BaseEntity — Foundation for all persistent entities in EduOS.
 *
 * Framework-independent. Zero NestJS imports.
 * Every entity that maps to a database table extends this class.
 */

export abstract class BaseEntity {
  protected readonly _id: number;
  protected _createdAt: Date;
  protected _createdBy: number;
  protected _updatedAt: Date | null;
  protected _updatedBy: number | null;
  protected _version: number;
  protected _deleted: boolean;

  constructor(
    id: number,
    createdBy: number,
    createdAt?: Date,
  ) {
    this._id = id;
    this._createdBy = createdBy;
    this._createdAt = createdAt ?? new Date();
    this._updatedAt = null;
    this._updatedBy = null;
    this._version = 1;
    this._deleted = false;
  }

  // ── Getters ──────────────────────────────────────────────

  get id(): number {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get createdBy(): number {
    return this._createdBy;
  }

  get updatedAt(): Date | null {
    return this._updatedAt;
  }

  get updatedBy(): number | null {
    return this._updatedBy;
  }

  get version(): number {
    return this._version;
  }

  get deleted(): boolean {
    return this._deleted;
  }

  // ── Mutations ────────────────────────────────────────────

  /**
   * Mark entity as updated. Called by repository before persistence.
   */
  touch(updatedBy: number): void {
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();
    this._version += 1;
  }

  /**
   * Soft delete. Entity remains in database but is excluded from queries.
   */
  softDelete(): void {
    this._deleted = true;
  }

  /**
   * Restore soft-deleted entity.
   */
  restore(): void {
    this._deleted = false;
  }

  // ── Equality ─────────────────────────────────────────────

  /**
   * Two entities are equal if they have the same id.
   */
  equals(other: BaseEntity | null | undefined): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (this === other) {
      return true;
    }
    return this._id === other._id;
  }
}
