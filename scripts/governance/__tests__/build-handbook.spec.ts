import { runHandbookValidation } from '../build-handbook';

describe('build-handbook', () => {
  const report = runHandbookValidation();

  it('should produce a report with 4 checks', () => {
    expect(report.results).toHaveLength(4);
    expect(report.scriptName).toBe('HandbookValidation');
  });

  it('WP4.1: all cross-references resolve', () => {
    const check = report.results.find((r) => r.id === 'WP4.1');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP4.2: Appendix A documents exist', () => {
    const check = report.results.find((r) => r.id === 'WP4.2');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP4.3: referenced docs have version headers', () => {
    const check = report.results.find((r) => r.id === 'WP4.3');
    expect(check).toBeDefined();
    expect(['PASS', 'WARNING']).toContain(check!.severity);
  });

  it('WP4.4: unreferenced docs (informational)', () => {
    const check = report.results.find((r) => r.id === 'WP4.4');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });
});
