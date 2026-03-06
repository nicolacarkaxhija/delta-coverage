import { describe, it, expect } from 'vitest';
import { validateFile } from '../../src/core/validator';

describe('validateFile', () => {
  it('returns passed when pct >= threshold', () => {
    const result = validateFile('src/foo.ts', 90, 80);
    expect(result).toEqual({ file: 'src/foo.ts', status: 'passed', pct: 90, threshold: 80 });
  });

  it('returns passed when pct equals threshold exactly', () => {
    const result = validateFile('src/foo.ts', 80, 80);
    expect(result.status).toBe('passed');
  });

  it('returns failed when pct < threshold', () => {
    const result = validateFile('src/foo.ts', 70, 80);
    expect(result).toEqual({ file: 'src/foo.ts', status: 'failed', pct: 70, threshold: 80 });
  });

  it('returns failed when pct is 0', () => {
    const result = validateFile('src/bar.ts', 0, 80);
    expect(result.status).toBe('failed');
  });

  it('returns passed when threshold is 0', () => {
    const result = validateFile('src/bar.ts', 0, 0);
    expect(result.status).toBe('passed');
  });
});
