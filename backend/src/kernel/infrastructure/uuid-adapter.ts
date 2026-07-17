/**
 * UuidAdapter — IUuid adapter for NestJS DI.
 *
 * Framework-independent. Zero NestJS imports.
 * Wraps IUuid for use in infrastructure layer.
 */

import { IUuid } from '../../shared/identifier/uuid';

export class UuidAdapter implements IUuid {
  constructor(private readonly uuid: IUuid) {}

  generate(): string {
    return this.uuid.generate();
  }
}
