/**
 * Governance Platform
 *
 * Unified execution model for governance operations.
 *
 * Usage:
 * ```typescript
 * import { GovernanceRegistry, GovernanceConfig } from './platform';
 *
 * const config = loadConfig();
 * const registry = new GovernanceRegistry(config);
 * await registry.registerAll();
 * const results = await registry.executeAll();
 * ```
 */

// Core types
export * from './types';

// Registry
export { GovernanceRegistry } from './registry';

// Configuration
export { loadConfig, saveConfig, createConfig, validateConfig } from './config';
export { createCIConfig, createLocalConfig, createMinimalConfig } from './config';

// Task base
export { GovernanceTaskBase, createSyncTask, createAsyncTask } from './task-base';

// CLI
export { runCLI, parseArgs } from './cli';
