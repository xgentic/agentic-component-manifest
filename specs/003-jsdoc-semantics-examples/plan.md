# Implementation Plan: Doc-Comment Semantics & Examples Extraction

**Branch**: `003-jsdoc-semantics-examples` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-jsdoc-semantics-examples/spec.md`

## Summary

Teach the analyzer to derive the two Tier-2 fields the format exists for — a component's semantic classification and its usage examples — from the component's source doc comment, so they no longer have to be hand-authored into `agentic-component-manifest.json`.

- **Semantics**: a new `@acmSemantic <term> - <notes>` doc tag. The `<term>` is validated against the controlled vocabulary (the `semanticClassification.term` enum in `acm.schema.json`, 45 terms); a valid term emits `semantics.term` (+ verbatim `notes`), an invalid/empty/duplicate one emits a diagnostic and no `semantics` field.
- **Examples**: the standard `@example` doc tag. Each block is extracted verbatim (optional caption → `title`, language detected → `lang`) and then **compiled against the component in a hermetic producer-side sandbox** (a `ts.Program` with the checker); only compiling examples reach the core `examples` array, non-compiling ones are diagnosed and excluded.

Both live in the analyzer's **shared doc-comment layer** (`jsdoc.ts`), so vanilla, Lit, Angular, and React inherit them with a one-line call each. **No schema or Normative-Spec change is required** — `semantics` and `examples` already exist in the schema as Tier-2 fields; this is purely a new producer capability, pinned by golden fixtures and seeded-failure gates.

## Technical Context

**Language/Version**: TypeScript 5.7 (ESM, NodeNext), Node ≥ 20 — matches the existing analyzer.

**Primary Dependencies**: `typescript` (already a dependency; the compiler API is used syntax-only today and gains a **scoped checker use** for example verification), `@xgentic/acm` (validator/canonicalizer + `acmSchema` for the vocabulary enum), `@xgentic/acm-spec` (schema). No new runtime dependencies.

**Storage**: N/A — reads source files, writes `<outdir>/agentic-component-manifest.json` (unchanged emit path).

**Testing**: `vitest`. Conformance goldens under `packages/conformance/fixtures/analyzer/*` + `packages/conformance/tests/analyzer-*.test.ts`; analyzer unit tests under `packages/analyzer/tests/`.

**Target Platform**: Node CLI (dev tool), Linux + macOS in CI (byte-identity across both, SC-003).

**Project Type**: Monorepo library/CLI — the `@xgentic/acm-analyzer` package; no frontend/backend split.

**Performance Goals**: Stay within the existing SC-007 ceiling — full analysis of the 100-component bench < 30 s. Example verification adds a single `ts.Program` per run (not per example), so the added cost is one program construction + one checker pass over synthetic example modules.

**Constraints**: **Determinism is the hard constraint** (Principle V, SC-003) — the example compile gate's pass/fail decision MUST be byte-reproducible across runs and platforms, which forces a **hermetic** compiler configuration (pinned `lib`/`target`/`module`, no external `node_modules` resolution) rather than the project's real tsconfig. Analysis stays offline. Notes/source/title are bounded by the schema's structural limits (notes ≤ 2048, source ≤ 8192, title ≤ 256, ≤ 32 examples).

**Scale/Scope**: Declaration-level annotations only (v1). ~6 source files touched in `@xgentic/acm-analyzer` + 1 new module + fixtures/tests. No CLI-flag or config-file surface change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Schema & Conformance are source of truth** | ✅ No normative change: `semantics`/`examples` already exist in `acm.schema.json` (Tier-2). The vocabulary check reads the schema's own `term` enum (single source) — no parallel term list. The `@acmSemantic`/`@example` conventions are *producer* behavior (analyzer docs + fixtures), not ACM interchange behavior, so no Normative-Spec clause is added. |
| **II. Framework agnosticism** | ✅ Extraction lives in the shared `jsdoc.ts` layer; identical annotation → identical output across vanilla/Lit/Angular/React. No framework nomenclature enters the core. Semantics/examples are already-triangulated core nodes (present in witness fixtures across classes). |
| **III. Minimal core, namespaced extensions** | ✅ Adds no new schema node. Rejected optional content degrades to "absent + diagnostic", never a new core field. |
| **IV. Static, provenance-tiered** | ✅ Directly advances the Tier-2 contract: semantic term drawn from the controlled vocabulary; **examples mechanically verified to compile** before reaching core (previously only asserted). Term/notes/source read verbatim from source spans. |
| **V. Determinism** | ⚠️ The example compile gate must be deterministic → **hermetic, pinned compiler options** (see research). Emitted bytes are already canonicalized; the only new determinism surface is the pass/fail decision, addressed by the hermetic sandbox. Pinned by a double-run byte-identity test. |
| **VI. Machine-first, controlled vocabulary** | ✅ Semantic term MUST be a controlled-vocabulary member (schema enum); an out-of-vocabulary term never reaches the manifest. Notes accompany, never replace, a term. |
| **VII. Additive evolution** | ✅ Purely additive producer capability; no field repurposed/removed; schema version unchanged. |
| **VIII. CEM descent** | ✅ Reuses CEM's `@example` and the existing CEM-tag doc-comment vocabulary; `@acmSemantic` is namespaced (ACM-specific Tier-2), not a renamed CEM concept. |
| **IX. Every principle enforceable** | ✅ New golden fixture pins extracted `semantics`/`examples` byte-for-byte; seeded-failure suite proves unknown term rejected, non-compiling example excluded, determinism holds (all in the conformance harness). |
| **X. Untrusted input** | ✅ Notes/captions extracted as inert data (never interpreted); bounded by structural limits; example compilation runs only in the **producer** sandbox, never in a consumer. |

**Result: PASS** (one determinism risk, fully mitigated by the hermetic sandbox design in Phase 0). No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/003-jsdoc-semantics-examples/
├── plan.md              # This file
├── research.md          # Phase 0: sandbox design, tag grammar, vocabulary source, determinism
├── data-model.md        # Phase 1: SemanticDraft, ExampleDraft, verification model
├── quickstart.md        # Phase 1: end-to-end validation scenarios
├── contracts/
│   ├── doc-tags.md            # @acmSemantic / @example authoring contract
│   ├── draft-api.md           # EntryDraft.setSemantics / addExample (plugin-API extension)
│   └── example-verification.md# hermetic compile-sandbox contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/analyzer/
├── src/
│   ├── jsdoc.ts              # + parse @acmSemantic and @example → SemanticDraft / ExampleDraft[]
│   ├── plugin.ts             # + SemanticDraft, ExampleDraft types; EntryDraft.setSemantics/addExample
│   ├── context.ts            # + draft impl, serialization (semantics/examples), provenance records
│   ├── frameworks/shared.ts  # + applyDocMetadata(entry, node, module, ctx) shared helper
│   ├── frameworks/{vanilla,lit,angular,react}.ts  # one-line call to applyDocMetadata
│   ├── examples-verify.ts    # NEW: hermetic ts.Program example compile gate (core, framework-blind)
│   ├── run.ts                # invoke verifyExamples() between engine and emit (one-shot + watch)
│   └── diagnostics.ts        # + ACM-A-SEM*/ACM-A-EX* codes
├── docs/
│   └── semantics-examples.md # NEW: author-facing tag guide (mirrors docs/type-mapping.md)
└── tests/
    └── examples-verify.test.ts   # unit: compile gate pass/fail + determinism (optional layer)

packages/conformance/
├── fixtures/analyzer/doc-metadata/   # NEW golden: component with @acmSemantic + @example (+ a non-compiling example)
│   ├── src/…                         # annotated component source
│   └── agentic-component-manifest.json                      # hand-verified golden (carries semantics + examples)
└── tests/
    ├── analyzer-witness.test.ts      # extend: doc-metadata golden byte-match
    └── analyzer-gates.test.ts        # extend: seeded failures (unknown term, non-compiling example, determinism)
```

**Structure Decision**: Single-package change inside the existing `@xgentic/acm-analyzer`, plus conformance fixtures/tests. Extraction is added to the **shared doc-comment layer** (`jsdoc.ts` + a `shared.ts` helper the four frameworks call), and example verification is a **core post-analyze pass** (`examples-verify.ts` invoked from `run.ts`, so both one-shot and watch runs get it) — parallel to how `emit.ts` runs the reference validator as a core gate. No new package, no plugin-interface consumer breakage (the additions to `EntryDraft` are additive).

## Complexity Tracking

*No Constitution Check violations require justification — table omitted.*
