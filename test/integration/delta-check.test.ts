import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { runDeltaCheck } from '../../src/index';

let tmpDir: string;
let coverageDir: string;

function git(cmd: string) {
  execSync(`git ${cmd}`, { cwd: tmpDir, stdio: 'pipe' });
}

beforeAll(() => {
  // Create a real temporary git repository
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delta-integration-'));
  coverageDir = path.join(tmpDir, 'coverage');
  fs.mkdirSync(coverageDir);

  git('init');
  git('config user.email "test@test.com"');
  git('config user.name "Test"');

  // Initial commit on "master" (base branch)
  fs.writeFileSync(path.join(tmpDir, 'existing.ts'), 'export const x = 1;\n');
  git('add .');
  git('commit -m "initial"');

  // Create a local "origin/master" ref to simulate a remote
  git('branch -M master');
  git('update-ref refs/remotes/origin/master HEAD');

  // Add a new file on the feature branch (new commit)
  fs.writeFileSync(path.join(tmpDir, 'new-file.ts'), 'export const y = 2;\n');
  git('add .');
  git('commit -m "add new-file.ts"');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('integration: file mode — no coverage data (missing)', () => {
  it('reports missing for a changed file not in coverage-summary.json', async () => {
    // Write a summary that doesn't include new-file.ts
    fs.writeFileSync(
      path.join(coverageDir, 'coverage-summary.json'),
      JSON.stringify({
        total: { lines: { pct: 100 }, statements: { pct: 100 }, functions: { pct: 100 }, branches: { pct: 100 } },
      })
    );

    const report = await runDeltaCheck({
      base: 'origin/master',
      threshold: 80,
      checkMode: 'file',
      coverageDir,
      cwd: tmpDir,
      onMissingCoverage: 'warn',
    });

    expect(report.files.length).toBeGreaterThan(0);
    const newFile = report.files.find((f) => f.file.includes('new-file'));
    expect(newFile?.status).toBe('missing');
  });
});

describe('integration: file mode — passing coverage', () => {
  it('passes when changed file has sufficient coverage', async () => {
    const absKey = path.join(tmpDir, 'new-file.ts').replace(/\\/g, '/');
    fs.writeFileSync(
      path.join(coverageDir, 'coverage-summary.json'),
      JSON.stringify({
        total: { lines: { pct: 100 }, statements: { pct: 100 }, functions: { pct: 100 }, branches: { pct: 100 } },
        [absKey]: { lines: { pct: 100 }, statements: { pct: 100 }, functions: { pct: 100 }, branches: { pct: 100 } },
      })
    );

    const report = await runDeltaCheck({
      base: 'origin/master',
      threshold: 80,
      checkMode: 'file',
      coverageDir,
      cwd: tmpDir,
    });

    const newFile = report.files.find((f) => f.file.includes('new-file'));
    expect(newFile?.status).toBe('passed');
    expect(report.passed).toBe(true);
  });
});

describe('integration: file mode — failing coverage', () => {
  it('fails when changed file has insufficient coverage', async () => {
    const absKey = path.join(tmpDir, 'new-file.ts').replace(/\\/g, '/');
    fs.writeFileSync(
      path.join(coverageDir, 'coverage-summary.json'),
      JSON.stringify({
        total: { lines: { pct: 50 }, statements: { pct: 50 }, functions: { pct: 50 }, branches: { pct: 50 } },
        [absKey]: { lines: { pct: 50 }, statements: { pct: 50 }, functions: { pct: 50 }, branches: { pct: 50 } },
      })
    );

    const report = await runDeltaCheck({
      base: 'origin/master',
      threshold: 80,
      checkMode: 'file',
      coverageDir,
      cwd: tmpDir,
    });

    const newFile = report.files.find((f) => f.file.includes('new-file'));
    expect(newFile?.status).toBe('failed');
    expect(report.passed).toBe(false);
  });
});

describe('integration: line mode — passing coverage', () => {
  it('passes when changed lines are covered', async () => {
    // new-file.ts has 1 line (line 1): export const y = 2;
    // The diff will show +1,1 hunk starting at line 1
    const absKey = path.join(tmpDir, 'new-file.ts').replace(/\\/g, '/');
    fs.writeFileSync(
      path.join(coverageDir, 'coverage-final.json'),
      JSON.stringify({
        [absKey]: {
          s: { '0': 1 },
          statementMap: {
            '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 22 } },
          },
        },
      })
    );

    const report = await runDeltaCheck({
      base: 'origin/master',
      threshold: 80,
      checkMode: 'line',
      coverageDir,
      cwd: tmpDir,
    });

    const newFile = report.files.find((f) => f.file.includes('new-file'));
    expect(newFile?.status).toBe('passed');
    expect(report.passed).toBe(true);
  });
});

describe('integration: no changed files', () => {
  it('returns passed=true when HEAD equals base', async () => {
    // Use HEAD as base — merge-base of HEAD with HEAD is HEAD, diff is empty
    const report = await runDeltaCheck({
      base: 'HEAD',
      threshold: 80,
      checkMode: 'file',
      coverageDir,
      cwd: tmpDir,
    });

    expect(report.passed).toBe(true);
    expect(report.files).toHaveLength(0);
  });
});

describe('integration: custom log function', () => {
  it('uses the provided log function instead of the default', async () => {
    const customLog = vi.fn();
    const absKey = path.join(tmpDir, 'new-file.ts').replace(/\\/g, '/');
    fs.writeFileSync(
      path.join(coverageDir, 'coverage-summary.json'),
      JSON.stringify({
        total: { lines: { pct: 100 }, statements: { pct: 100 }, functions: { pct: 100 }, branches: { pct: 100 } },
        [absKey]: { lines: { pct: 100 }, statements: { pct: 100 }, functions: { pct: 100 }, branches: { pct: 100 } },
      })
    );

    const report = await runDeltaCheck({
      base: 'origin/master',
      threshold: 80,
      checkMode: 'file',
      coverageDir,
      cwd: tmpDir,
      log: customLog,
    });

    expect(customLog).toHaveBeenCalled();
    expect(report.passed).toBe(true);
  });
});

describe('integration: debug mode without explicit log', () => {
  it('creates an internal debug logger when debug=true and no log is provided', async () => {
    // Exercises the merged.log ?? (merged.debug ? makeLogger(true) : noopLogger) branch
    const report = await runDeltaCheck({
      base: 'HEAD',
      threshold: 80,
      checkMode: 'file',
      coverageDir,
      cwd: tmpDir,
      debug: true,
    });

    expect(report.passed).toBe(true);
  });
});
