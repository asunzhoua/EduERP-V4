/**
 * Governance Platform - Configuration
 *
 * Centralized configuration for governance tasks.
 * Supports file-based and programmatic configuration.
 */

import * as fs from 'fs';
import * as path from 'path';
import { GovernanceConfig } from './types';
import { PROJECT_ROOT, REPORTS_DIR } from '../shared/paths';

// ============================================================
// Default Configuration
// ============================================================

const DEFAULT_CONFIG: GovernanceConfig = {
  reportDir: REPORTS_DIR,
  failOnWarning: false,
  verbosity: 1,
  enabledTasks: [],
  disabledTasks: [],
  taskOrder: {},
  baselinePath: path.join(PROJECT_ROOT, 'docs', 'architecture', 'ArchitectureBaseline.md'),
};

// ============================================================
// Configuration Loader
// ============================================================

/**
 * Configuration file path.
 */
const CONFIG_FILE = path.join(PROJECT_ROOT, 'governance.config.json');

/**
 * Load configuration from file, falling back to defaults.
 */
export function loadConfig(configPath?: string): GovernanceConfig {
  const filePath = configPath || CONFIG_FILE;

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const fileConfig = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...fileConfig };
    } catch (err) {
      console.warn(`Warning: Could not load config from ${filePath}, using defaults`);
    }
  }

  return { ...DEFAULT_CONFIG };
}

/**
 * Save configuration to file.
 */
export function saveConfig(config: GovernanceConfig, configPath?: string): void {
  const filePath = configPath || CONFIG_FILE;
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Create a configuration with overrides.
 */
export function createConfig(overrides: Partial<GovernanceConfig>): GovernanceConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

// ============================================================
// Configuration Presets
// ============================================================

/**
 * CI configuration: strict, verbose, fail on warnings.
 */
export function createCIConfig(): GovernanceConfig {
  return createConfig({
    failOnWarning: true,
    verbosity: 2,
  });
}

/**
 * Local development configuration: lenient, quiet.
 */
export function createLocalConfig(): GovernanceConfig {
  return createConfig({
    failOnWarning: false,
    verbosity: 1,
  });
}

/**
 * Minimal configuration: only essential tasks.
 */
export function createMinimalConfig(): GovernanceConfig {
  return createConfig({
    enabledTasks: ['freeze-audit', 'event-validation'],
    verbosity: 0,
  });
}

// ============================================================
// Configuration Validation
// ============================================================

/**
 * Validate configuration.
 * Returns list of errors (empty = valid).
 */
export function validateConfig(config: GovernanceConfig): string[] {
  const errors: string[] = [];

  if (!config.reportDir) {
    errors.push('reportDir is required');
  }

  if (config.verbosity < 0 || config.verbosity > 2) {
    errors.push('verbosity must be 0, 1, or 2');
  }

  // Check for conflicts
  const enabledSet = new Set(config.enabledTasks);
  const disabledSet = new Set(config.disabledTasks);
  const conflicts = config.enabledTasks.filter(id => disabledSet.has(id));
  if (conflicts.length > 0) {
    errors.push(`Tasks cannot be both enabled and disabled: ${conflicts.join(', ')}`);
  }

  return errors;
}
