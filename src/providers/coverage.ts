import * as fs from 'fs';
import * as path from 'path';

export interface FileSummary {
  lines: { pct: number };
  statements: { pct: number };
  functions: { pct: number };
  branches: { pct: number };
}

export type CoverageSummary = Record<string, FileSummary>;

export interface StatementLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface FileFinal {
  s: Record<string, number>;
  statementMap: Record<string, StatementLocation>;
}

export type CoverageFinal = Record<string, FileFinal>;

export interface CoverageProvider {
  loadSummary(coverageDir: string): CoverageSummary;
  loadFinal(coverageDir: string): CoverageFinal;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export const coverageProvider: CoverageProvider = {
  loadSummary(coverageDir) {
    return readJson<CoverageSummary>(
      path.join(coverageDir, 'coverage-summary.json')
    );
  },

  loadFinal(coverageDir) {
    return readJson<CoverageFinal>(
      path.join(coverageDir, 'coverage-final.json')
    );
  },
};
