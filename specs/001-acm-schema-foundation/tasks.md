# Tasks: ACM Schema Foundation

**Input**: Design documents from `/specs/001-acm-schema-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Conformance/gate tests are NOT optional TDD scaffolding here — they are the
product (constitution IX: the suite is the executable constitution; spec FR-004…FR-013).
They appear as implementation tasks inside each story.

**Organization**: Tasks grouped by user story; each story is an independently testable
increment per spec.md priorities.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US4 mapping to spec.md user stories

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: pnpm monorepo scaffolding per plan.md structure

- [X] T001 Create monorepo skeleton: root `package.json`, `pnpm-workspace.yaml`, base `tsconfig.json` (strict, ESM, NodeNext), `.editorconfig` (LF, final newline), extend `.gitignore`; `packages/{spec,toolchain,conformance}/package.json` + `tsconfig.json`
- [X] T002 Add dependencies and wiring: `ajv`, `yaml`, `json-schema-to-typescript`, `gpt-tokenizer`, `vitest`, `tsx`, `typescript`; per-package `vitest.config.ts`; root scripts `test`, `test:seeded`, `acm` (CLI alias into `packages/toolchain/src/cli.ts`)
- [X] T003 [P] Configure ESLint + Prettier scoped to `packages/*/src` and `packages/*/tests` only — fixtures and `packages/spec/generated/` are excluded so formatters never fight canonical form
- [X] T004 [P] Create `.github/workflows/ci.yml`: matrix `ubuntu-latest`/`macos-latest`, principle-named jobs `gate-schema`, `gate-coverage`, `gate-determinism`, `gate-fixtures`, `gate-drift` (each a `pnpm` filter; jobs may be stubs until their suites exist)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: THE schema, its meta-schema, the Normative Spec, and the generation
pipeline — every story depends on these

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Author `packages/spec/schema/acm.meta.schema.json`: every specified property must carry `type`, non-empty `description`, `acmTier` (`derived`|`authored-verifiable`); `acmApplicability` present ⇒ `acmCemInherited: true` (research R10)
- [X] T006 Author `packages/spec/schema/acm.schema.json` document skeleton: `$id`, `schemaVersion` (required), `modules[]` → Module (`path`, `declarations`, `exports`), ModuleExport with in-document reference, `x-*` `patternProperties` at every node level (data-model.md skeleton)
- [X] T007 Extend `packages/spec/schema/acm.schema.json` with ComponentDeclaration + Identity: facets `tagName`/`module`+`export` (both-or-neither)/`selector`, ≥1 facet required, required `paradigmClass` enum (`retained-dom`|`vdom`|`compiler-sfc`|`signals-di`)
- [X] T008 Extend `packages/spec/schema/acm.schema.json` with member nodes: Input (incl. `twoWay`, `reflects`), Event, Slot (incl. `scopedPayload`), Method, CssProperty, CssPart — CEM-inherited names per research R12; `acmCemInherited`/`acmApplicability` on `cssParts` and `reflects`
- [X] T009 Extend `packages/spec/schema/acm.schema.json` with the layered type model: TypeExpression (`structured`+`raw`, both-or-neither) and the closed TypeNode grammar in `$defs` (`primitive`|`literal`|`union`|`array`|`record`|`object`|`function`|`reference`|`opaque`)
- [X] T010 [P] Create `packages/spec/data/vocabulary.json` (pinned Open UI taxonomy + WAI-ARIA role/APG terms, versioned) and wire SemanticClassification (`term` enum generated from it, size-capped `notes`) + Example nodes into the schema
- [X] T011 Add structural limits: `maxLength`/`maxItems`/`maxProperties` on every string/array/map node in `acm.schema.json`; document the registry with rationale in `packages/spec/data/limits.md`
- [X] T012 [P] Author `packages/spec/normative-spec.md` with stable clause IDs: ACM Canonical JSON profile, YAML authoring profile, Agent View emitter rules, must-ignore, structural limits + nesting depth, discovery convention, diagnostic rule-id registry (`ACM-*`), clause→check traceability table (rows filled as gates land)
- [X] T013 [P] Implement `packages/toolchain/src/diagnostics.ts`: diagnostic type with JSON Pointer + stable rule id + message; `--json` serializer (contracts/toolchain-cli.md rule 2)
- [X] T014 Implement gate-schema suite in `packages/conformance/tests/gate-schema.test.ts`: `acm.schema.json` validates against draft 2020-12 AND `acm.meta.schema.json`; seeded violations (field missing `description`/`acmTier`; `acmApplicability` without `acmCemInherited`) are rejected
- [X] T015 Implement generation pipeline: `packages/toolchain/src/drift.ts` regenerates `packages/spec/generated/types.ts` (json-schema-to-typescript) and `packages/spec/generated/reference.md` (field reference from schema descriptions), exit 3 on `git diff` drift; commit the initial generated artifacts
- [X] T016 Implement `packages/toolchain/src/cli.ts` skeleton: subcommand routing for `validate|canonicalize|compile|agent-view|coverage|drift`, `--json` flag, exit-code contract (0/1/2/3/4 per contracts/toolchain-cli.md)

**Checkpoint**: schema exists and is meta-schema-clean; generated artifacts fresh; CLI routes

---

## Phase 3: User Story 1 - Describe and validate a component manifest (Priority: P1) 🎯 MVP

**Goal**: A producer (human or agent) validates a manifest and gets precise, rule-id
diagnostics; the full fixture set exists as the proof corpus

**Independent Test**: spec.md US1 acceptance scenarios — minimal Button accepted; seven
mutation classes rejected each with the correct node pointer + rule id; `x-*` preserved

- [X] T017 [US1] Implement `packages/toolchain/src/validate.ts`: Ajv 2020-12 + custom `acm*` vocabulary, structural limits, nesting-depth check (`ACM-V-DEPTH`), export-reference resolution, duplicate-member rejection, both-or-neither TypeExpression rule; wire into CLI `acm validate`
- [X] T018 [P] [US1] Author minimal fixture `packages/conformance/fixtures/minimal/agentic-component-manifest.json` — trivial component, empty-surface edge case, within future byte budget
- [X] T019 [P] [US1] Author 4 witness fixtures: `packages/conformance/fixtures/witness/{lit,react,vue,angular}/agentic-component-manifest.json` — Button-class component per paradigm class, every core node populated somewhere across the four, zero core semantics in `x-*` (SC-001)
- [X] T020 [P] [US1] Author 5 adversarial fixtures: `packages/conformance/fixtures/adversarial/{headless,scoped-slot,polymorphic,controlled,form-associated}/agentic-component-manifest.json` (constitution IX list; `scopedPayload` exercised)
- [X] T021 [P] [US1] Author maximal fixture `packages/conformance/fixtures/maximal/agentic-component-manifest.json` (DataGrid-class, validates inside all limits) and hostile fixtures `packages/conformance/fixtures/hostile/{injection.json,over-limit.json,deep-nesting.json}`
- [X] T022 [US1] Implement validation conformance suite `packages/conformance/tests/gate-fixtures.test.ts`: all valid fixtures accepted; the seven US1 mutation classes rejected with expected rule ids; unknown `x-*` fields survive validation untouched; hostile `over-limit`/`deep-nesting` rejected with limit rule ids

**Checkpoint**: MVP — a published shape plus a validator with teeth

---

## Phase 4: User Story 2 - Author in YAML, distribute canonical JSON (Priority: P2)

**Goal**: Deterministic pipeline: YAML authoring input → ACM Canonical JSON;
regenerate-and-diff works

**Independent Test**: spec.md US2 scenarios — double-compile byte-identity (two
platforms via CI); out-of-profile YAML rejected naming the profile rule; reordered-key
drift detected

- [X] T023 [US2] Implement `packages/toolchain/src/canonicalize.ts` per ADR 0002: key order extracted from schema declaration order at build time, lexicographic for map/`x-*` keys, `Number::toString` scalars, minimal string escaping, 2-space/LF/trailing-newline layout; CLI `acm canonicalize` + `--check` (exit 3 on drift)
- [X] T024 [US2] Implement `packages/toolchain/src/compile.ts`: `yaml` v2 with `schema: 'core'`, `uniqueKeys`, custom tags rejected (`ACM-P-YAMLTAG`), non-string keys rejected (`ACM-P-KEY`), then validate + canonicalize; CLI `acm compile` (exit 2 on profile violation)
- [X] T025 [P] [US2] Author YAML authoring sources `packages/conformance/fixtures/minimal/acm.src.yml` and `packages/conformance/fixtures/witness/react/acm.src.yml` that compile byte-identically to their checked-in canonical JSON
- [X] T026 [US2] Implement determinism suite `packages/conformance/tests/gate-determinism.test.ts`: double-run byte-identity for compile/canonicalize over all fixtures; number-serialization cases (`1.0`→`1`, exponents); arbitrary-key map ordering; YAML 1.1-ism rejection (Norway problem case); hand-reordered fixture flagged by `--check`

**Checkpoint**: regenerate-and-diff is real; review mechanism live

---

## Phase 5: User Story 3 - Agent consumes a component via the Agent View (Priority: P3)

**Goal**: Deterministic one-way YAML projection with golden pairs and proven token
savings

**Independent Test**: spec.md US3 scenarios — emitter output byte-equals golden
`.view.yml`; token delta ≥15%; injection text surfaced as inert data

- [X] T027 [US3] Implement `packages/toolchain/src/agent-view.ts` per ADR 0001 emitter profile (block style, plain-where-lossless else double-quoted scalars, no anchors/flow, canonical key order, 2-space/LF); CLI `acm agent-view` (exit 3 if input not canonical); no reverse command exists
- [X] T028 [P] [US3] Generate and check in golden pairs `acm.view.yml` next to every fixture's `agentic-component-manifest.json` (minimal, maximal, 4 witness, 5 adversarial, hostile/injection)
- [X] T029 [US3] Implement agent-view suite `packages/conformance/tests/gate-agent-view.test.ts`: byte-equality against goldens; `gpt-tokenizer` (o200k_base) delta ≥15% vs formatted JSON for every golden fixture (SC-005); reference-consumer test asserting `hostile/injection.json` description text is returned as inert data, never interpreted (SC-006)

**Checkpoint**: the agent-facing path is deterministic and cheaper, provably

---

## Phase 6: User Story 4 - Conformance harness gates every change (Priority: P4)

**Goal**: Every constitutional principle fails CI when violated

**Independent Test**: spec.md US4 scenarios — each seeded non-conformant change is
blocked, naming its gate (SC-007)

- [X] T030 [US4] Implement `packages/toolchain/src/coverage.ts`: build node × paradigm-class matrix from `acm.schema.json` + witness fixtures; honor `acmApplicability` annotations; reject restricted applicability on non-`acmCemInherited` nodes; CLI `acm coverage` (exit 4 on unwitnessed unannotated cells, `--json` matrix output)
- [X] T031 [US4] Implement seeded suite `packages/conformance/tests/gate-seeded.test.ts` (run as `pnpm test:seeded`): programmatically apply the quickstart.md mutation table (untiered field, removed Angular witness, reordered keys, budget growth, new-node applicability escape) to in-memory copies and assert each gate fires
- [X] T032 [US4] Add minimal-fixture byte-budget gate (budget constant in `packages/conformance/tests/gate-fixtures.test.ts`, change = reviewable diff) and finalize `.github/workflows/ci.yml`: all five principle-named jobs run their real suites; fill the Normative Spec traceability table rows to 100% (SC-003)

**Checkpoint**: the constitution is executable; wishes are now laws

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] Run quickstart.md end-to-end on a clean clone; fix any command/path drift in `specs/001-acm-schema-foundation/quickstart.md`
- [X] T034 [P] Write root `README.md`: what ACM is, constitution/CONTEXT.md/ADR links, quickstart pointer, conformance-class summary
- [X] T035 Verify cross-platform CI green (ubuntu + macos byte-identity, SC-002) and performance targets (suite < 60 s, maximal validation < 1 s, canonicalization < 100 ms per plan.md); tune if missed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately
- **Foundational (Phase 2)**: needs Setup; **blocks all stories**. Internal order: T005 → T006 → T007 → T008 → T009 → T011 (schema is sequential edits to one file); T010/T012/T013 parallel to schema tail; T014/T015 after T011; T016 after T013
- **US1 (Phase 3)**: needs Phase 2. T017 first; fixtures T018–T021 parallel after T017 (they're validated as authored); T022 last
- **US2 (Phase 4)**: needs Phase 2 + fixtures from US1 (T018–T021). T023 → T024 → T025 → T026
- **US3 (Phase 5)**: needs US2's canonicalizer (T023). T027 → T028 → T029
- **US4 (Phase 6)**: needs US1 fixtures + US2 canonicalizer; T030 → T031 → T032
- **Polish (Phase 7)**: needs all stories

### Story independence note

US2–US4 consume US1's *fixtures* (shared corpus authored once), but each story's
*capability* is independently testable per its checkpoint — the corpus is data, not a
code dependency.

### Parallel Opportunities

- Phase 1: T003 + T004 together after T001–T002
- Phase 2: T010, T012, T013 alongside schema tail; T014 ∥ T015 after schema freeze
- Phase 3: T018, T019, T020, T021 — four agents/devs, one fixture directory each
- Phase 5: T028 golden generation parallel across fixture directories

## Parallel Example: User Story 1

```bash
# After T017 (validator) lands, author the whole corpus concurrently:
Task: "Author minimal fixture in packages/conformance/fixtures/minimal/agentic-component-manifest.json"
Task: "Author witness fixtures in packages/conformance/fixtures/witness/{lit,react,vue,angular}/"
Task: "Author adversarial fixtures in packages/conformance/fixtures/adversarial/"
Task: "Author maximal + hostile fixtures in packages/conformance/fixtures/{maximal,hostile}/"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) → Phase 2 (Foundational — the schema IS the product's core)
2. Phase 3 (US1): validator + full fixture corpus
3. **STOP and VALIDATE**: US1 checkpoint = a publishable schema + validator (the
   spec's stated MVP)

### Incremental Delivery

- +US2 → determinism/review mechanism live (regenerate-and-diff)
- +US3 → agent path live (Agent View + token proof)
- +US4 → constitution fully executable (all gates armed)
- Phase 7 → clean-clone proof + docs

## Notes

- Fixture files are canonical JSON — never touched by Prettier (T003 exclusion)
- Every suite must stay deterministic: no snapshots with timestamps, no network
- Commit after each task or logical group; generated artifacts (T015) are committed,
  drift-checked, never hand-edited
