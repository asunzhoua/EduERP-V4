/**
 * Unified exit codes for eos CLI.
 */
export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  VALIDATION_FAILURE = 2,
  ARCHITECTURE_VIOLATION = 3,
  GOVERNANCE_FAILURE = 4,
  MISSION_FAILURE = 5,
}

/**
 * Convert a governance report's PASS/FAIL/WARN to an exit code.
 */
export function governanceExitCode(pass: number, fail: number, warn: number): ExitCode {
  if (fail > 0) return ExitCode.GOVERNANCE_FAILURE;
  if (warn > 0) return ExitCode.SUCCESS; // warnings are acceptable
  return ExitCode.SUCCESS;
}
