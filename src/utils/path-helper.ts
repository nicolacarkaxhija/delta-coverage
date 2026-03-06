/**
 * Converts an absolute path from a coverage report into a repo-relative
 * forward-slash path. Handles win32, POSIX, and Git Bash on Windows.
 * Returns null if the path doesn't belong to the given cwd.
 */
export function toRelative(absPath: string, cwd: string): string | null {
  const normalize = (p: string) => p.replace(/\\/g, '/');

  const normAbs = normalize(absPath);
  const normCwd = normalize(cwd);

  // Variants of the cwd to handle Git Bash (/c/...) and Windows (C:/...)
  const variants = [
    normCwd,
    normCwd.replace(/^\/([a-z])\//, (_, d) => `${d.toUpperCase()}:/`),
    normCwd.replace(/^([A-Z]):\//, (_, d) => `/${d.toLowerCase()}/`),
  ];

  for (const base of variants) {
    if (normAbs.startsWith(base + '/')) {
      return normAbs.slice(base.length + 1);
    }
  }

  return null;
}
