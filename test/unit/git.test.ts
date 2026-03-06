import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'child_process';
import { gitProvider } from '../../src/providers/git';

const mockExec = vi.mocked(execSync);

afterEach(() => vi.clearAllMocks());

describe('gitProvider.getMergeBase', () => {
  it('returns the merge base SHA', () => {
    mockExec.mockReturnValueOnce(Buffer.from('abc123\n'));
    expect(gitProvider.getMergeBase('origin/master', '/cwd')).toBe('abc123');
    expect(mockExec).toHaveBeenCalledWith('git merge-base HEAD origin/master', expect.any(Object));
  });
});

describe('gitProvider.getChangedFiles', () => {
  it('returns list of changed files', () => {
    mockExec.mockReturnValueOnce(Buffer.from('src/a.ts\nsrc/b.ts\n'));
    const files = gitProvider.getChangedFiles('abc123', '/cwd');
    expect(files).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('returns empty array when no files changed', () => {
    mockExec.mockReturnValueOnce(Buffer.from(''));
    expect(gitProvider.getChangedFiles('abc123', '/cwd')).toEqual([]);
  });
});

describe('gitProvider.getHunks', () => {
  it('parses @@ hunk headers correctly', () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
@@ -1,3 +5,4 @@
 context
+added line
+another
 context
@@ -20,2 +25,1 @@
 context`;
    mockExec.mockReturnValueOnce(Buffer.from(diff));
    const hunks = gitProvider.getHunks('src/foo.ts', 'abc123', '/cwd');
    expect(hunks).toEqual([
      { start: 5, end: 8 },
      { start: 25, end: 25 },
    ]);
  });

  it('ignores hunks with count=0 (deletion only)', () => {
    const diff = `@@ -5,3 +5,0 @@\n deleted`;
    mockExec.mockReturnValueOnce(Buffer.from(diff));
    expect(gitProvider.getHunks('src/foo.ts', 'abc123', '/cwd')).toEqual([]);
  });

  it('returns empty array for empty diff', () => {
    mockExec.mockReturnValueOnce(Buffer.from(''));
    expect(gitProvider.getHunks('src/foo.ts', 'abc123', '/cwd')).toEqual([]);
  });
});
