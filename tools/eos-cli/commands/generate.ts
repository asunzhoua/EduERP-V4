/**
 * eos generate — Project scaffolding command.
 *
 * Usage:
 *   eos generate aggregate <name> --module <module>
 *   eos generate entity <name> --module <module>
 *   eos generate repository <name> --module <module>
 *   eos generate service <name> --module <module>
 *   eos generate controller <name> --module <module>
 *   eos generate module <name>
 *   eos generate event <name> --module <module>
 *   eos generate subscriber <name> --module <module>
 *   eos generate dto <name> --module <module>
 *   eos generate test <name> --module <module> --kind <service|controller>
 *   eos generate adr <title>
 */
import * as fs from 'fs';
import * as path from 'path';
import { ExitCode } from '../shared/codes';
import { header, info, error, divider, result } from '../shared/output';
import { BACKEND_SRC, DOCS_DIR, PROJECT_ROOT } from '../shared/paths';
import {
  createVars,
  render,
  TemplateVars,
  toKebabCase,
} from '../generators/template-engine';

const TEMPLATES_DIR = path.resolve(__dirname, '..', 'generators', 'templates');

// ─── Type Definitions ────────────────────────────────────────────

interface GeneratedFile {
  path: string;
  description: string;
}

type GenerateType =
  | 'aggregate'
  | 'entity'
  | 'repository'
  | 'service'
  | 'controller'
  | 'module'
  | 'event'
  | 'subscriber'
  | 'dto'
  | 'test'
  | 'adr';

const VALID_TYPES: GenerateType[] = [
  'aggregate', 'entity', 'repository', 'service', 'controller',
  'module', 'event', 'subscriber', 'dto', 'test', 'adr',
];

// ─── Helpers ─────────────────────────────────────────────────────

function loadTemplate(relativePath: string): string {
  const fullPath = path.join(TEMPLATES_DIR, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Template not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFile(filePath: string, content: string): GeneratedFile {
  ensureDir(filePath);
  if (fs.existsSync(filePath)) {
    info(`  SKIP (exists): ${path.relative(PROJECT_ROOT, filePath)}`);
    return { path: filePath, description: 'skipped (exists)' };
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  return { path: filePath, description: 'created' };
}

function moduleDir(moduleName: string): string {
  const kebab = toKebabCase(moduleName);
  return path.join(BACKEND_SRC, 'modules', kebab);
}

function eventsDir(domain: string): string {
  return path.join(BACKEND_SRC, 'events', toKebabCase(domain));
}

// ─── Generators ──────────────────────────────────────────────────

function generateEntity(name: string, mod: string): GeneratedFile[] {
  const vars = createVars(name, mod);
  const dir = moduleDir(mod);
  const files: GeneratedFile[] = [];

  // Entity
  files.push(writeFile(
    path.join(dir, `${vars.NAME_KEBAB}.entity.ts`),
    render(loadTemplate('entity.ts'), vars),
  ));

  // Enum
  files.push(writeFile(
    path.join(dir, 'enums', `${vars.NAME_KEBAB}-status.enum.ts`),
    render(loadTemplate('enum.ts'), vars),
  ));

  return files;
}

function generateRepository(name: string, mod: string): GeneratedFile[] {
  const vars = createVars(name, mod);
  const dir = moduleDir(mod);

  return [writeFile(
    path.join(dir, `${vars.NAME_KEBAB}.repository.ts`),
    render(loadTemplate('repository.ts'), vars),
  )];
}

function generateService(name: string, mod: string): GeneratedFile[] {
  const vars = createVars(name, mod);
  const dir = moduleDir(mod);

  return [writeFile(
    path.join(dir, `${vars.NAME_KEBAB}.service.ts`),
    render(loadTemplate('service.ts'), vars),
  )];
}

function generateController(name: string, mod: string): GeneratedFile[] {
  const vars = createVars(name, mod);
  const dir = moduleDir(mod);

  return [writeFile(
    path.join(dir, `${vars.NAME_KEBAB}.controller.ts`),
    render(loadTemplate('controller.ts'), vars),
  )];
}

function generateModule(name: string, mod: string): GeneratedFile[] {
  const vars = createVars(name, mod);
  const dir = moduleDir(mod);

  return [writeFile(
    path.join(dir, `${vars.NAME_KEBAB}.module.ts`),
    render(loadTemplate('module.ts'), vars),
  )];
}

function generateEvent(name: string, mod: string): GeneratedFile[] {
  const vars = createVars(name, mod);
  const dir = eventsDir(mod);

  return [writeFile(
    path.join(dir, `${vars.NAME_KEBAB}.event.ts`),
    render(loadTemplate('event.ts'), vars),
  )];
}

function generateSubscriber(name: string, mod: string): GeneratedFile[] {
  const vars = createVars(name, mod);
  const dir = moduleDir(mod);

  return [writeFile(
    path.join(dir, `${vars.NAME_KEBAB}-event.subscriber.ts`),
    render(loadTemplate('subscriber.ts'), vars),
  )];
}

function generateDto(name: string, mod: string): GeneratedFile[] {
  const vars = createVars(name, mod);
  const dir = path.join(moduleDir(mod), 'dto');
  const files: GeneratedFile[] = [];

  files.push(writeFile(
    path.join(dir, `create-${vars.NAME_KEBAB}.dto.ts`),
    render(loadTemplate('dto/create-dto.ts'), vars),
  ));
  files.push(writeFile(
    path.join(dir, `update-${vars.NAME_KEBAB}.dto.ts`),
    render(loadTemplate('dto/update-dto.ts'), vars),
  ));
  files.push(writeFile(
    path.join(dir, `query-${vars.NAME_KEBAB}.dto.ts`),
    render(loadTemplate('dto/query-dto.ts'), vars),
  ));

  return files;
}

function generateTest(name: string, mod: string, kind: string): GeneratedFile[] {
  const vars = createVars(name, mod);
  const dir = moduleDir(mod);
  const files: GeneratedFile[] = [];

  if (kind === 'controller') {
    files.push(writeFile(
      path.join(dir, `${vars.NAME_KEBAB}.controller.spec.ts`),
      render(loadTemplate('test/controller.spec.ts'), vars),
    ));
  } else {
    files.push(writeFile(
      path.join(dir, `${vars.NAME_KEBAB}.service.spec.ts`),
      render(loadTemplate('test/service.spec.ts'), vars),
    ));
  }

  return files;
}

function generateAdr(title: string): GeneratedFile[] {
  const vars = createVars(title);
  const adrDir = path.join(DOCS_DIR, 'DecisionLog');

  // Find next ADR number
  let nextNumber = 1;
  if (fs.existsSync(adrDir)) {
    const existing = fs.readdirSync(adrDir).filter(f => f.startsWith('ADR-'));
    for (const f of existing) {
      const match = f.match(/ADR-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= nextNumber) nextNumber = num + 1;
      }
    }
  }

  const padded = String(nextNumber).padStart(3, '0');
  const adrVars: TemplateVars = {
    ...vars,
    ADR_NUMBER: padded,
  };

  const fileName = `ADR-${padded}-${vars.NAME_KEBAB}.md`;

  return [writeFile(
    path.join(adrDir, fileName),
    render(loadTemplate('adr/adr.md'), adrVars),
  )];
}

// ─── Aggregate (all-in-one) ──────────────────────────────────────

function generateAggregate(name: string, mod: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  files.push(...generateEntity(name, mod));
  files.push(...generateRepository(name, mod));
  files.push(...generateService(name, mod));
  files.push(...generateController(name, mod));
  files.push(...generateModule(name, mod));
  files.push(...generateDto(name, mod));
  return files;
}

// ─── CLI Entry ───────────────────────────────────────────────────

export async function runGenerate(args: string[]): Promise<ExitCode> {
  header('eos generate — Project Scaffolding');

  const type = args[0] as GenerateType | undefined;
  const name = args[1];
  const flags = parseFlags(args.slice(2));

  if (!type || !name) {
    showUsage();
    return ExitCode.GENERAL_ERROR;
  }

  if (!VALID_TYPES.includes(type)) {
    error(`Unknown type: ${type}`);
    console.log(`Valid types: ${VALID_TYPES.join(', ')}`);
    return ExitCode.GENERAL_ERROR;
  }

  const mod = flags.module || name;

  try {
    let files: GeneratedFile[] = [];

    switch (type) {
      case 'aggregate':
        files = generateAggregate(name, mod);
        break;
      case 'entity':
        files = generateEntity(name, mod);
        break;
      case 'repository':
        files = generateRepository(name, mod);
        break;
      case 'service':
        files = generateService(name, mod);
        break;
      case 'controller':
        files = generateController(name, mod);
        break;
      case 'module':
        files = generateModule(name, mod);
        break;
      case 'event':
        files = generateEvent(name, mod);
        break;
      case 'subscriber':
        files = generateSubscriber(name, mod);
        break;
      case 'dto':
        files = generateDto(name, mod);
        break;
      case 'test':
        files = generateTest(name, mod, flags.kind || 'service');
        break;
      case 'adr':
        files = generateAdr(name);
        break;
    }

    divider();
    const created = files.filter(f => f.description === 'created').length;
    const skipped = files.filter(f => f.description !== 'created').length;
    result('GENERATE', created > 0 ? 'PASS' : 'WARN',
      `${created} file(s) created, ${skipped} skipped`);
    divider();

    for (const f of files) {
      const rel = path.relative(PROJECT_ROOT, f.path);
      result('FILE', f.description === 'created' ? 'PASS' : 'INFO', rel);
    }

    return ExitCode.SUCCESS;
  } catch (e: any) {
    error(e.message);
    return ExitCode.GENERAL_ERROR;
  }
}

// ─── Argument Parsing ────────────────────────────────────────────

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--module' && args[i + 1]) {
      flags.module = args[i + 1];
      i++;
    } else if (args[i] === '--kind' && args[i + 1]) {
      flags.kind = args[i + 1];
      i++;
    }
  }
  return flags;
}

function showUsage(): void {
  console.log('Usage: eos generate <type> <name> [options]\n');
  console.log('Types:');
  console.log('  aggregate    Generate full aggregate (entity + repo + service + controller + module + dto)');
  console.log('  entity       Generate entity + enum');
  console.log('  repository   Generate repository');
  console.log('  service      Generate application service');
  console.log('  controller   Generate REST controller');
  console.log('  module       Generate NestJS module');
  console.log('  event        Generate event class');
  console.log('  subscriber   Generate event subscriber');
  console.log('  dto          Generate create/update/query DTOs');
  console.log('  test         Generate test skeleton');
  console.log('  adr          Generate ADR skeleton');
  console.log('\nOptions:');
  console.log('  --module <name>   Target module (default: same as name)');
  console.log('  --kind <type>     Test kind: service (default) | controller');
  console.log('\nExamples:');
  console.log('  eos generate aggregate Invoice --module finance');
  console.log('  eos generate entity Attendance --module lesson-attendance');
  console.log('  eos generate event ContractExpired --module finance');
  console.log('  eos generate adr "Event Sourcing for Audit"');
  console.log('  eos generate test CourseService --module course --kind service');
}
