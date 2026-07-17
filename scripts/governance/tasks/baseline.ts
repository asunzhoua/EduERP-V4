/**
 * Governance Task: ArchitectureBaseline
 *
 * Generates the ArchitectureBaseline.md document.
 */

import { GovernanceTaskBase } from '../platform/task-base';
import { GovernanceIssue } from '../platform/types';
import * as fs from 'fs';
import * as path from 'path';
import { PROJECT_ROOT, DOCS_DIR, BACKEND_SRC, REPORTS_DIR } from '../shared/paths';

export class BaselineTask extends GovernanceTaskBase {
  readonly id = 'build-baseline';
  readonly name = 'ArchitectureBaseline';
  readonly description = 'Generates ArchitectureBaseline.md with repository metrics';
  readonly dependencies = ['event-validation', 'state-machine-validation'];

  protected async executeTask(): Promise<{ issues: GovernanceIssue[]; statistics: Record<string, number>; metadata?: Record<string, unknown> }> {
    const issues: GovernanceIssue[] = [];
    let checksPerformed = 0;

    try {
      // Collect metrics
      const metrics = this.collectMetrics();
      checksPerformed++;

      // Generate baseline
      const baseline = this.generateBaseline(metrics);
      checksPerformed++;

      // Write file
      const baselineDir = path.join(DOCS_DIR, 'architecture');
      if (!fs.existsSync(baselineDir)) {
        fs.mkdirSync(baselineDir, { recursive: true });
      }
      const baselinePath = path.join(baselineDir, 'ArchitectureBaseline.md');
      fs.writeFileSync(baselinePath, baseline, 'utf-8');
      checksPerformed++;

      issues.push({
        id: 'BASELINE-001',
        description: 'ArchitectureBaseline.md generated successfully',
        severity: 'PASS',
      });

    } catch (err) {
      issues.push({
        id: 'BASELINE-ERROR',
        description: `Baseline generation failed: ${err}`,
        severity: 'FAIL',
      });
    }

    return {
      issues,
      statistics: {
        checksPerformed,
        errors: issues.filter(i => i.severity === 'FAIL').length,
        warnings: issues.filter(i => i.severity === 'WARNING').length,
      },
    };
  }

  private collectMetrics(): Record<string, number> {
    return {
      backendTsFiles: this.countFiles(BACKEND_SRC, /\.ts$/),
      backendSpecFiles: this.countFiles(BACKEND_SRC, /\.spec\.ts$/),
      cliTsFiles: this.countFiles(path.join(PROJECT_ROOT, 'tools', 'eos-cli'), /\.ts$/),
      governanceTsFiles: this.countFiles(path.join(PROJECT_ROOT, 'scripts', 'governance'), /\.ts$/),
    };
  }

  private countFiles(dir: string, pattern: RegExp): number {
    let count = 0;
    if (!fs.existsSync(dir)) return count;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', 'dist'].includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += this.countFiles(fullPath, pattern);
      } else if (pattern.test(entry.name)) {
        count++;
      }
    }
    return count;
  }

  private generateBaseline(metrics: Record<string, number>): string {
    const timestamp = new Date().toISOString();
    return `# ArchitectureBaseline

> **Auto-generated** by \`scripts/governance/platform/tasks/baseline.ts\`
> **Generated**: ${timestamp}

---

## Repository Metrics

| Metric | Value |
|--------|-------|
| Backend TypeScript Files | ${metrics.backendTsFiles} |
| Backend Test Files | ${metrics.backendSpecFiles} |
| CLI TypeScript Files | ${metrics.cliTsFiles} |
| Governance Script Files | ${metrics.governanceTsFiles} |

---

*This baseline is auto-generated. Do not edit manually.*
`;
  }
}
