import { runFreezeAudit } from '../freeze-audit';

describe('freeze-audit', () => {
  const report = runFreezeAudit();

  it('should produce a report with all 8 checks', () => {
    expect(report.results).toHaveLength(8);
    expect(report.scriptName).toBe('FreezeAudit');
  });

  it('WP1.1: should verify Catalog events exist in Schema', () => {
    const check = report.results.find((r) => r.id === 'WP1.1');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP1.2: should verify owner/domain matches', () => {
    const check = report.results.find((r) => r.id === 'WP1.2');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP1.3: should verify 9 state machines in catalog', () => {
    const check = report.results.find((r) => r.id === 'WP1.3');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
    expect(check!.details).toContain('9');
  });

  it('WP1.4: should verify version headers on governance docs', () => {
    const check = report.results.find((r) => r.id === 'WP1.4');
    expect(check).toBeDefined();
    expect(['PASS', 'WARNING']).toContain(check!.severity);
  });

  it('WP1.5: should verify Handbook cross-references resolve', () => {
    const check = report.results.find((r) => r.id === 'WP1.5');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP1.6: should verify ADR files have required metadata', () => {
    const check = report.results.find((r) => r.id === 'WP1.6');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP1.7: should verify CURRENT events have code classes', () => {
    const check = report.results.find((r) => r.id === 'WP1.7');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP1.8: should verify event naming convention', () => {
    const check = report.results.find((r) => r.id === 'WP1.8');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('should exit with code 0 when no failures', () => {
    expect(report.summary.fail).toBe(0);
  });
});
