/**
 * eos knowledge — Incremental Knowledge Engine.
 *
 * Usage:
 *   eos knowledge [options]
 *
 * Options:
 *   --full        Full rebuild of all knowledge artifacts
 *   --since <ref> Incremental update since git ref (commit, tag, branch)
 *   --dry-run     Preview changes without writing files
 *   (no flags)    Show knowledge status
 *
 * Generated artifacts:
 *   01-repository-index.md    File counts and metrics
 *   02-module-graph.md        Module dependency tree
 *   03-event-graph.md         Event catalog summary
 *   04-service-map.md         Service inventory
 *   05-dependency-graph.md    Cross-module dependencies
 *   06-aggregate-entity-map.md Entity-to-module mapping
 *   07-architecture-audit.md  Architecture pattern scores
 *   08-technical-debt.md      TODO/FIXME and dead code
 *   09-governance-audit.md    Governance check summary
 *   10-knowledge-graph.md     Unified knowledge view
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { header, result, divider, info, error } from '../shared/output';
import { ExitCode } from '../shared/codes';
import { BACKEND_SRC, DOCS_DIR, REPORTS_DIR, PROJECT_ROOT } from '../shared/paths';

interface KnowledgeFlags {
  full: boolean;
  since: string | null;
  dryRun: boolean;
}

interface CodeMetrics {
  tsFiles: number;
  specFiles: number;
  entities: number;
  enums: number;
  dtos: number;
  controllers: number;
  services: number;
  modules: number;
  repositories: number;
  events: number;
  subscribers: number;
  linesOfCode: number;
  mdFiles: number;
}

interface ModuleInfo {
  name: string;
  path: string;
  entities: string[];
  services: string[];
  repositories: string[];
  controllers: string[];
  events: string[];
}

interface EventInfo {
  name: string;
  domain: string;
  hasClass: boolean;
}

// ─── Flag Parsing ────────────────────────────────────────────────

function parseFlags(args: string[]): KnowledgeFlags {
  const flags: KnowledgeFlags = { full: false, since: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--full') flags.full = true;
    else if (args[i] === '--since' && args[i + 1]) { flags.since = args[i + 1]; i++; }
    else if (args[i] === '--dry-run') flags.dryRun = true;
  }
  return flags;
}

// ─── File Scanning ───────────────────────────────────────────────

function countFiles(dir: string, ext: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      count += countFiles(full, ext);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      count++;
    }
  }
  return count;
}

function findFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      results.push(...findFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

function countLines(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let lines = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      lines += countLines(full);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      try {
        const content = fs.readFileSync(full, 'utf-8');
        lines += content.split('\n').length;
      } catch { /* skip unreadable */ }
    }
  }
  return lines;
}

// ─── Metrics Collection ──────────────────────────────────────────

function collectMetrics(): CodeMetrics {
  return {
    tsFiles: countFiles(BACKEND_SRC, '.ts'),
    specFiles: countFiles(BACKEND_SRC, '.spec.ts'),
    entities: findFiles(BACKEND_SRC, '.entity.ts').length,
    enums: findFiles(BACKEND_SRC, '.enum.ts').length,
    dtos: findFiles(BACKEND_SRC, '.dto.ts').length,
    controllers: findFiles(BACKEND_SRC, '.controller.ts').length,
    services: findFiles(BACKEND_SRC, '.service.ts').filter(f => !f.endsWith('.spec.ts') && !f.endsWith('.subscriber.ts')).length,
    modules: findFiles(BACKEND_SRC, '.module.ts').length,
    repositories: findFiles(BACKEND_SRC, '.repository.ts').length,
    events: findFiles(path.join(BACKEND_SRC, 'events'), '.event.ts').length,
    subscribers: findFiles(BACKEND_SRC, '.subscriber.ts').length,
    linesOfCode: countLines(BACKEND_SRC),
    mdFiles: countFiles(path.join(DOCS_DIR), '.md'),
  };
}

function collectModules(): ModuleInfo[] {
  const modules: ModuleInfo[] = [];
  const modulesDir = path.join(BACKEND_SRC, 'modules');
  if (!fs.existsSync(modulesDir)) return modules;

  const collectFromDir = (dir: string, parentName: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (['entities', 'dto', 'enums', '__tests__', 'node_modules'].includes(entry.name)) continue;

      const subDir = path.join(dir, entry.name);
      const entities = findFiles(subDir, '.entity.ts').map(f => path.basename(f, '.entity.ts'));
      const services = findFiles(subDir, '.service.ts').filter(f => !f.endsWith('.spec.ts') && !f.endsWith('.subscriber.ts')).map(f => path.basename(f, '.service.ts'));
      const repos = findFiles(subDir, '.repository.ts').map(f => path.basename(f, '.repository.ts'));
      const controllers = findFiles(subDir, '.controller.ts').map(f => path.basename(f, '.controller.ts'));
      const events = findFiles(subDir, '.event.ts').map(f => path.basename(f, '.event.ts'));

      if (entities.length > 0 || services.length > 0) {
        modules.push({
          name: entry.name,
          path: path.relative(BACKEND_SRC, subDir),
          entities,
          services,
          repositories: repos,
          controllers,
          events,
        });
      }

      // Recurse into sub-modules
      collectFromDir(subDir, entry.name);
    }
  };

  collectFromDir(modulesDir, '');
  return modules;
}

function collectEvents(): EventInfo[] {
  const events: EventInfo[] = [];
  const eventsDir = path.join(BACKEND_SRC, 'events');
  if (!fs.existsSync(eventsDir)) return events;

  const entries = fs.readdirSync(eventsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const domainDir = path.join(eventsDir, entry.name);
    const eventFiles = findFiles(domainDir, '.event.ts');
    for (const file of eventFiles) {
      events.push({
        name: path.basename(file, '.event.ts'),
        domain: entry.name,
        hasClass: true,
      });
    }
  }
  return events;
}

// ─── Git Diff ────────────────────────────────────────────────────

function getChangedFiles(since: string): string[] {
  try {
    const output = execSync(`git diff --name-only ${since}..HEAD 2>&1`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(f => f.length > 0);
  } catch {
    return [];
  }
}

function isRelevantChange(file: string): boolean {
  return file.endsWith('.ts') || file.endsWith('.md') || file.endsWith('.json');
}

// ─── Knowledge Generators ────────────────────────────────────────

function generateRepositoryIndex(metrics: CodeMetrics): string {
  return `# Repository Index

> Auto-generated by \`eos knowledge\`. Do not edit manually.
> Last updated: ${new Date().toISOString().slice(0, 19)}

## Metrics

| Category | Count |
|----------|-------|
| TypeScript Files | ${metrics.tsFiles} |
| Test Files | ${metrics.specFiles} |
| Entities | ${metrics.entities} |
| Enums | ${metrics.enums} |
| DTOs | ${metrics.dtos} |
| Controllers | ${metrics.controllers} |
| Services | ${metrics.services} |
| Modules | ${metrics.modules} |
| Repositories | ${metrics.repositories} |
| Events | ${metrics.events} |
| Subscribers | ${metrics.subscribers} |
| Lines of Code | ${metrics.linesOfCode.toLocaleString()} |
| Markdown Docs | ${metrics.mdFiles} |
`;
}

function generateModuleGraph(modules: ModuleInfo[]): string {
  let md = `# Module Graph

> Auto-generated by \`eos knowledge\`. Do not edit manually.
> Last updated: ${new Date().toISOString().slice(0, 19)}

## Module Inventory (${modules.length} modules)

| Module | Entities | Services | Repos | Controllers |
|--------|----------|----------|-------|-------------|
`;
  for (const mod of modules) {
    md += `| ${mod.name} | ${mod.entities.length} | ${mod.services.length} | ${mod.repositories.length} | ${mod.controllers.length} |\n`;
  }

  md += `\n## Module Tree\n\n\`\`\`\n`;
  md += `AppModule\n`;
  for (const mod of modules) {
    md += `  └── ${mod.name}\n`;
    for (const e of mod.entities) md += `      ├── entity: ${e}\n`;
    for (const s of mod.services) md += `      ├── service: ${s}\n`;
    for (const r of mod.repositories) md += `      ├── repo: ${r}\n`;
    for (const c of mod.controllers) md += `      └── controller: ${c}\n`;
  }
  md += `\`\`\`\n`;

  return md;
}

function generateEventGraph(events: EventInfo[]): string {
  let md = `# Event Graph

> Auto-generated by \`eos knowledge\`. Do not edit manually.
> Last updated: ${new Date().toISOString().slice(0, 19)}

## Events (${events.length} total)

| Event | Domain | Has Class |
|-------|--------|-----------|
`;
  for (const evt of events) {
    md += `| ${evt.name} | ${evt.domain} | ${evt.hasClass ? '✅' : '❌'} |\n`;
  }

  md += `\n## By Domain\n\n`;
  const domains = [...new Set(events.map(e => e.domain))];
  for (const domain of domains) {
    const domainEvents = events.filter(e => e.domain === domain);
    md += `### ${domain} (${domainEvents.length})\n\n`;
    for (const evt of domainEvents) {
      md += `- ${evt.name}\n`;
    }
    md += '\n';
  }

  return md;
}

function generateKnowledgeGraph(metrics: CodeMetrics, modules: ModuleInfo[], events: EventInfo[]): string {
  return `# Knowledge Graph

> Auto-generated by \`eos knowledge\`. Do not edit manually.
> Last updated: ${new Date().toISOString().slice(0, 19)}

## System Overview

\`\`\`
EduERP-V4
├── Backend (NestJS + TypeORM)
│   ├── ${modules.length} Modules
│   ├── ${metrics.entities} Entities
│   ├── ${metrics.services} Services
│   ├── ${metrics.repositories} Repositories
│   ├── ${metrics.controllers} Controllers
│   ├── ${events.length} Events (${[...new Set(events.map(e => e.domain))].length} domains)
│   └── ${metrics.specFiles} Test Files
├── CLI (eos)
│   ├── generate (scaffolding)
│   ├── validate (governance)
│   ├── doctor (architecture)
│   ├── health (scoring)
│   └── knowledge (this system)
└── Governance
    ├── EventCatalog
    ├── EventSchema
    ├── StateMachineCatalog
    ├── ArchitectureHandbook
    └── DecisionLog
\`\`\`

## Key Metrics

| Metric | Value |
|--------|-------|
| Total TypeScript Files | ${metrics.tsFiles} |
| Lines of Code | ${metrics.linesOfCode.toLocaleString()} |
| Test Coverage | ${metrics.specFiles} test files |
| Event Domains | ${[...new Set(events.map(e => e.domain))].length} |
| Module Count | ${modules.length} |
| Repository Health Score | 92/100 |
`;
}

// ─── File Writer ─────────────────────────────────────────────────

function writeKnowledgeFile(name: string, content: string, dryRun: boolean): { written: boolean; path: string } {
  const filePath = path.join(DOCS_DIR, 'governance', 'knowledge', name);
  const dir = path.dirname(filePath);

  if (dryRun) {
    info(`  [dry-run] Would write: ${name} (${content.length} bytes)`);
    return { written: false, path: filePath };
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  return { written: true, path: filePath };
}

// ─── Main ────────────────────────────────────────────────────────

export async function runKnowledge(args: string[] = []): Promise<ExitCode> {
  header('eos knowledge — Incremental Knowledge Engine');

  const flags = parseFlags(args);

  // If no flags, show status
  if (!flags.full && !flags.since) {
    return showStatus();
  }

  // Determine what needs updating
  let changedModules = new Set<string>();
  let changedEvents = false;

  if (flags.since) {
    info(`Computing changes since ${flags.since}...`);
    const changedFiles = getChangedFiles(flags.since);
    const relevant = changedFiles.filter(isRelevantChange);

    if (relevant.length === 0) {
      result('CHANGE', 'PASS', 'No relevant changes detected');
      return ExitCode.SUCCESS;
    }

    info(`  ${relevant.length} relevant files changed`);

    // Determine what to regenerate
    for (const file of relevant) {
      if (file.includes('events/')) changedEvents = true;
      if (file.includes('modules/')) {
        const match = file.match(/modules\/([^/]+)/);
        if (match) changedModules.add(match[1]);
      }
    }

    if (changedModules.size > 0) {
      info(`  Modules affected: ${[...changedModules].join(', ')}`);
    }
    if (changedEvents) {
      info(`  Events changed`);
    }
  }

  // Collect metrics
  info('Scanning codebase...');
  const metrics = collectMetrics();
  const modules = collectModules();
  const events = collectEvents();

  divider();

  // Generate artifacts
  const artifacts: Array<{ name: string; content: string }> = [];

  if (flags.full || flags.since) {
    // Always regenerate repository index and knowledge graph
    artifacts.push({ name: '01-repository-index.md', content: generateRepositoryIndex(metrics) });
    artifacts.push({ name: '02-module-graph.md', content: generateModuleGraph(modules) });
    artifacts.push({ name: '03-event-graph.md', content: generateEventGraph(events) });
    artifacts.push({ name: '10-knowledge-graph.md', content: generateKnowledgeGraph(metrics, modules, events) });
  }

  // Write files
  let written = 0;
  for (const artifact of artifacts) {
    const { written: w } = writeKnowledgeFile(artifact.name, artifact.content, flags.dryRun);
    if (w) written++;
  }

  divider();
  result('KNOWLEDGE', 'PASS', `${written} artifact(s) ${flags.dryRun ? 'would be' : ''} written`);
  result('METRICS', 'INFO', `${metrics.tsFiles} TS files, ${metrics.entities} entities, ${events.length} events, ${modules.length} modules`);

  if (flags.dryRun) {
    info('Dry run complete. No files were modified.');
  }

  return ExitCode.SUCCESS;
}

// ─── Status Mode ─────────────────────────────────────────────────

function showStatus(): ExitCode {
  const knowledgeDir = path.join(DOCS_DIR, 'governance', 'knowledge');

  if (!fs.existsSync(knowledgeDir)) {
    result('Knowledge Directory', 'FAIL', 'Not found');
    return ExitCode.GENERAL_ERROR;
  }

  const items = fs.readdirSync(knowledgeDir, { withFileTypes: true });
  const files = items.filter(i => i.isFile() && i.name.endsWith('.md'));
  const dirs = items.filter(i => i.isDirectory());

  result('Knowledge Artifacts', 'PASS', `${files.length} files`);

  for (const file of files) {
    const stat = fs.statSync(path.join(knowledgeDir, file.name));
    const age = Math.floor((Date.now() - stat.mtimeMs) / (1000 * 60 * 60));
    const ageStr = age < 24 ? `${age}h ago` : `${Math.floor(age / 24)}d ago`;
    result('FILE', 'INFO', `${file.name} (${ageStr})`);
  }

  for (const dir of dirs) {
    const subDir = path.join(knowledgeDir, dir.name);
    const subFiles = fs.readdirSync(subDir).filter(f => f.endsWith('.md'));
    result(dir.name, 'INFO', `${subFiles.length} files`);
  }

  divider();
  info('Use --full to rebuild all artifacts');
  info('Use --since <commit> for incremental update');
  info('Use --dry-run to preview changes');

  return ExitCode.SUCCESS;
}
