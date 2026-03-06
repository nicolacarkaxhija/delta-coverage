import { execSync } from 'child_process';

export interface Hunk {
  start: number;
  end: number;
}

export interface GitProvider {
  getMergeBase(base: string, cwd: string): string;
  getChangedFiles(mergeBase: string, cwd: string): string[];
  getHunks(file: string, mergeBase: string, cwd: string): Hunk[];
}

function exec(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: 'pipe' }).toString().trim();
}

export const gitProvider: GitProvider = {
  getMergeBase(base, cwd) {
    return exec(`git merge-base HEAD ${base}`, cwd);
  },

  getChangedFiles(mergeBase, cwd) {
    const output = exec(
      `git diff --name-only --diff-filter=ACMR ${mergeBase}..HEAD`,
      cwd
    );
    if (!output) return [];
    return output.split('\n').filter(Boolean);
  },

  getHunks(file, mergeBase, cwd) {
    const diff = exec(`git diff ${mergeBase}..HEAD -- "${file}"`, cwd);
    const hunks: Hunk[] = [];
    const pattern = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(diff)) !== null) {
      const start = parseInt(match[1], 10);
      const count = match[2] !== undefined ? parseInt(match[2], 10) : 1;
      if (count > 0) hunks.push({ start, end: start + count - 1 });
    }

    return hunks;
  },
};
