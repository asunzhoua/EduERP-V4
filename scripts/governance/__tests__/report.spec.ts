import { buildReport, writeJSONReport, writeMDReport, getExitCode } from '../shared/report';
import type { CheckResult } from '../shared/report';

describe('report', () => {
  const sampleResults: CheckResult[] = [
    { id: 'T1', description: 'Test pass', severity: 'PASS' },
    { id: 'T2', description: 'Test fail', severity: 'FAIL', details: 'broken' },
    { id: 'T3', description: 'Test warn', severity: 'WARNING', details: 'check this' },
  ];

  describe('buildReport', () => {
    it('should count pass, fail, warn correctly', () => {
      const report = buildReport('TestScript', sampleResults);
      expect(report.summary.pass).toBe(1);
      expect(report.summary.fail).toBe(1);
      expect(report.summary.warn).toBe(1);
      expect(report.scriptName).toBe('TestScript');
      expect(report.results).toHaveLength(3);
    });

    it('should set timestamp', () => {
      const report = buildReport('Test', []);
      expect(report.timestamp).toBeTruthy();
      expect(new Date(report.timestamp).toISOString()).toBe(report.timestamp);
    });
  });

  describe('getExitCode', () => {
    it('should return 0 when no failures', () => {
      const report = buildReport('Test', [
        { id: '1', description: 'ok', severity: 'PASS' },
        { id: '2', description: 'warn', severity: 'WARNING' },
      ]);
      expect(getExitCode(report)).toBe(0);
    });

    it('should return 1 when any failure', () => {
      const report = buildReport('Test', [
        { id: '1', description: 'fail', severity: 'FAIL' },
      ]);
      expect(getExitCode(report)).toBe(1);
    });
  });

  describe('writeJSONReport', () => {
    it('should write a JSON file', () => {
      const report = buildReport('TestJSON', sampleResults);
      const filePath = writeJSONReport('_test-report', report);
      const fs = require('fs');
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.scriptName).toBe('TestJSON');
      expect(content.results).toHaveLength(3);
      // Clean up
      fs.unlinkSync(filePath);
    });
  });

  describe('writeMDReport', () => {
    it('should write a markdown file with summary', () => {
      const report = buildReport('TestMD', sampleResults);
      const filePath = writeMDReport('_test-report', report);
      const fs = require('fs');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('# TestMD');
      expect(content).toContain('FAIL');
      expect(content).toContain('✅');
      expect(content).toContain('❌');
      // Clean up
      fs.unlinkSync(filePath);
    });
  });
});
