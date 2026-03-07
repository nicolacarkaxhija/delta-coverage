import { Command } from 'commander';
import { runDeltaCheck } from '@/index';
import { makeLogger } from '@/utils/logger';
import type { CheckMode } from '@/types';

const program = new Command();

program
  .name('delta-coverage')
  .description('Enforce coverage thresholds on changed files/lines in a Git diff')
  .option('--base <ref>', 'Git ref to diff against', 'origin/master')
  .option('--threshold <number>', 'Minimum coverage % required', '80')
  .option('--check-mode <mode>', '"file" or "line"', 'file')
  .option('--coverage-dir <path>', 'Directory containing coverage JSON', './coverage')
  .option('--debug', 'Print detailed path comparison output')
  .action(async (opts) => {
    const debug = Boolean(opts.debug);
    const log = makeLogger(debug);
    try {
      const report = await runDeltaCheck({
        base: opts.base as string,
        threshold: Number(opts.threshold),
        checkMode: opts.checkMode as CheckMode,
        coverageDir: opts.coverageDir as string,
        debug,
        log,
      });

      if (report.files.length === 0) {
        log('info', 'No files to check — all good.');
        process.exit(0);
      }

      const { summary } = report;
      log('info', `Results: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped, ${summary.missing} missing`);

      if (!report.passed) {
        log('error', 'Coverage check failed. Fix coverage on changed files before pushing.');
        process.exit(1);
      }

      log('success', 'All changed files meet the coverage threshold.');
      process.exit(0);
    } catch (err) {
      log('error', `Unexpected error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

program.parse();
