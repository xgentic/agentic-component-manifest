---
description: "Task list for Doc-Comment Semantics & Examples Extraction"
---

# Tasks: Doc-Comment Semantics & Examples Extraction

**Input**: Design documents from `/specs/003-jsdoc-semantics-examples/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED. The spec (FR-012) and constitution (Principle IX) require golden fixtures + seeded-failure gates, so each user story lands its conformance tests first (TDD).

**Organization**: Tasks are grouped by user story (P1 semantics → P2 examples → P3 safe handling) so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (setup, foundational, and polish carry no story label)

## Path Conventions

Single monorepo package `@acm/analyzer` at `packages/analyzer/`; conformance fixtures/tests at `packages/conformance/`. No new package, no schema change (`semantics`/`examples` already exist in `acm.schema.json`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared scaffolding both stories consume.

- [X] T001 Add the six doc-metadata diagnostic codes to `packages/analyzer/src/diagnostics.ts` — `ACM-A-SEMTERM`, `ACM-A-SEMDUP`, `ACM-A-EXLANG`, `ACM-A-EXEMPTY`, `ACM-A-EXCOMPILE`, `ACM-A-EXLIMIT`, all `warning` severity (non-fatal, exit 3), per [research R-07](./research.md)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The draft surface, serialization, and vocabulary source every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `SemanticDraft` and `ExampleDraft` types and the additive `setSemantics(semantic)` / `addExample(example)` methods to the `EntryDraft` interface in `packages/analyzer/src/plugin.ts` per [contracts/draft-api.md](./contracts/draft-api.md) (no existing signature changes — external plugins unaffected)
- [X] T003 Implement `setSemantics`/`addExample` + internal `pruneExamples(keep: boolean[])` in `EntryDraftImpl`, record provenance (`/semantics`, `/examples/<n>`), and serialize `semantics`/`examples` in `toEntry()` in schema key order (after `cssParts`, before `x-*`), absent-when-empty, in `packages/analyzer/src/context.ts` per [data-model.md](./data-model.md) (depends on T002)
- [X] T004 [P] Add a controlled-vocabulary helper that reads the term set from `acmSchema.$defs.semanticClassification.term.enum` (via the already-imported `@acm/toolchain`) as the single-source validation list, in `packages/analyzer/src/jsdoc.ts`, per [research R-02](./research.md)

**Checkpoint**: Draft API + serialization + vocabulary source ready — stories can begin.

---

## Phase 3: User Story 1 - Classify a component's role from its doc comment (Priority: P1) 🎯 MVP

**Goal**: A `@acmSemantic <term> - <notes>` doc tag on a component becomes `semantics` in the manifest, with the term validated against the controlled vocabulary.

**Independent Test**: Annotate a component with `@acmSemantic switch`, analyze, and confirm `declarations[].semantics.term === "switch"`; an out-of-vocabulary term is dropped with a diagnostic and the manifest stays valid.

### Tests for User Story 1 ⚠️ (write first, expect failure)

- [X] T005 [P] [US1] Create golden fixture `packages/conformance/fixtures/analyzer/doc-metadata/` — `src/` with a `@acmSemantic`-annotated component (+ `package.json`) and a hand-verified `agentic-component-manifest.json` carrying `semantics` (term + notes)
- [X] T006 [US1] Extend `packages/conformance/tests/analyzer-witness.test.ts` to byte-match the doc-metadata golden, and `packages/conformance/tests/analyzer-gates.test.ts` with seeded semantic failures (unknown term → `ACM-A-SEMTERM` + no `semantics`; duplicate tag → `ACM-A-SEMDUP`, first-wins) — assert red before T007/T008

### Implementation for User Story 1

- [X] T007 [US1] Implement `@acmSemantic <term> - <notes>` parsing in `packages/analyzer/src/jsdoc.ts`: reuse `splitDescription` for the `term`/`notes` split, validate `term` against the T004 vocabulary helper, capture `notes` as a verbatim `Span`, first-wins on duplicates, emit `ACM-A-SEMTERM`/`ACM-A-SEMDUP` otherwise, per [contracts/doc-tags.md](./contracts/doc-tags.md) (depends on T004)
- [X] T008 [US1] Add `applyDocMetadata(entry, node, module, ctx)` to `packages/analyzer/src/frameworks/shared.ts` (semantics branch → `entry.setSemantics`) and call it from the per-declaration extraction in `frameworks/vanilla.ts`, `lit.ts`, `angular.ts`, `react.ts` so extraction is framework-blind, per [research R-06](./research.md) (depends on T003, T007)

**Checkpoint**: Semantics extraction works across all four frameworks; US1 golden byte-matches; MVP shippable.

---

## Phase 4: User Story 2 - Extract usage examples from doc comments (Priority: P2)

**Goal**: `@example` blocks are extracted, compile-verified against the component in a hermetic sandbox, and the compiling ones emitted as `examples[]`.

**Independent Test**: Add a compiling and a non-compiling `@example` to a component, analyze, and confirm only the compiling one appears in `examples[]` (in source order) while the broken one is excluded with `ACM-A-EXCOMPILE`; the manifest stays valid and canonical.

### Tests for User Story 2 ⚠️ (write first, expect failure)

- [X] T009 [P] [US2] Extend the doc-metadata fixture `src/` with `@example` blocks — one compiling (kept), one referencing a non-existent member (excluded), one ```` ```html ```` block (kept, not compiled) — and update the golden `agentic-component-manifest.json` to carry only the surviving `examples[]` (in source order)
- [X] T010 [US2] Extend `analyzer-witness.test.ts` (examples in the golden byte-match) and `analyzer-gates.test.ts` (non-compiling example excluded + `ACM-A-EXCOMPILE`; empty block → `ACM-A-EXEMPTY`; unsupported fence language → `ACM-A-EXLANG`) — assert red before T011–T014

### Implementation for User Story 2

- [X] T011 [US2] Implement `@example` parsing in `packages/analyzer/src/jsdoc.ts`: one `ExampleDraft` per block in source order, leading prose line → `title`, fence info-string → `lang` (default `ts`; unsupported → `ACM-A-EXLANG`), verbatim code `Span` as `source` (fences stripped), empty body → `ACM-A-EXEMPTY`, per [contracts/doc-tags.md](./contracts/doc-tags.md) and [research R-03](./research.md)
- [X] T012 [US2] Extend `applyDocMetadata` in `packages/analyzer/src/frameworks/shared.ts` with the examples branch → `entry.addExample(...)` (inherited by all four frameworks via the T008 seam) (depends on T008, T011)
- [X] T013 [US2] Implement the hermetic compile-verification sandbox in `packages/analyzer/src/examples-verify.ts`: one `ts.Program` per run over an in-memory `CompilerHost` overlaying the analyzed `SourceFile`s + one synthetic module per example, pinned hermetic `CompilerOptions`, no `node_modules` resolution; keep an example iff its synthetic file has zero diagnostics, else `ACM-A-EXCOMPILE`; HTML examples not compiled, per [contracts/example-verification.md](./contracts/example-verification.md) (depends on T003)
- [X] T014 [US2] Invoke `verifyExamples(moduleContexts, cwd)` in `packages/analyzer/src/run.ts` between `runEngine` and `emit`, pruning non-compiling examples via the internal `pruneExamples` handle and accumulating diagnostics (so one-shot and watch cycles both verify), per [research R-05](./research.md) (depends on T013, T012)

**Checkpoint**: Examples extracted and compile-verified; US1 + US2 goldens byte-match; both work independently.

---

## Phase 5: User Story 3 - Safe, deterministic handling of invalid annotations (Priority: P3)

**Goal**: Every malformed annotation degrades to "field absent + diagnostic", never an invalid manifest or a failed build; output is byte-deterministic.

**Independent Test**: Feed unknown term, over-limit note/example, > 32 examples, empty/broken examples; each yields a diagnostic, the offending optional item is dropped, and the manifest still validates and is byte-identical across runs.

### Implementation for User Story 3

- [X] T015 [US3] Enforce structural-limit degradation for optional Tier-2 content — drop over-limit `notes`/example `source` and examples beyond the 32-item cap with `ACM-A-EXLIMIT` rather than aborting (keeps the manifest inside limits, spec FR-008) — in `packages/analyzer/src/jsdoc.ts` / `context.ts`
- [X] T016 [US3] Add the comprehensive seeded-failure + determinism suite to `packages/conformance/tests/analyzer-gates.test.ts`: every code (`SEMTERM`/`SEMDUP`/`EXEMPTY`/`EXLANG`/`EXCOMPILE`/`EXLIMIT`) fires for the right reason, the manifest stays schema-valid, hostile notes/captions are surfaced inert (Principle X), and a double-run is byte-identical incl. compile-verified `examples[]` (SC-003, SC-005)

**Checkpoint**: All malformed inputs handled deterministically; the feature is CI-trustworthy.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] Write `packages/analyzer/docs/semantics-examples.md` — author-facing guide for `@acmSemantic`/`@example` (mirrors `docs/type-mapping.md`), sourced from [contracts/doc-tags.md](./contracts/doc-tags.md)
- [X] T018 [P] Promote `@acmSemantic` and `@example` from the "Planned — not yet shipped" callout into the main Doc-comment tags table in `packages/analyzer/README.md` (now shipped), linking the new docs page
- [X] T019 Confirm CI green: `pnpm test analyzer` (new goldens + gates), `pnpm drift` fresh (no schema change expected), and the SC-007 bench (`packages/analyzer/tests/bench/perf.test.ts`) still within its 30 s ceiling with example verification enabled (SC-006)
- [X] T020 Run [quickstart.md](./quickstart.md) scenarios 1–4 end-to-end (semantics, compile-verified examples, invalid-dropped, determinism) and fix any command/path drift

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately.
- **Foundational (Phase 2)**: needs Setup; **blocks all stories**. Internal order: T002 → T003 (context depends on the new types); T004 [P] alongside.
- **US1 (Phase 3)**: needs Foundational. T005 [P] → T006 (red) → T007 → T008.
- **US2 (Phase 4)**: needs Foundational + the US1 `applyDocMetadata` seam (T008). T009 [P] → T010 (red) → T011 → T012 → T013 → T014.
- **US3 (Phase 5)**: needs US1 + US2 (it hardens their extraction). T015 → T016.
- **Polish (Phase 6)**: needs the targeted stories complete.

### User Story Dependencies

- **US1 (P1)**: only Foundational. Independently testable via the semantics golden + seeded term failures. **MVP.**
- **US2 (P2)**: Foundational + the US1 shared seam (`applyDocMetadata`, T008). Independently testable via the examples golden + compile-verification gates.
- **US3 (P3)**: builds on US1/US2 extraction; independently testable via the seeded-failure/determinism suite.

### Within Each Story

- Tests (golden fixture + gate) written first and failing before implementation.
- `jsdoc.ts` parsing before `shared.ts` wiring; `examples-verify.ts` before its `run.ts` hook.

### Parallel Opportunities

- **Phase 2**: T004 [P] alongside T002/T003.
- **Phase 3/4**: the golden-fixture task (T005 / T009) [P] alongside authoring the test file, before implementation.
- **Phase 6**: T017 + T018 [P] (docs vs README, different files).

---

## Parallel Example: Foundational

```bash
# After T002 lands the draft types, T003 (context.ts) and T004 (vocab helper) can proceed;
# T004 touches only jsdoc.ts and is independent of the context serialization work:
Task: "T004 [P] vocabulary helper reading the schema term enum in packages/analyzer/src/jsdoc.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 (Setup) → Phase 2 (Foundational — draft API + serialization + vocab source).
2. Phase 3 (US1): `@acmSemantic` extraction + golden + seeded term failures.
3. **STOP and VALIDATE**: annotate a component, analyze, confirm `semantics` byte-matches the golden. Semantic classification is now derivable from source — shippable value.

### Incremental Delivery

- US1 → semantics from doc comments (MVP).
- US2 → compile-verified usage examples (the trust-bearing Tier-2 content).
- US3 → deterministic, safe handling of every malformed annotation.
- Polish → author docs, README promotion, CI + quickstart proof.

## Notes

- No schema/Normative-Spec change: `semantics`/`examples` already exist as Tier-2 fields; this is a producer capability pinned by fixtures + gates.
- The one architectural first: `examples-verify.ts` introduces a **scoped, hermetic** `ts.Program` (checker) — the rest of the analyzer stays syntax-only. Determinism is the governing constraint (pinned options, no `node_modules`).
- `[P]` = different files, no incomplete-task dependency. Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently.
