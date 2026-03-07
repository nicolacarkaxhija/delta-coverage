import * as path from 'path';
import micromatch from 'micromatch';
import { toRelative } from '@/utils/path-helper';
import { validateFile } from '@/core/validator';
import type { GitProvider, Hunk } from '@/providers/git';
import type { CoverageProvider } from '@/providers/coverage';
import type { DeltaOptions, DeltaReport, FileResult, LogFn, MissingCoverage } from '@/types';

export interface EngineDeps {
  git: GitProvider;
  coverage: CoverageProvider;
  log: LogFn;
}

function buildSummary(files: FileResult[]) {
  return {
    total: files.length,
    passed: files.filter((f) => f.status === 'passed').length,
    failed: files.filter((f) => f.status === 'failed').length,
    skipped: files.filter((f) => f.status === 'skipped').length,
    missing: files.filter((f) => f.status === 'missing').length,
  };
}

function overlaps(hunk: Hunk, stmtStart: number, stmtEnd: number): boolean {
  return stmtStart <= hunk.end && stmtEnd >= hunk.start;
}

function handleMissing(
  file: string,
  policy: MissingCoverage,
  log: LogFn
): FileResult {
  const message = 'Not found in coverage report';
  if (policy === 'skip') {
    log('debug', `${file}: ${message} — skipping`);
    return { file, status: 'skipped', message };
  }
  log(policy === 'fail' ? 'error' : 'warn', `${file}: ${message}`);
  return { file, status: 'missing', message };
}

function filterFiles(files: string[], include?: string[], exclude?: string[]): string[] {
  let result = include?.length ? micromatch(files, include) : files;
  if (exclude?.length) result = micromatch.not(result, exclude);
  return result;
}

async function checkFileMode(
  files: string[],
  opts: DeltaOptions,
  deps: EngineDeps
): Promise<FileResult[]> {
  const { coverage, log } = deps;
  const { coverageDir, threshold, onMissingCoverage = 'warn', cwd = process.cwd() } = opts;
  const summary = coverage.loadSummary(coverageDir);

  // Normalise summary keys to relative paths
  const summaryByRelPath: Record<string, number> = {};
  for (const [absPath, data] of Object.entries(summary)) {
    if (absPath === 'total') continue;
    const rel = toRelative(absPath, cwd);
    if (rel) summaryByRelPath[rel] = data.lines.pct;
  }

  const results: FileResult[] = [];
  for (const file of files) {
    log('debug', `Checking file: ${file}`);
    if (!(file in summaryByRelPath)) {
      results.push(handleMissing(file, onMissingCoverage, log));
      continue;
    }
    const pct = summaryByRelPath[file];
    const result = validateFile(file, pct, threshold);
    log(result.status === 'passed' ? 'success' : 'error',
      `${file}: ${pct}% (threshold: ${threshold}%)`);
    results.push(result);
  }
  return results;
}

async function checkLineMode(
  files: string[],
  opts: DeltaOptions,
  deps: EngineDeps,
  mergeBase: string
): Promise<FileResult[]> {
  const { git, coverage, log } = deps;
  const { coverageDir, threshold, onMissingCoverage = 'fail', cwd = process.cwd() } = opts;
  const final = coverage.loadFinal(coverageDir);

  // Normalise final keys to relative paths
  const finalByRelPath: Record<string, { s: Record<string, number>; statementMap: Record<string, { start: { line: number }; end: { line: number } }> }> = {};
  for (const [absPath, data] of Object.entries(final)) {
    const rel = toRelative(absPath, cwd);
    if (rel) finalByRelPath[rel] = data;
  }

  const results: FileResult[] = [];
  for (const file of files) {
    log('debug', `Checking lines: ${file}`);
    if (!(file in finalByRelPath)) {
      results.push(handleMissing(file, onMissingCoverage, log));
      continue;
    }

    const { s, statementMap } = finalByRelPath[file];
    const hunks = git.getHunks(file, mergeBase, cwd);

    if (hunks.length === 0) {
      results.push({ file, status: 'skipped', message: 'No executable lines changed' });
      continue;
    }

    const modifiedIds = Object.keys(statementMap).filter((id) => {
      const loc = statementMap[id];
      return hunks.some((h) => overlaps(h, loc.start.line, loc.end.line));
    });

    if (modifiedIds.length === 0) {
      results.push({ file, status: 'skipped', message: 'No executable statements in changed lines' });
      continue;
    }

    const covered = modifiedIds.filter((id) => s[id] > 0).length;
    const pct = Math.round((covered / modifiedIds.length) * 100);
    const result = validateFile(file, pct, threshold);
    log(result.status === 'passed' ? 'success' : 'error',
      `${file}: ${covered}/${modifiedIds.length} statements (${pct}%) (threshold: ${threshold}%)`);
    results.push(result);
  }
  return results;
}

export async function runEngine(opts: DeltaOptions, deps: EngineDeps): Promise<DeltaReport> {
  const { git, log } = deps;
  const cwd = opts.cwd ?? process.cwd();

  log('debug', `Base: ${opts.base}, mode: ${opts.checkMode}, threshold: ${opts.threshold}%`);

  const mergeBase = git.getMergeBase(opts.base, cwd);
  log('debug', `Merge base: ${mergeBase}`);

  const rawFiles = git.getChangedFiles(mergeBase, cwd);
  log('debug', `Changed files (raw): ${rawFiles.join(', ') || 'none'}`);

  const relFiles = rawFiles.map((f) => path.posix.normalize(f));
  const filteredFiles = filterFiles(relFiles, opts.include, opts.exclude);
  log('debug', `Filtered files: ${filteredFiles.join(', ') || 'none'}`);

  if (filteredFiles.length === 0) {
    log('info', 'No changed files to check — skipping coverage gate');
    return { passed: true, files: [], summary: { total: 0, passed: 0, failed: 0, skipped: 0, missing: 0 } };
  }

  const files = opts.checkMode === 'file'
    ? await checkFileMode(filteredFiles, opts, deps)
    : await checkLineMode(filteredFiles, opts, deps, mergeBase);

  const summary = buildSummary(files);
  const passed = files.every((f) => f.status === 'passed' || f.status === 'skipped');

  return { passed, files, summary };
}
