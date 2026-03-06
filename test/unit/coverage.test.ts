import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { coverageProvider } from '../../src/providers/coverage';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('coverageProvider.loadSummary', () => {
  it('loads and parses coverage-summary.json', () => {
    const summary = coverageProvider.loadSummary(fixturesDir);
    expect(summary['/project/src/foo.ts'].lines.pct).toBe(90);
    expect(summary['/project/src/bar.ts'].lines.pct).toBe(60);
  });

  it('throws when file does not exist', () => {
    expect(() => coverageProvider.loadSummary('/nonexistent')).toThrow();
  });
});

describe('coverageProvider.loadFinal', () => {
  it('loads and parses coverage-final.json', () => {
    const final = coverageProvider.loadFinal(fixturesDir);
    expect(final['/project/src/foo.ts'].s['0']).toBe(1);
    expect(final['/project/src/bar.ts'].s['0']).toBe(0);
  });

  it('throws when file does not exist', () => {
    expect(() => coverageProvider.loadFinal('/nonexistent')).toThrow();
  });
});
