export type CheckMode = 'file' | 'line';
export type MissingCoverage = 'fail' | 'warn' | 'skip';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';
export type LogFn = (level: LogLevel, message: string) => void;

export interface DeltaOptions {
  base: string;
  threshold: number;
  checkMode: CheckMode;
  coverageDir: string;
  include?: string[];
  exclude?: string[];
  onMissingCoverage?: MissingCoverage;
  debug?: boolean;
  log?: LogFn;
  cwd?: string;
}

export interface FileResult {
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'missing';
  pct?: number;
  threshold?: number;
  message?: string;
}

export interface DeltaReport {
  passed: boolean;
  files: FileResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    missing: number;
  };
}
