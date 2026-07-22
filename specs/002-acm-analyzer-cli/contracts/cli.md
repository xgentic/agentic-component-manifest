# Contract: `acm-analyzer` CLI

**Bin**: `acm-analyzer` (package `@xgentic/acm-analyzer`) | **Subcommand**: `analyze` (CEM parity)

## Synopsis

```
acm-analyzer analyze [--config <path>] [--globs <glob>...] [--exclude <glob>...]
                     [--outdir <dir>] [--framework <name>] [--watch] [--dev] [--quiet]
```

## Flags

| Flag | Arg | Repeatable | Meaning |
|------|-----|------------|---------|
| `--config` | path | no | explicit settings file; missing file at an explicit path is a fatal usage error |
| `--globs` | glob | yes | include patterns (overrides settings-file `globs` entirely, no merging) |
| `--exclude` | glob | yes | exclude patterns (overrides settings-file `exclude` entirely) |
| `--outdir` | dir | no | output directory; manifest is always written as `<outdir>/agentic-component-manifest.json`; directory created if absent |
| `--framework` | name | no | one of `lit`, `stencil`, `angular`, `react`, `vue`; omitted → vanilla web components. Unknown value → exit 2 with the supported list. Replaces CEM's `--litelement`/`--fast`/`--stencil`/`--catalyst` |
| `--watch` | — | no | re-analyze on change; process stays alive through per-cycle failures |
| `--dev` | — | no | verbose diagnostics to stderr; mutually exclusive with `--quiet` (exit 2) |
| `--quiet` | — | no | suppress progress output; errors still print |

Precedence for every option: **CLI flag > settings file > built-in default**
(FR-006). `plugins` is settings-file-only.

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

# development loop
acm-analyzer analyze --watch --dev
```
