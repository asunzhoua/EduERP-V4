/**
 * eos repo — Repository information.
 */
import * as fs from 'fs';
import * as path from 'path';
import { header, result, divider, info } from '../shared/output';
import { ExitCode } from '../shared/codes';
import { BACKEND_SRC, DOCS_DIR } from '../shared/paths';

export async function runRepo(): Promise<ExitCode> {
  header('eos repo — Repository Information');

  // Count files
  const countFiles = (dir: string, ext: string): number => {
    let count = 0;
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && item.name !== 'node_modules') {
          count += countFiles(fullPath, ext);
        } else if (item.isFile() && item.name.endsWith(ext)) {
          count++;
        }
      }
    } catch {}
    return count;
  };

  const tsFiles = countFiles(BACKEND_SRC, '.ts');
  const specFiles = countFiles(BACKEND_SRC, '.spec.ts');
  const eventFiles = countFiles(path.join(BACKEND_SRC, 'events'), '.event.ts');
  const docFiles = countFiles(DOCS_DIR, '.md');

  // Count entities, services, controllers
  const entityFiles = countFiles(BACKEND_SRC, '.entity.ts');
  const serviceFiles = countFiles(BACKEND_SRC, '.service.ts');
  const controllerFiles = countFiles(BACKEND_SRC, '.controller.ts');
  const repositoryFiles = countFiles(BACKEND_SRC, '.repository.ts');
  const moduleFiles = countFiles(BACKEND_SRC, '.module.ts');

  divider();
  result('TypeScript Files', 'INFO', `${tsFiles} total, ${specFiles} test files`);
  result('Entities', 'INFO', `${entityFiles}`);
  result('Services', 'INFO', `${serviceFiles}`);
  result('Controllers', 'INFO', `${controllerFiles}`);
  result('Repositories', 'INFO', `${repositoryFiles}`);
  result('Modules', 'INFO', `${moduleFiles}`);
  result('Event Classes', 'INFO', `${eventFiles}`);
  result('Documentation', 'INFO', `${docFiles} markdown files`);
  divider();

  return ExitCode.SUCCESS;
}
