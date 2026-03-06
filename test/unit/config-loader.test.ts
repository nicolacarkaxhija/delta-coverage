import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { loadConfig } from '../../src/config/loader';

describe('loadConfig', () => {
  it('returns defaults when no config file exists', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delta-test-'));
    const config = await loadConfig(tmpDir);
    expect(config.base).toBe('origin/master');
    expect(config.threshold).toBe(80);
    expect(config.checkMode).toBe('file');
    expect(config.coverageDir).toBe('./coverage');
    fs.rmdirSync(tmpDir);
  });

  it('merges .deltarc values over defaults', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delta-test-'));
    fs.writeFileSync(
      path.join(tmpDir, '.deltarc'),
      JSON.stringify({ threshold: 95, checkMode: 'line', base: 'origin/main' })
    );
    const config = await loadConfig(tmpDir);
    expect(config.threshold).toBe(95);
    expect(config.checkMode).toBe('line');
    expect(config.base).toBe('origin/main');
    expect(config.coverageDir).toBe('./coverage'); // default preserved
    fs.rmSync(tmpDir, { recursive: true });
  });
});
