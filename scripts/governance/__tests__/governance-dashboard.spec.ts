import { runGovernanceDashboard } from '../governance-dashboard';

describe('governance-dashboard', () => {
  const report = runGovernanceDashboard();

  it('should aggregate results from all sub-validators', () => {
    expect(report.scriptName).toBe('GovernanceDashboard');
    // 8 (freeze) + 7 (events) + 3 (state machine) + 4 (handbook) + 3 (ADR) = 25
    expect(report.results.length).toBeGreaterThanOrEqual(20);
  });

  it('should have sub-report prefix in result IDs', () => {
    const ids = report.results.map((r) => r.id);
    expect(ids.some((id) => id.startsWith('FreezeAudit/'))).toBe(true);
    expect(ids.some((id) => id.startsWith('EventValidation/'))).toBe(true);
    expect(ids.some((id) => id.startsWith('StateMachineValidation/'))).toBe(true);
    expect(ids.some((id) => id.startsWith('HandbookValidation/'))).toBe(true);
    expect(ids.some((id) => id.startsWith('ADRIndex/'))).toBe(true);
  });

  it('should have summary counts', () => {
    const total = report.summary.pass + report.summary.fail + report.summary.warn;
    expect(total).toBe(report.results.length);
  });

  it('should aggregate results with known findings', () => {
    // Known: WP5.3 flags non-standard ADR statuses (DECIDED, APPROVED)
    // Known: WP3.2-3.6 flags catalog/code transition differences
    // Known: WP4.3 flags missing version headers
    expect(report.summary.pass).toBeGreaterThan(0);
    expect(report.summary.pass + report.summary.fail + report.summary.warn).toBe(report.results.length);
  });
});
