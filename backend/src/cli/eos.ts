/**
 * eos — EduOS CLI entry point.
 *
 * Code generation tool for generating DDD skeletons.
 */

import { generateAggregate } from './commands/generate-aggregate';
import { generateValueObject } from './commands/generate-value-object';
import { generateEntity } from './commands/generate-entity';
import { generateRepository } from './commands/generate-repository';
import { generateUseCase } from './commands/generate-use-case';
import { generateEvent } from './commands/generate-event';

export interface GenerateOptions {
  name: string;
  module: string;
  output?: string;
}

export type GeneratorType =
  | 'aggregate'
  | 'value-object'
  | 'entity'
  | 'repository'
  | 'use-case'
  | 'event';

const generators: Record<GeneratorType, (name: string, module: string) => string> = {
  aggregate: generateAggregate,
  'value-object': generateValueObject,
  entity: generateEntity,
  repository: generateRepository,
  'use-case': generateUseCase,
  event: generateEvent,
};

/**
 * Generate a skeleton file.
 */
export function generate(type: GeneratorType, options: GenerateOptions): string {
  const generator = generators[type];
  if (!generator) {
    throw new Error(`Unknown generator type: ${type}`);
  }
  return generator(options.name, options.module);
}

/**
 * Get available generator types.
 */
export function getAvailableGenerators(): GeneratorType[] {
  return Object.keys(generators) as GeneratorType[];
}

export {
  generateAggregate,
  generateValueObject,
  generateEntity,
  generateRepository,
  generateUseCase,
  generateEvent,
};
