/**
 * Unified output formatting for eos CLI.
 */

export type Severity = 'PASS' | 'FAIL' | 'WARN' | 'INFO';

const COLORS: Record<string, string> = {
  PASS: '\x1b[32m',   // green
  FAIL: '\x1b[31m',   // red
  WARN: '\x1b[33m',   // yellow
  INFO: '\x1b[36m',   // cyan
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
};

export function header(title: string): void {
  console.log();
  console.log(`${COLORS.BOLD}═══ ${title} ═══${COLORS.RESET}`);
  console.log();
}

export function result(id: string, severity: Severity, message: string): void {
  const icon = severity === 'PASS' ? '✅' : severity === 'FAIL' ? '❌' : severity === 'WARN' ? '⚠️' : 'ℹ️';
  const color = COLORS[severity] || '';
  console.log(`  ${icon} ${color}${id}${COLORS.RESET}: ${message}`);
}

export function summary(pass: number, fail: number, warn: number): void {
  console.log();
  console.log(`${COLORS.BOLD}Summary:${COLORS.RESET}`);
  console.log(`  ${COLORS.PASS}PASS: ${pass}${COLORS.RESET}`);
  if (fail > 0) console.log(`  ${COLORS.FAIL}FAIL: ${fail}${COLORS.RESET}`);
  if (warn > 0) console.log(`  ${COLORS.WARN}WARN: ${warn}${COLORS.RESET}`);
  console.log();
}

export function error(message: string): void {
  console.error(`${COLORS.FAIL}ERROR: ${message}${COLORS.RESET}`);
}

export function info(message: string): void {
  console.log(`${COLORS.DIM}${message}${COLORS.RESET}`);
}

export function divider(): void {
  console.log(`${COLORS.DIM}${'─'.repeat(60)}${COLORS.RESET}`);
}
