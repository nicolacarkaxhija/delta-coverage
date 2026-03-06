import { cosmiconfig } from 'cosmiconfig';
import type { DeltaOptions } from '@/types';

const DEFAULTS: DeltaOptions = {
  base: 'origin/master',
  threshold: 80,
  checkMode: 'file',
  coverageDir: './coverage',
};

/** Loads config from .deltarc / package.json "delta-coverage" key, merged with defaults. */
export async function loadConfig(cwd = process.cwd()): Promise<DeltaOptions> {
  const explorer = cosmiconfig('delta-coverage', {
    searchPlaces: [
      'package.json',
      '.deltarc',
      '.deltarc.json',
      '.deltarc.yaml',
      '.deltarc.yml',
      '.deltarc.js',
      'delta-coverage.config.js',
      'delta-coverage.config.cjs',
    ],
  });
  const result = await explorer.search(cwd);
  const fileConfig = (result?.config ?? {}) as Partial<DeltaOptions>;
  return { ...DEFAULTS, ...fileConfig };
}
