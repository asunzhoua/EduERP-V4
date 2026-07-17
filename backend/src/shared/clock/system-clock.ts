/**
 * SystemClock — Real clock implementation.
 *
 * Framework-independent. Zero NestJS imports.
 * Uses Date.now() for current time.
 */

import { IClock } from './clock';

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
