# Contract: `acm-analyzer` CLI

**Bin**: `acm-analyzer` (package `@acm/analyzer`) | **Subcommand**: `analyze` (CEM parity)

## Synopsis

```
acm-analyzer analyze [--config <path>] [--globs <glob>...] [--exclude <glob>...]
                     [--outdir <dir>] [--framework <name>...] [--watch] [--dev] [--quiet]
```

## Flags

| Flag | Arg | Repeatable | Meaning |
|------|-----|------------|---------|
| `--config` | path | no | explicit settings file; missing file at an explicit path is a fatal usage error |
| `--globs` | glob | yes | include patterns (overrides settings-file `globs` entirely, no merging) |
| `--exclude` | glob | yes | exclude patterns (overrides settings-file `exclude` entirely) |
| `--outdir` | dir | no | output directory; manifest is always written as `<outdir>/agentic-component-manifest.json`; directory created if absent |
| `--framework` | name | yes | one or more of `vanilla`, `lit`, `stencil`, `angular`, `react`; omitted → vanilla web components. Repeatable **and** comma-separated (`--framework a --framework b` ≡ `--framework a,b`), duplicates collapse to the first occurrence. Unknown value → exit 2 with the supported list. Replaces CEM's `--litelement`/`--fast`/`--stencil`/`--catalyst` |
| `--watch` | — | no | re-analyze on change; process stays alive through per-cycle failures |
| `--dev` | — | no | verbose run trace to stderr (see **Run trace**); mutually exclusive with `--quiet` (exit 2) |
| `--quiet` | — | no | suppress progress output; errors still print |

Precedence for every option: **CLI flag > settings file > built-in default**
(FR-006). `plugins` is settings-file-only. List options — `globs`, `exclude`, and the
framework selection — are **replaced** by the winning layer, never merged.

## Framework selection

Named frameworks resolve to their bundled plugins **in the order written**, ahead of any
settings-file `plugins`. Selecting several analyzes a mixed-paradigm repository in one
pass. Order is the tie-break: when two plugins recognize the same declaration (Angular
and Stencil both key off `@Component`), the first claim wins, the second is dropped, and
an `ACM-A-DUPENTRY` warning names both plugins. Contributions are never merged across
frameworks — a declaration belongs to exactly one paradigm class.

## Run trace

`--dev` prints, to stderr, in this order: the resolved settings and cwd; the discovered
file list (capped, then `… N more`); parsed/skipped counts; the plugin pipeline; the
**framework import census** (which framework packages the sources import, and in how many
files); per-plugin declaration counts; the parsed files that yielded no declarations; and
a one-line summary. The trace is observation only — an analyzed project produces
byte-identical output with and without it (SC-002).

Three diagnostics explain an empty result without `--dev`:

| Code | Severity | Raised when |
|------|----------|-------------|
| `ACM-A-NOFILES` | error | the include globs matched nothing, or every match failed to parse; names the patterns, the directory, and `--globs` |
| `ACM-A-EMPTY` | warning | files were scanned but no component was extracted; names the file count and the active frameworks |
| `ACM-A-FRAMEWORK` | warning | no component was extracted **and** the sources import a framework that is not selected; names the specifier, the file count, and the `--framework` value to re-run with |

## Exit codes

| Code | Meaning | Manifest written? |
|------|---------|-------------------|
| 0 | success, no diagnostics | yes |
| 3 | completed with warnings | yes |
| 1 | failure — no valid manifest could be produced (validation/limit failure, all files unparseable, zero files matched) | no |
| 2 | usage or configuration error (unknown flag/framework, malformed settings file, `--dev`+`--quiet`) | no |

In `--watch` mode the process does not exit on per-cycle 1/3 conditions; it reports
and keeps watching. Exit 2 conditions still terminate (they precede watching).

## Output contract

- The only file written is `<outdir>/agentic-component-manifest.json`, in ACM Canonical JSON, schema-valid,
  written atomically (temp file + rename). No timestamps or environment data ever
  appear in it (byte-identical reruns, SC-002).
- Progress and diagnostics go to stderr; stdout is reserved (future `--stdout` piping
  stays possible). Diagnostics name file + problem, `ACM-A-*` codes, rendered via the
  toolchain renderer (`--json` rendering may be added later without breaking this
  contract).

## Examples

```sh
# vanilla WC project, zero config → ./agentic-component-manifest.json
acm-analyzer analyze

# Lit library with explicit sources and output dir
acm-analyzer analyze --framework lit --globs 'src/**/*.ts' --outdir dist

# settings file drives everything; CLI overrides just the framework
acm-analyzer analyze --framework angular

# a repository that ships two paradigms, analyzed in one pass
acm-analyzer analyze --framework stencil,react --globs 'src/**/*.tsx' --exclude '**/*.ct.tsx'

# development loop
acm-analyzer analyze --watch --dev
```
