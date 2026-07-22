# Implementation Plan: ACM Analyzer CLI

**Branch**: `002-acm-analyzer-cli` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-acm-analyzer-cli/spec.md`

## Summary

Deliver `packages/analyzer` — the ACM reference analyzer and its CLI. It statically
scans a project's source (TypeScript compiler API, syntax-only, no code execution),
extracts each component's public API surface as Tier 1 data, and emits ACM Canonical
JSON through the existing reference validator + canonicalizer in
`packages/toolchain` (never writing an invalid or non-canonical manifest). All
framework support — vanilla web components (default), Lit, Stencil, Angular, React,
Vue — is implemented as plugins behind one public four-phase plugin interface
(collect → analyze → moduleLink → packageLink, inheriting CEM analyzer vocabulary);
the core is framework-blind. Configuration mirrors the CEM analyzer (settings file +
CLI flags, CLI wins) with one generic `framework` option replacing per-framework
switches. The conformance harness gains: witness-source retrofit (analyzer reproduces
the four checked-in witness manifests from new checked-in source) and the FR-014
stress testbed — one maximally complex DataGrid-class component each for Lit and
Angular, checked in as compiling source with byte-pinned golden manifests.

## Technical Context

**Language/Version**: TypeScript 5.7, ESM (`"type": "module"`), Node.js >= 20 (repo standard)

**Primary Dependencies**:
- `typescript` (compiler API, syntax-only parsing — no type checker, no code execution)
- `@vue/compiler-sfc` (Vue plugin only: SFC block extraction; script contents then go through the same TS parse)
- `tinyglobby` (deterministic file discovery; Node 20 has no `fs.glob`)
- `chokidar` (watch mode)
- `node:util` `parseArgs` (CLI flags — zero-dep)
- Workspace-internal: `packages/toolchain` (`validateManifest`, `checkCanonical`/canonical emission, `renderDiagnostics`, agent-view emitter for fixture goldens)

**Storage**: filesystem only — reads source files + settings file, writes `agentic-component-manifest.json` (atomic: temp file + rename)

**Testing**: vitest (repo standard); golden-fixture byte comparison; seeded-failure gate tests in `packages/conformance`; two-platform determinism via existing CI matrix

**Target Platform**: Node.js >= 20 CLI (macOS/Linux/Windows), monorepo package `packages/analyzer`, bin `acm-analyzer`

**Project Type**: library + CLI in existing pnpm monorepo

**Performance Goals**: 100-component library analyzed in < 30 s; watch mode reflects a single-file change in < 5 s (SC-007)

**Constraints**: byte-identical output for unchanged input across platforms (SC-002); static analysis only — analyzed project code is NEVER executed or type-check-resolved through `node_modules`; Tier 1 provenance only (verbatim doc comments, nothing invented); never write an invalid or over-limit manifest; settings file IS executed (it is the user's own trusted config, CEM precedent)

**Scale/Scope**: 6 built-in framework plugins (vanilla default + 5 named); public plugin interface for external plugins; 2 stress-testbed components (Lit + Angular DataGrid-class) with golden manifests; witness source retrofit for 4 existing witness fixtures; analyzer golden fixtures for Stencil + vanilla

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constitution v3.0.0)

| # | Principle | Verdict | How this plan complies |
|---|-----------|---------|------------------------|
| I | Schema & conformance suite are source of truth | PASS | No schema or Normative Spec change is required: the analyzer is a Producer of the existing format. Type-mapping rules are analyzer documentation pinned by golden fixtures (Principle VI explicitly delegates "best structured approximation" to the reference analyzer's documented mapping rules). If implementation discovers a needed schema/spec change, it ships schema-first in the same change. |
| II | Strict framework agnosticism | PASS | Core engine is framework-blind; every framework (including vanilla) lives behind the same public plugin interface. Framework-specific residue a plugin wants to keep goes to `x-*`. No new core schema nodes are introduced, so no new Triangulation obligation; witness-source retrofit strengthens the existing coverage matrix. |
| III | Minimal core, namespaced extensions | PASS | Plugin contributions that are not Tier 1 derivable land only under `x-*`. No new core fields. |
| IV | Static, AST-level, provenance-tiered | PASS | Syntax-only static analysis; descriptions carried verbatim from doc comments, absent when source has none; analyzer emits Tier 1 only — semantics/examples (Tier 2) are never auto-derived. |
| V | Determinism and canonical form | PASS | Emission goes through the one reference canonicalizer in `packages/toolchain`. Module order = lexicographic path order; member order = source order (semantic). No timestamps, no environment values. Regenerate-and-diff gates in CI. |
| VI | Machine-first, layered types | PASS | Every typed node carries structured tier + verbatim raw text; documented mapping rules (`packages/analyzer/docs/type-mapping.md`) define the structured approximation; grammar's declared opaque fallback where structuring fails; rules pinned by golden fixtures. This feature *creates* the reference analyzer those rules belong to. |
| VII | Additive evolution | PASS | Manifest format untouched; emitted manifests self-declare `schemaVersion` from the schema package. |
| VIII | CEM descent & lossless interop | PASS | Not a format converter (no concept-mapping table obligation). CEM analyzer vocabulary is deliberately reused: four-phase plugin lifecycle names, option names (`globs`, `exclude`, `outdir`, `dev`, `quiet`, `watch`, `plugins`), JSDoc tags (`@fires`, `@slot`, `@cssprop`, `@csspart`). |
| IX | Every principle is enforceable | PASS | FR-013 witness-reproduction and FR-014 testbed byte-match checks run in `packages/conformance`; seeded-failure tests cover: invalid plugin output rejected, invented member detected, canonical drift detected. Testbed inventory contract makes SC-008 mechanical. |
| X | Manifests are untrusted input | PASS | Analyzer validates structural limits before writing; a doc comment exceeding a per-field limit is a diagnostic, never silent truncation (truncation would violate Tier 1 verbatim). Injection-looking doc comments are carried verbatim as data — consumer inertness is already gated by existing hostile fixtures. Analyzed code is never executed. |

**Initial gate verdict**: PASS — no violations, Complexity Tracking stays empty.

**Post-design re-check (after Phase 1)**: PASS. The design introduced no new gate
exposure and strengthened two: the plugin API takes description *spans* rather than
strings, making invented prose impossible at the API level (Principle IV by
construction, not review); and the testbed inventory converts FR-014's capability
list into a row-by-row machine gate (Principle IX). Verified against the schema:
`formAssociated` (testbed row L17) already exists — no schema change is required by
any Phase 1 artifact. The settings file being executable user code is deliberately
out of Principle X's scope (X governs analyzed sources and manifests, not the
operator's own configuration; recorded in [research R-09](./research.md#r-09--settings-file--option-set)).

## Project Structure

### Documentation (this feature)

```text
specs/002-acm-analyzer-cli/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── cli.md                 # analyze command: flags, exit codes, output contract
│   ├── config-file.md         # settings file contract (acm-analyzer.config.{js,mjs})
│   ├── plugin-api.md          # public plugin interface: phases, context, contribution rules
│   └── testbed-inventory.md   # FR-014 capability → manifest-node checklist (SC-008 gate)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/analyzer/
├── package.json               # name @xgentic/acm-analyzer, bin: acm-analyzer
├── docs/
│   └── type-mapping.md        # documented structured-type mapping rules (Principle VI)
├── src/
│   ├── cli.ts                 # bin entry: parseArgs, config resolution, run/watch
│   ├── config.ts              # settings-file discovery, load, merge (CLI > file > defaults)
│   ├── analyzer.ts            # core engine: session, four phases, framework-blind
│   ├── plugin.ts              # public plugin interface types + context factories
│   ├── type-mapping.ts        # TS type node → structured tier (implements docs/type-mapping.md)
│   ├── jsdoc.ts               # doc-comment extraction (verbatim) + @fires/@slot/@cssprop/@csspart
│   ├── emit.ts                # assemble → validate (toolchain) → canonicalize → atomic write
│   ├── diagnostics.ts         # ACM-A-* analyzer diagnostics, exit-status mapping
│   ├── watch.ts               # chokidar loop, debounce, never-partial writes
│   └── frameworks/
│       ├── vanilla.ts         # default: standard custom elements (CEM-equivalent behavior)
│       ├── lit.ts
│       ├── stencil.ts
│       ├── angular.ts
│       ├── react.ts
│       └── vue.ts             # uses @vue/compiler-sfc for SFC extraction
└── tests/                     # unit tests per module + per-plugin fixture tests

packages/conformance/fixtures/
├── witness/{lit,react,vue,angular}/
│   ├── src/                   # NEW: checked-in witness source (FR-013 retrofit)
│   ├── agentic-component-manifest.json               # existing golden (analyzer must reproduce byte-for-byte)
│   └── acm.view.yml           # existing
├── analyzer/
│   ├── vanilla/               # NEW: analyzer golden fixture (src/ + agentic-component-manifest.json)
│   └── stencil/               # NEW: analyzer golden fixture (src/ + agentic-component-manifest.json)
└── testbed/
    ├── lit/                   # NEW: acme-data-grid.ts (maximally complex) + agentic-component-manifest.json + acm.view.yml
    └── angular/               # NEW: data-grid.component.ts (+ template) + agentic-component-manifest.json + acm.view.yml

packages/conformance/tests/
├── analyzer-witness.test.ts   # FR-013: analyze witness src → byte-match agentic-component-manifest.json
├── analyzer-testbed.test.ts   # FR-014/SC-008: analyze testbed → byte-match golden + inventory coverage
└── analyzer-gates.test.ts     # seeded failures: invalid plugin output, drift, invented members
```

**Structure Decision**: One new package `packages/analyzer` in the existing pnpm
workspace (joining `spec`, `conformance`, `toolchain`). Built-in framework plugins are
internal modules of that package but consume only the public plugin interface exported
from `plugin.ts` (dogfooding — satisfies SC-005 for all six, demonstrated for at least
one by a test that imports the plugin solely through the package's public entry
points). All analyzer conformance gates live in `packages/conformance` beside the
existing gate tests; fixture sources live with their goldens.

## Complexity Tracking

No constitutional violations to justify — table intentionally empty.
