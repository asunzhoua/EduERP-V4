/**
 * Template engine for eos generate.
 * Simple string replacement with conventions.
 */

export interface TemplateVars {
  NAME: string;           // PascalCase name
  NAME_CAMEL: string;     // camelCase name
  NAME_SNAKE: string;     // snake_case name
  NAME_KEBAB: string;     // kebab-case name
  MODULE: string;         // Module name (PascalCase)
  MODULE_KEBAB: string;   // Module name (kebab-case)
  ENTITY: string;         // Entity class name
  REPOSITORY: string;     // Repository class name
  SERVICE: string;        // Service class name
  CONTROLLER: string;     // Controller class name
  DATE: string;           // Current date
  YEAR: string;           // Current year
  ADR_NUMBER: string;     // ADR number (e.g. "001")
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

export function createVars(name: string, module?: string): TemplateVars {
  const NAME = toPascalCase(name);
  const MODULE_NAME = module ? toPascalCase(module) : NAME;
  return {
    NAME,
    NAME_CAMEL: toCamelCase(name),
    NAME_SNAKE: toSnakeCase(name),
    NAME_KEBAB: toKebabCase(name),
    MODULE: MODULE_NAME,
    MODULE_KEBAB: toKebabCase(module || name),
    ENTITY: NAME + 'Entity',
    REPOSITORY: NAME + 'Repository',
    SERVICE: NAME + 'Service',
    CONTROLLER: NAME + 'Controller',
    DATE: new Date().toISOString().slice(0, 10),
    YEAR: new Date().getFullYear().toString(),
    ADR_NUMBER: '000',
  };
}

export function render(template: string, vars: TemplateVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}
