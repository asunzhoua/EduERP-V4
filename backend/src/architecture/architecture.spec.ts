/**
 * Architecture Enforcement Tests
 *
 * Validates dependency rules between layers:
 * 1. shared/ cannot import from kernel/, modules/, @nestjs/*
 * 2. kernel/domain/ cannot import from kernel/infrastructure/, modules/, @nestjs/*
 * 3. kernel/application/ cannot import from kernel/infrastructure/, modules/, @nestjs/*
 * 4. kernel/infrastructure/ cannot import from modules/, @nestjs/* (except TypeORM)
 * 5. Aggregates cannot import from NestJS
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '..');

function getSourceFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      files.push(...getSourceFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function getImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function getRelativePath(filePath: string): string {
  return path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
}

describe('Architecture Enforcement', () => {
  const sharedFiles = getSourceFiles(path.join(SRC_DIR, 'shared'));
  const kernelDomainFiles = getSourceFiles(path.join(SRC_DIR, 'kernel', 'domain'));
  const kernelApplicationFiles = getSourceFiles(path.join(SRC_DIR, 'kernel', 'application'));
  const kernelInfrastructureFiles = getSourceFiles(path.join(SRC_DIR, 'kernel', 'infrastructure'));
  const kernelDomainEventFiles = getSourceFiles(path.join(SRC_DIR, 'kernel', 'domain-event'));
  const kernelSpecFiles = getSourceFiles(path.join(SRC_DIR, 'kernel', 'specification'));
  const kernelPolicyFiles = getSourceFiles(path.join(SRC_DIR, 'kernel', 'policy'));
  const kernelFactoryFiles = getSourceFiles(path.join(SRC_DIR, 'kernel', 'factory'));

  describe('Rule 1: shared/ cannot import from kernel/, modules/, @nestjs/*', () => {
    it('should have zero forbidden imports in shared/', () => {
      const violations: string[] = [];

      for (const file of sharedFiles) {
        const imports = getImports(file);
        const relPath = getRelativePath(file);

        for (const imp of imports) {
          if (imp.includes('@nestjs')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden @nestjs)`);
          }
          if (imp.includes('kernel/')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden kernel)`);
          }
          if (imp.includes('modules/')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden modules)`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Rule 2: kernel/domain/ cannot import from kernel/infrastructure/, modules/, @nestjs/*', () => {
    it('should have zero forbidden imports in kernel/domain/', () => {
      const violations: string[] = [];

      for (const file of kernelDomainFiles) {
        const imports = getImports(file);
        const relPath = getRelativePath(file);

        for (const imp of imports) {
          if (imp.includes('@nestjs')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden @nestjs)`);
          }
          if (imp.includes('kernel/infrastructure')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden infrastructure)`);
          }
          if (imp.includes('modules/')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden modules)`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Rule 3: kernel/application/ cannot import from kernel/infrastructure/, modules/, @nestjs/*', () => {
    it('should have zero forbidden imports in kernel/application/', () => {
      const violations: string[] = [];

      for (const file of kernelApplicationFiles) {
        const imports = getImports(file);
        const relPath = getRelativePath(file);

        for (const imp of imports) {
          if (imp.includes('@nestjs')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden @nestjs)`);
          }
          if (imp.includes('kernel/infrastructure')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden infrastructure)`);
          }
          if (imp.includes('modules/')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden modules)`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Rule 4: kernel/infrastructure/ cannot import from modules/, @nestjs/* (except TypeORM)', () => {
    it('should have zero forbidden imports in kernel/infrastructure/', () => {
      const violations: string[] = [];

      for (const file of kernelInfrastructureFiles) {
        const imports = getImports(file);
        const relPath = getRelativePath(file);

        for (const imp of imports) {
          if (imp.includes('@nestjs') && !imp.includes('typeorm')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden @nestjs)`);
          }
          if (imp.includes('modules/')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden modules)`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Rule 5: kernel/domain-event/ cannot import from modules/, @nestjs/*', () => {
    it('should have zero forbidden imports in kernel/domain-event/', () => {
      const violations: string[] = [];

      for (const file of kernelDomainEventFiles) {
        const imports = getImports(file);
        const relPath = getRelativePath(file);

        for (const imp of imports) {
          if (imp.includes('@nestjs')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden @nestjs)`);
          }
          if (imp.includes('modules/')) {
            violations.push(`${relPath}: imports "${imp}" (forbidden modules)`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Cross-layer boundary: shared is foundation', () => {
    it('shared/ should only import from within shared/', () => {
      const violations: string[] = [];

      for (const file of sharedFiles) {
        const imports = getImports(file);
        const relPath = getRelativePath(file);

        for (const imp of imports) {
          if (!imp.startsWith('.') && !imp.startsWith('uuid')) {
            // External packages are ok for shared (e.g., uuid)
            continue;
          }
          if (imp.includes('kernel/') || imp.includes('modules/')) {
            violations.push(`${relPath}: imports "${imp}" (cross-layer violation)`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
