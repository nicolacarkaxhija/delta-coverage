import type { FileResult } from '@/types';

/** Compares a coverage percentage against the threshold, returning a FileResult. */
export function validateFile(
  file: string,
  pct: number,
  threshold: number
): FileResult {
  const status = pct >= threshold ? 'passed' : 'failed';
  return { file, status, pct, threshold };
}
