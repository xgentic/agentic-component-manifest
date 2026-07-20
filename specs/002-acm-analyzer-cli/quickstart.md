# Quickstart: ACM Analyzer CLI validation

End-to-end scenarios proving the feature works. Contracts: [cli.md](./contracts/cli.md),
[config-file.md](./contracts/config-file.md), [plugin-api.md](./contracts/plugin-api.md),
[testbed-inventory.md](./contracts/testbed-inventory.md). Data model: [data-model.md](./data-model.md).

## Prerequisites

```sh
pnpm install          # repo root; Node >= 20
```

The analyzer discovers sources **relative to the current working directory** and writes
`<outdir>/agentic-component-manifest.json`, so it is always run *from the project being described*. Once the
package is published its `acm-analyzer` bin is on `PATH`; inside this monorepo (no
published bin yet) invoke the CLI through `tsx`. Define two shell functions — the analyzer
and the toolchain CLI — that resolve from the repo root, so the scenarios below read
exactly like the published commands and work from any project dir (bash or zsh):

```sh
acm-analyzer() { pnpm exec tsx "$(git rev-parse --show-toplevel)/packages/analyzer/src/cli.ts" "$@"; }
acm()          { pnpm exec tsx "$(git rev-parse --show-toplevel)/packages/toolchain/src/cli.ts" "$@"; }
# published equivalents:  acm-analyzer analyze <flags>   ·   acm validate <path>
```

## Scenario 1 — zero-config vanilla analysis (US1)

```sh
cd packages/conformance/fixtures/analyzer/vanilla
acm-analyzer analyze
```

**Expected**: exit 0; `./agentic-component-manifest.json` created; `acm validate agentic-component-manifest.json` passes;
`acm canonicalize agentic-component-manifest.json --check` passes; running the analyze command again
leaves the file byte-identical (`git diff --exit-code agentic-component-manifest.json`).

## Scenario 2 — framework selection incl. stress testbed (US2, FR-014)

```sh
# Lit stress testbed: output must byte-match the checked-in golden
cd packages/conformance/fixtures/testbed/lit
acm-analyzer analyze --framework lit --globs 'src/**/*.ts' --outdir /tmp/testbed-lit
diff /tmp/testbed-lit/agentic-component-manifest.json agentic-component-manifest.json     # no output = byte-match

# Angular stress testbed
cd ../angular
acm-analyzer analyze --framework angular --globs 'src/**/*.ts' --outdir /tmp/testbed-ng
diff /tmp/testbed-ng/agentic-component-manifest.json agentic-component-manifest.json

# Unknown framework fails usefully
acm-analyzer analyze --framework svelte   # expected: exit 2, lists: lit, angular, react
```

> Framework support in v1 is `lit`, `angular`, `react`, and vanilla (the default). Stencil
> and Vue are a documented gap covered by the plugin seam, not silently accepted names.

## Scenario 3 — settings file + CLI precedence + watch (US3)

In a scratch project with an `acm-analyzer.config.js` declaring `globs`, `exclude`,
`outdir: 'dist'`, `framework: 'lit'`:

```sh
acm-analyzer analyze                          # expected: honors every file option, writes dist/agentic-component-manifest.json
acm-analyzer analyze --outdir out             # expected: out/agentic-component-manifest.json (CLI wins), framework still from file
acm-analyzer analyze --watch &                # touch a watched source → manifest regenerated < 5 s;
                                      # introduce a syntax error → diagnostic, watcher survives
```

## Scenario 4 — custom plugin (US4, SC-005)

Register a plugin from the settings file that adds `x-acme.docsUrl` to every entry
(shape per [plugin-api.md](./contracts/plugin-api.md)):

```sh
acm-analyzer analyze                          # expected: x-acme.docsUrl present, manifest still valid
```

Then make the plugin contribute an invalid value: expected exit 1, diagnostic
attributed to the plugin, **no manifest written**.

## Conformance gates (the executable proof)

Run from the repo root:

```sh
pnpm test analyzer                    # witness retrofit (FR-013), testbed byte-match +
                                      # inventory walk (FR-014/SC-008), seeded failures, perf
pnpm test                             # full suite: existing gates + drift must stay green
pnpm drift                            # generated artifacts fresh
```

**Expected**: all green; `analyzer-witness.test.ts` proves the witness manifests
are reproduced from source; `analyzer-testbed.test.ts` walks every inventory row;
`analyzer-gates.test.ts` proves invalid plugin output, invented members, and
canonical drift are each caught.

## Performance spot-check (SC-007)

Generate a 100-component corpus and time a full analysis (asserted by
`packages/analyzer/tests/bench/perf.test.ts`; ceiling 30 s):

```sh
pnpm exec tsx "$(git rev-parse --show-toplevel)/packages/analyzer/tests/bench/generate.ts" /tmp/acm-bench 100
cd /tmp/acm-bench && time acm-analyzer analyze --quiet        # expected < 30 s (typically < 1 s)
```
