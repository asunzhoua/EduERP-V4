/**
 * SystemUuid — Real UUID implementation.
 *
 * Framework-independent. Zero NestJS imports.
 * Uses the 'uuid' package for UUID v4 generation.
 */

import { v4 as uuidv4 } from 'uuid';
import { IUuid } from './uuid';

export class SystemUuid implements IUuid {
  generate(): string {
    return uuidv4();
  }
}
