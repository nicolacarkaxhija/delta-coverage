# Technical Specifications — delta-coverage

## Architecture Overview

```
delta-coverage/
├── bin/
│   └── cli.js                  CJS shebang entry (requires dist/cli.js)
├── src/
│   ├── index.ts                Programmatic API — exports runDeltaCheck()
│   ├── cli.ts                  Commander.js CLI handler (excluded from coverage)
│   ├── config/
│   │   └── loader.ts           Cosmiconfig-based config loader + defaults merger
│   ├── core/
│   │   ├── engine.ts           Main orchestrator — file mode vs line mode
│   │   └── validator.ts        Coverage % comparison against threshold
│   ├── providers/
│   │   ├── git.ts              Git operations: merge-base, changed files, diff hunks
│   │   └── coverage.ts         Coverage JSON loading (summary + final)
│   ├── types/
│   │   └── index.ts            TypeScript interfaces and type definitions
│   └── utils/
│       ├── logger.ts           Chalk-based levelled logger
│       └── path-helper.ts      Cross-platform path normalisation
├── test/
│   ├── unit/                   8 unit test files (one per module)
│   │   └── fixtures/           Mock coverage-final.json / coverage-summary.json
│   └── integration/            Real git repo tests
│       └── fixtures/           Integration coverage fixture files
├── dist/                       Compiled JS + type declarations (gitignored, published)
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## Build Pipeline

TypeScript source → compiled output → npm publish.

```sh
npm run build   # tsc + tsc-alias (resolves @/* path aliases)
```

- **Target**: ES2020 / CommonJS
- **Output**: `dist/` — `.js` + `.d.ts` + source maps
- **Path alias**: `@/*` → `./src/*` (resolved at compile time by `tsc-alias`)
- `dist/` is **gitignored** but **included in the npm package** via `"files": ["bin", "dist"]`

## TypeScript Configuration

**`tsconfig.json`**:
- `strict: true` — full strictness (no implicit any, strict null checks, etc.)
- `moduleResolution: "node"` — Node.js resolution algorithm
- `declaration: true` + `declarationMap: true` — emit `.d.ts` + source maps for type declarations
- `sourceMap: true` — runtime source maps
- `resolveJsonModule: true` — allows `import data from './file.json'`
- `paths: { "@/*": ["./src/*"] }` — internal module alias

## Type Definitions (`src/types/index.ts`)

### `DeltaOptions`

```ts
interface DeltaOptions {
  base: string;                        // Git ref (branch, tag, SHA)
  threshold: number;                   // 0–100
  checkMode: 'file' | 'line';
  coverageDir: string;                 // Path to coverage JSON directory
  include?: string[];                  // Micromatch allowlist
  exclude?: string[];                  // Micromatch denylist
  onMissingCoverage?: 'warn' | 'fail' | 'skip';
  debug?: boolean;
  log?: (level: string, msg: string) => void;
  cwd?: string;                        // Working directory (default: process.cwd())
}
```

### `DeltaReport`

```ts
interface DeltaReport {
  passed: boolean;
  files: FileResult[];
  summary: { total: number; passed: number; failed: number; skipped: number; missing: number };
}
```

### `FileResult`

```ts
interface FileResult {
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'missing';
  pct?: number;
  threshold?: number;
  message?: string;
}
```

## Config Loader (`src/config/loader.ts`)

Uses **cosmiconfig** to find configuration in the following priority order:

1. `.deltarc` (JSON)
2. `.deltarc.json`, `.deltarc.yaml`, `.deltarc.yml`
3. `.deltarc.js`, `.deltarc.cjs`
4. `"delta-coverage"` key in `package.json`
5. `delta-coverage.config.js`, `delta-coverage.config.cjs`

**Default values** (merged under user config):

```ts
const DEFAULTS: DeltaOptions = {
  base: 'origin/master',
  threshold: 80,
  checkMode: 'file',
  coverageDir: './coverage',
};
```

Options passed programmatically to `runDeltaCheck()` take precedence over the config file.

## Git Provider (`src/providers/git.ts`)

All git operations use `child_process.execSync` with `{ encoding: 'utf-8' }`.

### `getMergeBase(base, cwd)`

```sh
git merge-base HEAD <base>
```

Returns the commit SHA of the common ancestor between `HEAD` and `<base>`. This is the point from which the current branch diverged.

### `getChangedFiles(mergeBase, cwd)`

```sh
git diff --name-only --diff-filter=ACMR <mergeBase>..HEAD
```

- `--diff-filter=ACMR` — Added, Copied, Modified, Renamed only (excludes deleted files)
- Returns relative file paths, one per line

### `getHunks(file, mergeBase, cwd)`

```sh
git diff <mergeBase>..HEAD -- <file>
```

Parses the unified diff output using:

```
/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm
```

Each hunk captures `startLine` (1-based) and `lineCount`. Returns `Array<{ start: number; end: number }>` (inclusive line ranges in the new file).

## Coverage Provider (`src/providers/coverage.ts`)

### `loadSummary(coverageDir)`

Reads `<coverageDir>/coverage-summary.json`. Shape:

```json
{
  "/absolute/path/to/file.ts": {
    "lines": { "pct": 87.5 },
    "statements": { "pct": 85.0 },
    "branches": { "pct": 75.0 },
    "functions": { "pct": 100 }
  }
}
```

Returns `Record<normalizedPath, { lines: { pct: number } }>`.

### `loadFinal(coverageDir)`

Reads `<coverageDir>/coverage-final.json`. Shape:

```json
{
  "/absolute/path/to/file.ts": {
    "s": { "0": 5, "1": 0, "2": 3 },
    "statementMap": {
      "0": { "start": { "line": 10, "column": 2 }, "end": { "line": 10, "column": 20 } },
      "1": { "start": { "line": 15, "column": 4 }, "end": { "line": 15, "column": 30 } }
    }
  }
}
```

Returns `Record<normalizedPath, { s: Record<id, hitCount>; statementMap: Record<id, Range> }>`.

## Path Helper (`src/utils/path-helper.ts`)

Coverage JSON files use absolute paths from the machine that generated them. Git diff outputs relative paths. The path helper bridges the two:

1. Normalises backslashes to forward slashes
2. Converts Windows absolute paths (`C:\...` → `/c/...`) for Git Bash compatibility
3. Strips leading slashes and drive letters to produce a normalised relative-style key for matching

Used by both providers to index coverage data with keys that can be matched against git diff output.

## Core Engine (`src/core/engine.ts`)

The engine orchestrates the full check. Called by `runDeltaCheck()` with concrete git and coverage provider implementations.

```
getChangedFiles() → filter by include/exclude → for each file:
  ├── File mode: loadSummary() → validate(pct, threshold)
  └── Line mode: loadFinal() + getHunks() → intersect → validate(coveredModified / totalModified, threshold)
→ aggregate FileResult[] → DeltaReport
```

### File Mode Flow

1. Load `coverage-summary.json`
2. For each changed file, look up its `lines.pct`
3. If not found: apply `onMissingCoverage` policy
4. `validate(pct, threshold)` → `passed | failed`

### Line Mode Flow

1. Load `coverage-final.json`
2. For each changed file, call `getHunks()` to get modified line ranges
3. Intersect modified line ranges with `statementMap` ranges to find affected statement IDs
4. Count covered statements (`s[id] > 0`) vs total affected statements
5. If no statements in modified range: skip (no executable code changed)
6. `validate(coveredPct, threshold)` → `passed | failed`

## Validator (`src/core/validator.ts`)

```ts
function validate(pct: number, threshold: number): boolean {
  return pct >= threshold;
}
```

Simple numeric comparison. Returns `true` if coverage meets or exceeds threshold.

## Logger (`src/utils/logger.ts`)

Five log levels with chalk colours:

| Level | Colour | Symbol |
|-------|--------|--------|
| `debug` | grey | — |
| `info` | cyan | — |
| `warn` | yellow | ⚠ |
| `error` | red | ✗ |
| `success` | green | ✓ |

The default logger is a no-op. A custom logger can be injected via `DeltaOptions.log` for programmatic use or testing.

## CLI Handler (`src/cli.ts`)

Built with **Commander.js**. Parses CLI flags, calls `runDeltaCheck()`, prints a summary table, and exits with code `0` (pass) or `1` (fail or error).

Excluded from coverage via `vitest.config.ts` (`exclude: ['src/cli.ts']`) — tested via integration tests using subprocess spawn.

## Testing

### Unit Tests

One test file per module in `test/unit/`. Uses Vitest with `vi.mock()` for git subprocess calls and filesystem reads. Fixtures in `test/unit/fixtures/` provide representative `coverage-final.json` and `coverage-summary.json` payloads.

### Integration Tests

`test/integration/delta-check.test.ts` creates a temporary git repository on disk, writes real TypeScript files, commits them, makes modifications, generates a real coverage JSON, and invokes `runDeltaCheck()` against the live git state. Tests both file mode and line mode end-to-end.

### Coverage Configuration

**`vitest.config.ts`**:
- Provider: `v8`
- Thresholds: **100%** on statements, branches, functions, lines
- Includes: `src/**/*.ts`
- Excludes: `src/cli.ts` (subprocess-only, tested via integration)
- Reporters: text, lcov, json, json-summary
