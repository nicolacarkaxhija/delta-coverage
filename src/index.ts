import { loadConfig } from '@/config/loader';
import { runEngine } from '@/core/engine';
import { gitProvider } from '@/providers/git';
import { coverageProvider } from '@/providers/coverage';
import { noopLogger, makeLogger } from '@/utils/logger';
import type { DeltaOptions, DeltaReport } from '@/types';

export type { DeltaOptions, DeltaReport, FileResult } from '@/types';

/**
 * Main programmatic entry point.
 * Merges options with config file values and runs the coverage check engine.
 */
export async function runDeltaCheck(options: Partial<DeltaOptions> = {}): Promise<DeltaReport> {
  const fileConfig = await loadConfig(options.cwd);
  const merged: DeltaOptions = { ...fileConfig, ...options } as DeltaOptions;
  const log = merged.log ?? (merged.debug ? makeLogger(true) : noopLogger);
  return runEngine(merged, { git: gitProvider, coverage: coverageProvider, log });
}
