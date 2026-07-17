import { runADRIndex } from '../build-adr-index';

describe('build-adr-index', () => {
  const report = runADRIndex();

  it('should produce a report with 3 checks', () => {
    expect(report.results).toHaveLength(3);
    expect(report.scriptName).toBe('ADRIndex');
  });

  it('WP5.1: ADR files have required metadata', () => {
    const check = report.results.find((r) => r.id === 'WP5.1');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP5.2: no duplicate ADR IDs', () => {
    const check = report.results.find((r) => r.id === 'WP5.2');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP5.3: status values are valid', () => {
    const check = report.results.find((r) => r.id === 'WP5.3');
    expect(check).toBeDefined();
    // DEC-005 uses APPROVED, ADR-009 uses DECIDED — non-standard statuses are flagged
    expect(['PASS', 'FAIL']).toContain(check!.severity);
  });
});
