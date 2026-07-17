/**
 * eos freeze — Run freeze audit.
 */
import { execSync } from 'child_process';
import { header, info, error } from '../shared/output';
import { ExitCode } from '../shared/codes';
import { BACKEND_DIR } from '../shared/paths';

export async function runFreeze(): Promise<ExitCode> {
  header('eos freeze — Freeze Audit');
  info('Running freeze audit...');
  try {
    const output = execSync('npm run governance:freeze-audit 2>&1', {
      cwd: BACKEND_DIR,
      encoding: 'utf-8',
      timeout: 30000,
    });
    console.log(output);
    return ExitCode.SUCCESS;
  } catch (e: any) {
    error(e.message?.slice(0, 200) || 'Freeze audit failed');
    return ExitCode.VALIDATION_FAILURE;
  }
}
