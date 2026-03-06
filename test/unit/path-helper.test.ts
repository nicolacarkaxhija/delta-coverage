import { describe, it, expect } from 'vitest';
import { toRelative } from '../../src/utils/path-helper';

describe('toRelative', () => {
  it('converts a POSIX absolute path to relative', () => {
    expect(toRelative('/home/user/project/src/foo.ts', '/home/user/project')).toBe('src/foo.ts');
  });

  it('converts a Windows absolute path to relative', () => {
    expect(toRelative('C:/Users/user/project/src/foo.ts', 'C:/Users/user/project')).toBe('src/foo.ts');
  });

  it('converts a Windows backslash path to relative', () => {
    expect(toRelative('C:\\Users\\user\\project\\src\\foo.ts', 'C:/Users/user/project')).toBe('src/foo.ts');
  });

  it('converts a Git Bash on Windows path (/c/...) to relative', () => {
    expect(toRelative('/c/Users/user/project/src/foo.ts', 'C:/Users/user/project')).toBe('src/foo.ts');
  });

  it('returns null when path does not belong to cwd', () => {
    expect(toRelative('/other/path/file.ts', '/home/user/project')).toBeNull();
  });

  it('returns null for an exact cwd match (no trailing slash)', () => {
    expect(toRelative('/home/user/project', '/home/user/project')).toBeNull();
  });
});
