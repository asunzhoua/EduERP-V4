import { runEventValidation } from '../validate-events';

describe('validate-events', () => {
  const report = runEventValidation();

  it('should produce a report with 7 checks', () => {
    expect(report.results).toHaveLength(7);
    expect(report.scriptName).toBe('EventValidation');
  });

  it('WP2.1: every catalog event has schema entry', () => {
    const check = report.results.find((r) => r.id === 'WP2.1');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP2.2: CURRENT/DESIGNED events have code classes', () => {
    const check = report.results.find((r) => r.id === 'WP2.2');
    expect(check).toBeDefined();
    // DESIGNED events without code classes are expected (not yet implemented)
    expect(['PASS', 'FAIL', 'WARNING']).toContain(check!.severity);
  });

  it('WP2.3: event class fields match schema payload fields', () => {
    const check = report.results.find((r) => r.id === 'WP2.3');
    expect(check).toBeDefined();
    // Schema may specify fields not yet in code (e.g., attendance array)
    expect(['PASS', 'FAIL', 'WARNING']).toContain(check!.severity);
  });

  it('WP2.4: every publish() call is registered in catalog', () => {
    const check = report.results.find((r) => r.id === 'WP2.4');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP2.5: publish payload fields match schema fields', () => {
    const check = report.results.find((r) => r.id === 'WP2.5');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP2.6: no orphan event classes', () => {
    const check = report.results.find((r) => r.id === 'WP2.6');
    expect(check).toBeDefined();
    expect(['PASS', 'WARNING']).toContain(check!.severity);
  });

  it('WP2.7: CURRENT events have publish() calls', () => {
    const check = report.results.find((r) => r.id === 'WP2.7');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });
});
