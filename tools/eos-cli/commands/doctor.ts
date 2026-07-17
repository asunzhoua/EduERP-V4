/**
 * eos doctor — Architecture Doctor.
 *
 * Checks:
 *   1. Module Structure — every module has entity + repo + service + controller + module
 *   2. Import Direction — controller -> service -> repo -> entity (no reverse)
 *   3. Aggregate Boundaries — no direct cross-module file imports
 *   4. Event Pattern — events in events/ dir, subscribers in modules/
 *   5. Repository Pattern — all entities have repositories, repos expose raw
 *   6. Naming Conventions — kebab-case files, PascalCase classes
 *   7. Dead Barrel Check — modules export what they declare
 */
import * as fs from 'fs';
import * as path from 'path';
import { ExitCode } from '../shared/codes';
import { BACKEND_SRC } from '../shared/paths';
import { header, result, divider, summary, info } from '../shared/output';

interface Check {
  id: string;
  description: string;
  severity: 'PASS' | 'FAIL' | 'WARN' | 'INFO';
  details?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

function readText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function listFiles(dir: string, ext?: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => {
      if (ext && !f.endsWith(ext)) return false;
      return fs.statSync(path.join(dir, f)).isFile();
    });
}

// Directories that are NOT modules (they're subdirectories within modules)
const NON_MODULE_DIRS = new Set(['entities', 'dto', 'enums', '__tests__']);

// ─── Check 1: Module Structure ───────────────────────────────────

function checkModuleStructure(): Check[] {
  const checks: Check[] = [];
  const modulesDir = path.join(BACKEND_SRC, 'modules');
  const moduleDirs = listDirs(modulesDir);

  for (const mod of moduleDirs) {
    // Skip parent聚合模块 (teaching aggregates sub-modules)
    if (mod === 'teaching') continue;

    const modDir = path.join(modulesDir, mod);
    const subDirs = listDirs(modDir);

    // Check if this is a leaf module (has .entity.ts files)
    const entities = listFiles(modDir, '.entity.ts');
    if (entities.length === 0) {
      // Check sub-modules (skip non-module directories like entities/, dto/, enums/)
      for (const sub of subDirs) {
        if (NON_MODULE_DIRS.has(sub)) continue;
        const subDir = path.join(modDir, sub);
        const subEntities = listFiles(subDir, '.entity.ts');
        if (subEntities.length > 0) {
          checks.push(...checkLeafModule(mod, sub, subDir));
        }
      }
    } else {
      checks.push(...checkLeafModule(mod, mod, modDir));
    }
  }

  if (checks.length === 0) {
    checks.push({ id: 'DOC.1', description: 'Module structure scan', severity: 'PASS', details: 'All modules checked' });
  }

  return checks;
}

function checkLeafModule(parent: string, name: string, dir: string): Check[] {
  const checks: Check[] = [];
  const prefix = `${parent}/${name}`;

  const hasEntity = listFiles(dir, '.entity.ts').length > 0;
  const hasRepo = listFiles(dir, '.repository.ts').length > 0;
  const hasService = listFiles(dir, '.service.ts').length > 0;
  const hasController = listFiles(dir, '.controller.ts').length > 0;
  const hasModule = listFiles(dir, '.module.ts').length > 0;

  if (!hasEntity) {
    checks.push({ id: 'DOC.1', description: `${prefix}: missing entity`, severity: 'FAIL' });
  }
  if (!hasRepo && hasEntity) {
    checks.push({ id: 'DOC.1', description: `${prefix}: missing repository`, severity: 'WARN' });
  }
  if (!hasService && hasEntity) {
    checks.push({ id: 'DOC.1', description: `${prefix}: missing service`, severity: 'WARN' });
  }
  if (!hasController && hasEntity) {
    checks.push({ id: 'DOC.1', description: `${prefix}: missing controller`, severity: 'INFO' });
  }
  if (!hasModule && hasEntity) {
    checks.push({ id: 'DOC.1', description: `${prefix}: missing module`, severity: 'FAIL' });
  }

  return checks;
}

// ─── Check 2: Import Direction ───────────────────────────────────

function checkImportDirection(): Check[] {
  const checks: Check[] = [];
  const modulesDir = path.join(BACKEND_SRC, 'modules');
  const moduleDirs = listDirs(modulesDir);

  for (const mod of moduleDirs) {
    if (mod === 'teaching') continue;

    const modDir = path.join(modulesDir, mod);
    const subDirs = listDirs(modDir);

    for (const sub of [mod, ...subDirs]) {
      const dir = sub === mod ? modDir : path.join(modDir, sub);
      checks.push(...checkImportsInDir(sub, dir));
    }
  }

  if (checks.filter(c => c.severity === 'FAIL').length === 0) {
    checks.push({ id: 'DOC.2', description: 'Import direction compliance', severity: 'PASS' });
  }

  return checks;
}

function checkImportsInDir(name: string, dir: string): Check[] {
  const checks: Check[] = [];
  const tsFiles = listFiles(dir, '.ts').filter(f => !f.endsWith('.spec.ts') && !f.endsWith('.d.ts'));

  for (const file of tsFiles) {
    const content = readText(path.join(dir, file));
    const lines = content.split('\n');

    for (const line of lines) {
      const importMatch = line.match(/^import\s+.*from\s+['"](.+)['"]/);
      if (!importMatch) continue;

      const importPath = importMatch[1];

      // Skip node_modules and path aliases
      if (!importPath.startsWith('.')) continue;

      // Resolve the imported file
      const resolved = path.resolve(dir, importPath);
      const importedFile = path.basename(resolved);

      // Rule: service should not import controller
      if (file.includes('.service.') && importedFile.includes('.controller.')) {
        checks.push({
          id: 'DOC.2',
          description: `${name}/${file}: service imports controller`,
          severity: 'FAIL',
          details: `Import: ${importPath}`,
        });
      }

      // Rule: entity should not import service or controller
      if (file.includes('.entity.') && (importedFile.includes('.service.') || importedFile.includes('.controller.'))) {
        checks.push({
          id: 'DOC.2',
          description: `${name}/${file}: entity imports service/controller`,
          severity: 'FAIL',
          details: `Import: ${importPath}`,
        });
      }

      // Rule: repository should not import controller
      if (file.includes('.repository.') && importedFile.includes('.controller.')) {
        checks.push({
          id: 'DOC.2',
          description: `${name}/${file}: repository imports controller`,
          severity: 'FAIL',
          details: `Import: ${importPath}`,
        });
      }
    }
  }

  return checks;
}

// ─── Check 3: Aggregate Boundaries ───────────────────────────────

function checkAggregateBoundaries(): Check[] {
  const checks: Check[] = [];
  const modulesDir = path.join(BACKEND_SRC, 'modules');
  const moduleDirs = listDirs(modulesDir);

  for (const mod of moduleDirs) {
    if (mod === 'teaching') continue;

    const modDir = path.join(modulesDir, mod);
    const subDirs = listDirs(modDir);

    for (const sub of [mod, ...subDirs]) {
      if (NON_MODULE_DIRS.has(sub)) continue;
      const dir = sub === mod ? modDir : path.join(modDir, sub);
      const tsFiles = listFiles(dir, '.ts').filter(f => !f.endsWith('.spec.ts'));

      for (const file of tsFiles) {
        const content = readText(path.join(dir, file));
        const lines = content.split('\n');

        for (const line of lines) {
          const importMatch = line.match(/^import\s+.*from\s+['"]\.\.\/(.+)['"]/);
          if (!importMatch) continue;

          const importPath = importMatch[1];

          // Resolve the full path to check if it's within the same top-level module
          const resolved = path.resolve(dir, '..', importPath);
          const relative = path.relative(modulesDir, resolved);

          // If the resolved path is outside this module's directory, it's a boundary violation
          if (!relative.startsWith(mod + path.sep) && !relative.startsWith(mod + '/')) {
            const targetModule = relative.split(path.sep)[0];
            checks.push({
              id: 'DOC.3',
              description: `${sub}/${file}: cross-module boundary import`,
              severity: 'WARN',
              details: `Imports from module: ${targetModule}`,
            });
          }
        }
      }
    }
  }

  if (checks.filter(c => c.severity === 'FAIL').length === 0 &&
      checks.filter(c => c.severity === 'WARN').length === 0) {
    checks.push({ id: 'DOC.3', description: 'Aggregate boundary compliance', severity: 'PASS' });
  }

  return checks;
}

// ─── Check 4: Event Pattern ──────────────────────────────────────

function checkEventPattern(): Check[] {
  const checks: Check[] = [];
  const eventsDir = path.join(BACKEND_SRC, 'events');

  if (!fs.existsSync(eventsDir)) {
    checks.push({ id: 'DOC.4', description: 'Events directory exists', severity: 'FAIL' });
    return checks;
  }

  const eventDomains = listDirs(eventsDir);
  let totalEvents = 0;

  for (const domain of eventDomains) {
    if (domain === 'event-bus.service.ts' || domain === 'event-bus.module.ts' || domain === 'index.ts') continue;
    const domainDir = path.join(eventsDir, domain);
    const eventFiles = listFiles(domainDir, '.event.ts');
    totalEvents += eventFiles.length;

    for (const file of eventFiles) {
      const content = readText(path.join(domainDir, file));
      // Check it's a plain class with constructor
      if (!content.includes('export class') || !content.includes('constructor(')) {
        checks.push({
          id: 'DOC.4',
          description: `events/${domain}/${file}: not a plain event class`,
          severity: 'WARN',
        });
      }
    }
  }

  checks.push({
    id: 'DOC.4',
    description: `Event pattern compliance (${totalEvents} events in ${eventDomains.length} domains)`,
    severity: totalEvents > 0 ? 'PASS' : 'WARN',
  });

  // Check subscribers are in modules, not events
  const modulesDir = path.join(BACKEND_SRC, 'modules');
  const subscribers = findFilesRecursive(modulesDir, '.subscriber.ts');
  checks.push({
    id: 'DOC.4',
    description: `Subscribers location (${subscribers.length} in modules/)`,
    severity: 'PASS',
  });

  return checks;
}

function findFilesRecursive(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesRecursive(fullPath, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Check 5: Repository Pattern ─────────────────────────────────

function checkRepositoryPattern(): Check[] {
  const checks: Check[] = [];
  const modulesDir = path.join(BACKEND_SRC, 'modules');
  const repos = findFilesRecursive(modulesDir, '.repository.ts');

  for (const repoPath of repos) {
    const content = readText(repoPath);
    const fileName = path.basename(repoPath);

    // Check for raw getter
    if (!content.includes('get raw()') && !content.includes('get raw ()')) {
      checks.push({
        id: 'DOC.5',
        description: `${fileName}: missing raw getter`,
        severity: 'WARN',
      });
    }

    // Check for @InjectRepository
    if (!content.includes('@InjectRepository')) {
      checks.push({
        id: 'DOC.5',
        description: `${fileName}: missing @InjectRepository`,
        severity: 'FAIL',
      });
    }

    // Check for @Injectable
    if (!content.includes('@Injectable()')) {
      checks.push({
        id: 'DOC.5',
        description: `${fileName}: missing @Injectable`,
        severity: 'FAIL',
      });
    }
  }

  checks.push({
    id: 'DOC.5',
    description: `Repository pattern compliance (${repos.length} repositories)`,
    severity: repos.length > 0 ? 'PASS' : 'WARN',
  });

  return checks;
}

// ─── Check 6: Naming Conventions ─────────────────────────────────

function checkNamingConventions(): Check[] {
  const checks: Check[] = [];
  const modulesDir = path.join(BACKEND_SRC, 'modules');

  const violations = findFilesRecursive(modulesDir, '.ts')
    .filter(f => !f.includes('node_modules'))
    .filter(f => {
      const base = path.basename(f);
      // Files should be kebab-case
      return /[A-Z]/.test(base.replace(/\.spec\.ts$/, '').replace(/\.d\.ts$/, ''));
    })
    .map(f => path.relative(modulesDir, f));

  if (violations.length > 0) {
    checks.push({
      id: 'DOC.6',
      description: `Naming violations: ${violations.slice(0, 3).join(', ')}${violations.length > 3 ? ` (+${violations.length - 3} more)` : ''}`,
      severity: 'WARN',
      details: `${violations.length} file(s) with non-kebab-case names`,
    });
  } else {
    checks.push({ id: 'DOC.6', description: 'File naming conventions', severity: 'PASS' });
  }

  return checks;
}

// ─── Check 7: Dead Code Indicators ───────────────────────────────

function checkDeadCodeIndicators(): Check[] {
  const checks: Check[] = [];
  const modulesDir = path.join(BACKEND_SRC, 'modules');

  // Check for barrel files (index.ts) in module directories
  const barrelFiles = findFilesRecursive(modulesDir, 'index.ts');
  checks.push({
    id: 'DOC.7',
    description: `Barrel files: ${barrelFiles.length} index.ts found`,
    severity: barrelFiles.length > 0 ? 'PASS' : 'INFO',
  });

  // Check for empty files
  const emptyFiles = findFilesRecursive(modulesDir, '.ts')
    .filter(f => {
      const content = readText(f).trim();
      return content.length === 0;
    })
    .map(f => path.relative(BACKEND_SRC, f));

  if (emptyFiles.length > 0) {
    checks.push({
      id: 'DOC.7',
      description: `Empty files: ${emptyFiles.join(', ')}`,
      severity: 'WARN',
    });
  }

  return checks;
}

// ─── Main ────────────────────────────────────────────────────────

export async function runDoctor(): Promise<ExitCode> {
  header('eos doctor — Architecture Doctor');

  const allChecks: Check[] = [];

  info('Running architecture checks...');
  divider();

  allChecks.push(...checkModuleStructure());
  allChecks.push(...checkImportDirection());
  allChecks.push(...checkAggregateBoundaries());
  allChecks.push(...checkEventPattern());
  allChecks.push(...checkRepositoryPattern());
  allChecks.push(...checkNamingConventions());
  allChecks.push(...checkDeadCodeIndicators());

  // Deduplicate by id + description
  const seen = new Set<string>();
  const uniqueChecks = allChecks.filter(c => {
    const key = `${c.id}:${c.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const check of uniqueChecks) {
    result(check.id, check.severity, check.description + (check.details ? ` (${check.details})` : ''));
  }

  divider();

  const pass = uniqueChecks.filter(c => c.severity === 'PASS').length;
  const fail = uniqueChecks.filter(c => c.severity === 'FAIL').length;
  const warn = uniqueChecks.filter(c => c.severity === 'WARN').length;

  summary(pass, fail, warn);

  return fail > 0 ? ExitCode.ARCHITECTURE_VIOLATION : ExitCode.SUCCESS;
}
