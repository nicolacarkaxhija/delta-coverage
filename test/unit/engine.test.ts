import { describe, it, expect, vi } from 'vitest';
import { runEngine } from '../../src/core/engine';
import type { DeltaOptions } from '../../src/types';
import type { GitProvider } from '../../src/providers/git';
import type { CoverageProvider } from '../../src/providers/coverage';

const CWD = '/project';

const baseOpts: DeltaOptions = {
  base: 'origin/master',
  threshold: 80,
  checkMode: 'file',
  coverageDir: '/project/coverage',
  cwd: CWD,
};

const log = vi.fn();

function makeGit(overrides: Partial<GitProvider> = {}): GitProvider {
  return {
    getMergeBase: vi.fn(() => 'abc123'),
    getChangedFiles: vi.fn(() => ['src/foo.ts']),
    getHunks: vi.fn(() => [{ start: 1, end: 5 }]),
    ...overrides,
  };
}

function makeCoverage(overrides: Partial<CoverageProvider> = {}): CoverageProvider {
  return {
    loadSummary: vi.fn(() => ({
      [`${CWD}/src/foo.ts`]: { lines: { pct: 90 }, statements: { pct: 90 }, functions: { pct: 100 }, branches: { pct: 80 } },
    })),
    loadFinal: vi.fn(() => ({
      [`${CWD}/src/foo.ts`]: {
        s: { '0': 1, '1': 0 },
        statementMap: {
          '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          '1': { start: { line: 3, column: 0 }, end: { line: 3, column: 10 } },
        },
      },
    })),
    ...overrides,
  };
}

describe('runEngine — no changed files', () => {
  it('returns passed=true with empty files when no changes', async () => {
    const git = makeGit({ getChangedFiles: vi.fn(() => []) });
    const report = await runEngine(baseOpts, { git, coverage: makeCoverage(), log });
    expect(report.passed).toBe(true);
    expect(report.files).toHaveLength(0);
  });
});

describe('runEngine — file mode', () => {
  it('passes when coverage >= threshold', async () => {
    const report = await runEngine(baseOpts, { git: makeGit(), coverage: makeCoverage(), log });
    expect(report.passed).toBe(true);
    expect(report.files[0].status).toBe('passed');
  });

  it('fails when coverage < threshold', async () => {
    const coverage = makeCoverage({
      loadSummary: vi.fn(() => ({
        [`${CWD}/src/foo.ts`]: { lines: { pct: 50 }, statements: { pct: 50 }, functions: { pct: 50 }, branches: { pct: 50 } },
      })),
    });
    const report = await runEngine(baseOpts, { git: makeGit(), coverage, log });
    expect(report.passed).toBe(false);
    expect(report.files[0].status).toBe('failed');
  });

  it('marks file as missing when absent from summary', async () => {
    const coverage = makeCoverage({ loadSummary: vi.fn(() => ({})) });
    const report = await runEngine(baseOpts, { git: makeGit(), coverage, log });
    expect(report.files[0].status).toBe('missing');
    expect(report.passed).toBe(false);
  });
});

describe('runEngine — line mode', () => {
  const lineOpts = { ...baseOpts, checkMode: 'line' as const };

  it('passes when covered statements >= threshold', async () => {
    const coverage = makeCoverage({
      loadFinal: vi.fn(() => ({
        [`${CWD}/src/foo.ts`]: {
          s: { '0': 5, '1': 3 },
          statementMap: {
            '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
            '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
          },
        },
      })),
    });
    const report = await runEngine(lineOpts, { git: makeGit(), coverage, log });
    expect(report.passed).toBe(true);
    expect(report.files[0].status).toBe('passed');
  });

  it('skips file when hunks are empty', async () => {
    const git = makeGit({ getHunks: vi.fn(() => []) });
    const report = await runEngine(lineOpts, { git, coverage: makeCoverage(), log });
    expect(report.files[0].status).toBe('skipped');
    expect(report.passed).toBe(true);
  });

  it('skips file when no statements overlap changed lines', async () => {
    const coverage = makeCoverage({
      loadFinal: vi.fn(() => ({
        [`${CWD}/src/foo.ts`]: {
          s: { '0': 1 },
          statementMap: {
            '0': { start: { line: 100, column: 0 }, end: { line: 100, column: 10 } },
          },
        },
      })),
    });
    const report = await runEngine(lineOpts, { git: makeGit(), coverage, log });
    expect(report.files[0].status).toBe('skipped');
  });

  it('marks file as missing when absent from coverage-final', async () => {
    const coverage = makeCoverage({ loadFinal: vi.fn(() => ({})) });
    const report = await runEngine({ ...lineOpts, onMissingCoverage: 'fail' }, { git: makeGit(), coverage, log });
    expect(report.files[0].status).toBe('missing');
    expect(report.passed).toBe(false);
  });

  it('skips missing file when onMissingCoverage is skip', async () => {
    const coverage = makeCoverage({ loadFinal: vi.fn(() => ({})) });
    const report = await runEngine({ ...lineOpts, onMissingCoverage: 'skip' }, { git: makeGit(), coverage, log });
    expect(report.files[0].status).toBe('skipped');
    expect(report.passed).toBe(true);
  });
});

describe('runEngine — file mode missing with skip policy', () => {
  it('skips missing file when onMissingCoverage is skip in file mode', async () => {
    const coverage = makeCoverage({ loadSummary: vi.fn(() => ({})) });
    const report = await runEngine({ ...baseOpts, onMissingCoverage: 'skip' }, { git: makeGit(), coverage, log });
    expect(report.files[0].status).toBe('skipped');
    expect(report.passed).toBe(true);
  });
});

describe('runEngine — line mode coverage failure', () => {
  it('fails when covered statements < threshold', async () => {
    const lineOpts = { ...baseOpts, checkMode: 'line' as const };
    const coverage = makeCoverage({
      loadFinal: vi.fn(() => ({
        [`${CWD}/src/foo.ts`]: {
          s: { '0': 0, '1': 0 },
          statementMap: {
            '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
            '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
          },
        },
      })),
    });
    const report = await runEngine(lineOpts, { git: makeGit(), coverage, log });
    expect(report.passed).toBe(false);
    expect(report.files[0].status).toBe('failed');
  });
});

describe('runEngine — cwd fallback', () => {
  it('uses process.cwd() when cwd is not provided in options', async () => {
    const { cwd: _unused, ...optsWithoutCwd } = baseOpts;
    const git = makeGit({ getChangedFiles: vi.fn(() => []) });
    const report = await runEngine(optsWithoutCwd as DeltaOptions, { git, coverage: makeCoverage(), log });
    expect(report.passed).toBe(true);
    expect(report.files).toHaveLength(0);
  });
});

describe('runEngine — debug logging', () => {
  it('emits debug messages when log is provided', async () => {
    const debugLog = vi.fn();
    await runEngine(baseOpts, { git: makeGit(), coverage: makeCoverage(), log: debugLog });
    expect(debugLog).toHaveBeenCalled();
  });
});

describe('runEngine — filtering', () => {
  it('filters by include pattern', async () => {
    const git = makeGit({ getChangedFiles: vi.fn(() => ['src/foo.ts', 'README.md']) });
    const report = await runEngine(
      { ...baseOpts, include: ['src/**/*.ts'] },
      { git, coverage: makeCoverage(), log }
    );
    expect(report.files.every((f) => f.file.endsWith('.ts'))).toBe(true);
  });

  it('filters by exclude pattern', async () => {
    const git = makeGit({ getChangedFiles: vi.fn(() => ['src/foo.ts', 'src/foo.spec.ts']) });
    const report = await runEngine(
      { ...baseOpts, exclude: ['**/*.spec.ts'] },
      { git, coverage: makeCoverage(), log }
    );
    expect(report.files.some((f) => f.file.includes('.spec.'))).toBe(false);
  });

  it('returns empty report when all files are filtered out', async () => {
    const git = makeGit({ getChangedFiles: vi.fn(() => ['README.md']) });
    const report = await runEngine(
      { ...baseOpts, include: ['src/**/*.ts'] },
      { git, coverage: makeCoverage(), log }
    );
    expect(report.passed).toBe(true);
    expect(report.files).toHaveLength(0);
  });
});

describe('runEngine — summary', () => {
  it('correctly aggregates summary counts', async () => {
    const git = makeGit({ getChangedFiles: vi.fn(() => ['src/foo.ts', 'src/bar.ts']) });
    const coverage = makeCoverage({
      loadSummary: vi.fn(() => ({
        [`${CWD}/src/foo.ts`]: { lines: { pct: 90 }, statements: { pct: 90 }, functions: { pct: 100 }, branches: { pct: 80 } },
        [`${CWD}/src/bar.ts`]: { lines: { pct: 50 }, statements: { pct: 50 }, functions: { pct: 50 }, branches: { pct: 50 } },
      })),
    });
    const report = await runEngine(baseOpts, { git, coverage, log });
    expect(report.summary.total).toBe(2);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(1);
  });
});
