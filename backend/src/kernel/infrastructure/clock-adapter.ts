/**
 * ClockAdapter — IClock adapter for NestJS DI.
 *
 * Framework-independent. Zero NestJS imports.
 * Wraps IClock for use in infrastructure layer.
 */

import { IClock } from '../../shared/clock/clock';

export class ClockAdapter implements IClock {
  constructor(private readonly clock: IClock) {}

  now(): Date {
    return this.clock.now();
  }
}
