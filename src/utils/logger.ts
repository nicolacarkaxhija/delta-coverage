import chalk from 'chalk';
import type { LogFn, LogLevel } from '@/types';

const LEVEL_STYLES: Record<LogLevel, (msg: string) => string> = {
  debug:   (m) => chalk.gray(`[debug] ${m}`),
  info:    (m) => chalk.cyan(m),
  warn:    (m) => chalk.yellow(`⚠ ${m}`),
  error:   (m) => chalk.red(`✗ ${m}`),
  success: (m) => chalk.green(`✓ ${m}`),
};

/** Returns a LogFn that writes to stdout, suppressing debug when debug=false. */
export function makeLogger(debug = false): LogFn {
  return (level: LogLevel, message: string): void => {
    if (level === 'debug' && !debug) return;
    console.log(LEVEL_STYLES[level](message));
  };
}

/** A no-op logger used as the default when no log function is supplied. */
export const noopLogger: LogFn = () => undefined;
