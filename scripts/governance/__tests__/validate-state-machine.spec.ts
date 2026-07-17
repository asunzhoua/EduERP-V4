import { runStateMachineValidation } from '../validate-state-machine';

describe('validate-state-machine', () => {
  const report = runStateMachineValidation();

  it('should produce a report with 3 checks', () => {
    expect(report.results).toHaveLength(3);
    expect(report.scriptName).toBe('StateMachineValidation');
  });

  it('WP3.1: each code machine has catalog section', () => {
    const check = report.results.find((r) => r.id === 'WP3.1');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
  });

  it('WP3.2-3.6: transition cross-reference', () => {
    const check = report.results.find((r) => r.id === 'WP3.2-3.6');
    expect(check).toBeDefined();
    expect(['PASS', 'WARNING']).toContain(check!.severity);
  });

  it('WP3.7: Mermaid diagrams generated', () => {
    const check = report.results.find((r) => r.id === 'WP3.7');
    expect(check).toBeDefined();
    expect(check!.severity).toBe('PASS');
    expect(check!.details).toContain('6');
  });
});
