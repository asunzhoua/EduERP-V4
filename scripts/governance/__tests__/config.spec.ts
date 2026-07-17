/**
 * Tests for GovernanceConfig
 */

import { createConfig, createCIConfig, createLocalConfig, createMinimalConfig, validateConfig } from '../platform/config';

describe('GovernanceConfig', () => {
  describe('createConfig()', () => {
    it('should create a valid default config', () => {
      const config = createConfig({});

      expect(config).toBeDefined();
      expect(config.enabledTasks).toEqual([]);
      expect(config.disabledTasks).toEqual([]);
      expect(config.failOnWarning).toBe(false);
      expect(config.reportDir).toContain('reports');
    });
  });

  describe('createCIConfig()', () => {
    it('should create a CI config that fails on warnings', () => {
      const config = createCIConfig();

      expect(config.failOnWarning).toBe(true);
    });
  });

  describe('createLocalConfig()', () => {
    it('should create a local config that does not fail on warnings', () => {
      const config = createLocalConfig();

      expect(config.failOnWarning).toBe(false);
    });
  });

  describe('createMinimalConfig()', () => {
    it('should create a minimal config with only essential tasks', () => {
      const config = createMinimalConfig();

      expect(config.enabledTasks.length).toBeGreaterThan(0);
    });
  });

  describe('validateConfig()', () => {
    it('should return no errors for valid config', () => {
      const config = createConfig({});
      const errors = validateConfig(config);

      expect(errors).toHaveLength(0);
    });

    it('should return error for invalid verbosity', () => {
      const config = createConfig({ verbosity: 5 });
      const errors = validateConfig(config);

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
