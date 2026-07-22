# Implementation Plan: Component Discovery CLI

**Branch**: `004-component-discovery-cli` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-component-discovery-cli/spec.md`

## Summary

Extend the reference `acm` CLI in `packages/toolchain` with a discovery surface —
`search`, `component`, and `capabilities` (self-description) — over a Manifest
corpus assembled per the existing NS-DISC resolution rules (reusing
`discovery.ts`) across the target project, its `node_modules`, and explicit paths.
The load-bearing architectural move is a **declarative command registry**: every
command's arguments, options (types, choices, defaults), machine-output support,
response types, and examples are data; the same registry drives argv parsing/dispatch
AND projects the capability manifest, so self-description cannot drift from behavior
by construction (FR-008). Machine output is a typed envelope (`{type, data}` /
`{error, code, suggestions?}`) with `ACM-D-*` error codes joining the repo's existing
stable-diagnostic-id contract. The same operations ship as importable functions
(`search()`, `component()`, `capabilities()`) with CLI handlers as thin
wrappers, plus envelope consumer utilities (`parseResponse`/`isError`/
`assertResponse`). Dense mode reuses the existing one-way Agent View emitter.
Corpus admission goes through the reference validator, and hostile-fixture text is
exercised through search/detail output with terminal-control-sequence
neutralization (NS-DATA-1). No schema or Normative Spec change is required.

## Technical Context

**Language/Version**: TypeScript 5.7, ESM (`"type": "module"`), Node.js >= 20 (repo standard)

**Primary Dependencies**: none new. `node:util` `parseArgs` with its config generated
from the command registry; workspace-internal reuse of `packages/toolchain`
(`resolveManifestPath` for NS-DISC, `validateManifest` for corpus admission,
`agentViewFromValue` for dense mode, `renderDiagnostics` for corpus diagnostics).
Fuzzy matching is a ~30-line Damerau-Levenshtein, hand-rolled (no dependency).

**Storage**: filesystem, read-only — the discovery surface never writes files

**Testing**: vitest (repo standard); discovery gate tests in `packages/conformance`
with a new corpus fixture tree; golden text/envelope fixtures pin ranking and
rendering; seeded non-conformance proofs (undescribed command, hostile leakage,
parity break) per the repo's `test:seeded` pattern

**Target Platform**: Node.js >= 20 CLI (`pnpm acm <cmd>`, macOS/Linux/Windows), existing package `packages/toolchain`

**Project Type**: CLI + library surface in an existing pnpm-workspace package

**Performance Goals**: search over a 100-component corpus in < 1 s including corpus
assembly (SC-002); no index cache, no daemon — assemble per invocation (in-memory
linear scoring is orders of magnitude inside budget)

**Constraints**: byte-identical output for identical corpus + invocation (SC-004);
`--json` stdout carries exactly one envelope, diagnostics to stderr (FR-005);
manifest text surfaced inertly — control sequences neutralized in human output,
byte-preserved in machine output (FR-011, NS-DATA-1); no code execution from
manifest content; `ACM-D-*` codes and response-type discriminators are public
contract, never renamed or reused (FR-006); Agent View reuse stays one-way (ADR 0001)

**Scale/Scope**: 3 new commands; registry migration of the 6 existing `acm` commands
(dispatch only — flags, exit codes, and output preserved byte-for-byte); ~9 new/changed
modules in `packages/toolchain/src`; 1 new conformance fixture tree + 4 new gate test
files; 4 contracts

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constitution v3.0.0)

| # | Principle | Verdict | How this plan complies |
|---|-----------|---------|------------------------|
| I | Schema & conformance suite are source of truth | PASS | No schema or Normative Spec change: the discovery surface is a reference **Consumer** of the existing format (same stance as the analyzer, a Producer, in 002). Discovery resolution follows the already-normative NS-DISC-1..5 via the existing `resolveManifestPath`. The CLI's own contract (envelopes, codes, capability manifest) is tool contract, bound by this feature's `contracts/` and gated in `packages/conformance`. If implementation surfaces a needed spec change, it ships spec-first in the same change. |
| II | Strict framework agnosticism | PASS | Search reads only universal concepts — names, identity facets, controlled semantic terms, descriptions. No framework-aware query features; a React entry and a Lit entry are found and rendered through the same code path, differing only in which identity facets are populated. |
| III | Minimal core, namespaced extensions | PASS | Zero new schema nodes. Unknown/`x-*` fields in corpus manifests are preserved verbatim in machine detail output (must-ignore, never stripped), and are not search dimensions. |
| IV | Static, AST-level, provenance-tiered | PASS | The CLI reproduces manifest text verbatim (FR-003) — never paraphrases, summarizes, or invents; search relevance is computed metadata about entries, clearly separated from manifest content in output. |
| V | Determinism and canonical form | PASS | Fully specified ordering with deterministic tie-breaks; no timestamps or environment values; representative outputs pinned as goldens (FR-012). Dense mode reuses the one reference Agent View emitter, one-way only — no view parsing, no `import-view` (ADR 0001, AGENTS invariant #5). |
| VI | Machine-first, human-debuggable, agent-ready | PASS | This feature is Principle VI's consumer story: typed envelopes with stable discriminators, capability self-description, token-frugal dense mode. The controlled semantic vocabulary becomes a first-class search dimension, rewarding Tier 2 classification. |
| VII | Additive evolution | PASS | Corpus may mix `schemaVersion`s; capability is resolved from each Manifest's declaration, unknown fields never break search or detail (must-ignore honored). The capability manifest carries its own `apiVersion` for the same additive discipline on the tool side. |
| VIII | CEM descent & lossless interop | PASS | Not a converter — no concept-mapping table obligation. The CLI consumes ACM only; CEM-inherited vocabulary is displayed as-is. |
| IX | Every principle is enforceable | PASS | Every FR maps to a gate: ranking/rendering goldens (FR-001/003/007/012), corpus admission diagnostics (FR-004), envelope + exit-code checks on all paths (FR-005/006), registry-completeness drift gate with a seeded undescribed-command proof (FR-008), per-operation API⇄CLI parity (FR-009/010), hostile fixtures through search and detail (FR-011). |
| X | Manifests are untrusted input | PASS | Corpus admission runs the reference validator, which enforces the NS-LIMIT structural limits; over-limit and invalid files are diagnosed and excluded (FR-004). Manifest text is data end to end: C0/ANSI control sequences neutralized in human output, bytes preserved in JSON, nothing interpreted or executed. The hostile fixture set gains its first CLI-output inertness gates. |

**Initial gate verdict**: PASS — no violations, Complexity Tracking stays empty.

**Post-design re-check (after Phase 1)**: PASS. Phase 1 introduced no new gate
exposure and strengthened two: the command registry makes an undescribed command
structurally impossible (the dispatcher is generated from the registry — Principle IX
by construction, with the drift gate reduced to asserting registry-entry
completeness and a capability golden); and corpus admission reusing
`validateManifest` means the discovery surface can never present an over-limit or
schema-invalid manifest to an agent (Principle X inherited, not re-implemented).
Migrating the six existing commands into the registry changes dispatch only; their
flags, exit codes, and outputs are pinned unchanged by the existing gate suites.

## Project Structure

### Documentation (this feature)

```text
specs/004-component-discovery-cli/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── cli-discovery.md       # search/component/manifest commands: args, flags, exit codes, text output
│   ├── envelope.md            # typed envelope grammar; response-type + ACM-D-* error-code registries
│   ├── capability-manifest.md # capability payload shape, registry derivation, drift gate
│   └── api.md                 # programmatic API + consumer utilities, parity guarantee
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/toolchain/src/
├── cli.ts                 # becomes thin: registry-driven parse + dispatch (all 9 commands);
│                          #   existing command behavior preserved byte-for-byte
├── registry.ts            # NEW: declarative command registry — args, options (type/choices/
│                          #   default), jsonSupported, responseTypes, examples, handler binding
├── corpus.ts              # NEW: corpus assembly (project root + node_modules + explicit paths
│                          #   via resolveManifestPath), validation-gated admission, diagnostics
├── search.ts              # NEW: tokenization, tiered scoring, Damerau-Levenshtein fuzzy,
│                          #   deterministic ordering + tie-breaks
├── component.ts           # NEW: list + detail resolution, disambiguation, closest-name suggestions
├── capability.ts          # NEW: capability-manifest projection of the registry
├── envelope.ts            # NEW: envelope types, ACM-D-* codes, parseResponse/isError/assertResponse
├── render.ts              # NEW: human + dense text rendering; control-sequence neutralization
├── api.ts                 # NEW: search()/component()/capabilities(), AcmDiscoveryError
├── discovery.ts           # existing NS-DISC resolution — reused unchanged
├── agent-view.ts          # existing emitter — reused for dense component detail
└── index.ts               # re-exports api + envelope utilities as public surface

packages/conformance/fixtures/discovery-corpus/   # NEW: fixture project for corpus gates
├── package.json
└── node_modules/
    ├── @acme/lit-buttons/         # acm-field advertisement; copy of witness/lit manifest
    ├── @acme/react-buttons/       # conventional filename; copy of witness/react manifest
    ├── @acme/ng-widgets/          # well-known fallback; copy of witness/angular manifest
    ├── hostile-pkg/               # copy of hostile/injection.json (NS-DATA-1 through the CLI)
    ├── broken-pkg/                # acm field advertising a missing file → diagnostic, skipped
    └── plain-pkg/                 # no manifest at all → silently not part of the corpus

packages/conformance/tests/
├── discovery-search.test.ts       # ranking, fuzzy, filters, caps, empty-result success (golden-pinned)
├── discovery-component.test.ts    # detail completeness/verbatim, list levels, suggestions, disambiguation
├── discovery-surface.test.ts      # envelope validity on all paths, stdout purity, exit codes,
│                                  #   capability golden, per-operation API ⇄ CLI parity
└── discovery-gates.test.ts        # hostile inertness + determinism through CLI output;
                                   #   seeded proofs live in gate-seeded.test.ts (test:seeded convention)
```

**Structure Decision**: The discovery surface joins `packages/toolchain` — the spec
fixes "one CLI" and the corpus/validator/Agent View machinery it needs already lives
there; a separate package would only add an import cycle risk toward the toolchain.
All gates live in `packages/conformance` beside the existing suites; the corpus
fixture embeds copies of existing witness/hostile manifests so gates run against
realistic, already-golden content without cross-fixture reaching.

## Complexity Tracking

No constitutional violations to justify — table intentionally empty.
