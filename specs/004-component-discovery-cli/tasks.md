---
description: "Task list for Component Discovery CLI implementation"
---

# Tasks: Component Discovery CLI

**Input**: Design documents from `/specs/004-component-discovery-cli/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: The discovery conformance gates (ranking/rendering goldens, envelope +
exit-code checks, capability drift gate, API ⇄ CLI parity, hostile inertness,
determinism, seeded proofs) are **mandated deliverables** (FR-001..FR-012,
SC-002..SC-008 + Constitution IX) — required tasks, not an optional test layer.
Per-module unit tests are the OPTIONAL layer; none are generated here.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

**Plan refinement recorded here**: seeded non-conformance proofs live in
`packages/conformance/tests/gate-seeded.test.ts` (the file `pnpm test:seeded`
targets — repo convention), not in `discovery-gates.test.ts` as the plan's tree
sketch showed; `discovery-gates.test.ts` keeps hostile-inertness and determinism.

**Analyze remediation recorded here (2026-07-21)**: the self-description command is
`capabilities` ([research R-11](./research.md#r-11--self-description-command-is-capabilities-not-manifest) —
user decision resolving analyze finding I2); legacy `--json` keeps its
diagnostics-on-stderr meaning and is marked `json: false` in the capability
manifest (I1); `--module` is the intra-package disambiguator (U1); gate additions
below cover findings G1–G5.

**Implementation refinements recorded here (2026-07-22)**: the corpus fixture
additionally carries `@acme/vue-buttons` (vue witness copy) and a hand-authored
two-module `@acme/mixed` package — without them no component name is duplicated
anywhere and the ambiguity / `--module` gates (T013/T017) would be untestable;
the hostile corpus copy embeds real ESC/C0/C1 bytes (the source injection fixture
carries none) so the CLI inertness gate exercises actual terminal control
sequences; SC-008's dense-detail baseline is the entry's formatted Canonical JSON
(matching the Agent View token-economy precedent in `gate-agent-view`), and the
dense projection drops `structured` type trees where `raw` carries the same type
information — list baselines unchanged.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task includes an exact file path

## Path Conventions

- Discovery surface: `packages/toolchain/src/` (existing package — no new package)
- Conformance fixtures & gates: `packages/conformance/fixtures/`, `packages/conformance/tests/`
- Contracts bind behavior: [contracts/cli-discovery.md](./contracts/cli-discovery.md), [contracts/envelope.md](./contracts/envelope.md), [contracts/capability-manifest.md](./contracts/capability-manifest.md), [contracts/api.md](./contracts/api.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The corpus fixture and test plumbing every story's gates run against.

- [x] T001 Create the corpus fixture tree `packages/conformance/fixtures/discovery-corpus/`: root `package.json`, plus `node_modules/` packages exercising every NS-DISC branch — `@acme/lit-buttons` (`package.json` with `acm` field → copy of `fixtures/witness/lit/agentic-component-manifest.json`), `@acme/react-buttons` (conventional root filename, copy of `witness/react` manifest), `@acme/ng-widgets` (`.well-known/agentic-component-manifest.json`, copy of `witness/angular` manifest), `hostile-pkg` (conventional filename, copy of `fixtures/hostile/injection.json`), `broken-pkg` (`acm` field advertising a missing file), `plain-pkg` (no manifest)
- [x] T002 [P] Add a CLI spawn helper to `packages/conformance/tests/helpers.ts`: `runAcm(args: string[], opts?): { stdout, stderr, exitCode }` spawning `tsx packages/toolchain/src/cli.ts` with pinned cwd/env (no TTY), for stdout-purity and parity gates
- [x] T003 [P] Confirm the vitest config and `.github/workflows/ci.yml` pick up `packages/conformance/tests/discovery-*.test.ts` and `fixtures/discovery-corpus/`; extend any path-filtered globs so the new gates run in CI

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The command registry, error-code registry, corpus assembly, and sanitizer that every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create `packages/toolchain/src/registry.ts`: `CommandSpec`/`ArgumentSpec`/`OptionSpec` types per [data-model.md](./data-model.md#command-registry) and a `REGISTRY` describing the six existing commands (`validate`, `compile`, `canonicalize`, `agent-view`, `coverage`, `drift`) with descriptions, arguments, options (type/choices/default/repeatable), `jsonSupported`, and ≥1 example each, plus a `GLOBAL_OPTIONS` section (`--json`, `--detail`, `--dense`, `--project`, `--manifest`) with per-command applicability markers; legacy commands declare `jsonSupported: false` and describe their existing `--json` option as "render diagnostics as JSON (stderr)" per [contracts/envelope.md](./contracts/envelope.md) ([research R-01](./research.md#r-01--command-definition-declarative-registry-not-a-cli-framework))
- [x] T005 Rewrite `packages/toolchain/src/cli.ts` as registry-driven parse + dispatch: generate `node:util` `parseArgs` config from `REGISTRY`, route to per-command handlers, unknown command/option → exit 2 — the six existing commands' flags, exit codes, and output preserved byte-for-byte (existing gate suites `pnpm test` must stay green unchanged) (depends on T004)
- [x] T006 [P] Create `packages/toolchain/src/envelope.ts` (part 1): the `ACM-D-*` `ErrorCode` registry with exit-status mapping, `Suggestion` type, `ResponseType` discriminator constants, and the `AcmDiscoveryError` class (`message`, `code`, `suggestions?`) per [contracts/envelope.md](./contracts/envelope.md)
- [x] T007 Create `packages/toolchain/src/corpus.ts` per [research R-03](./research.md#r-03--corpus-assembly-and-admission): assemble from project root + every top-level `node_modules` package (scoped included, `resolveManifestPath` each) + explicit paths; `validateManifest`-gated admission (NS-LIMIT enforced); three-way skip/diagnose/error rules (no manifest → silent; broken advertisement or invalid/over-limit discovered file → `CorpusDiagnostic`; failing explicit path → `AcmDiscoveryError` `ACM-D-BAD-MANIFEST`); extract `ComponentRef` index (name, facets, semantics, verbatim first-line description, `entryPointer`); deterministic order, project-root-relative paths (depends on T006)
- [x] T008 [P] Create `packages/toolchain/src/render.ts` (part 1): the one manifest-text sanitizer per [research R-07](./research.md#r-07--hostile-text-neutralization) (C0/C1 except LF+TAB, ESC/CSI/OSC/DCS → U+FFFD) and shared text-layout helpers; sanitizer applied to human rendering only, never to JSON data

**Checkpoint**: Registry-driven CLI with legacy behavior pinned, error codes, corpus assembly, and sanitizer exist — user stories can begin.

---

## Phase 3: User Story 1 - Search the manifest corpus for a component (Priority: P1) 🎯 MVP

**Goal**: `acm search <query…>` ranks components across the discovered corpus — name/facet/semantic matches above prose, fuzzy typo tolerance, domain tags, runnable follow-ups.

**Independent Test**: Search the corpus fixture for a known component; it ranks above prose-only mentions with a follow-up command that works when run; a typo'd query still finds it; a no-match query reports an explicitly empty result set with exit 0.

- [x] T009 [P] [US1] Create `packages/toolchain/src/search.ts` per [research R-04](./research.md#r-04--search-ranking-and-fuzzy-matching): NFC + lower-case tokenization (literal — no pattern meaning), hand-rolled Damerau-Levenshtein with length-scaled threshold, the eight-tier `MatchTier` scoring (sum of best tier per matching token), ordering score desc → name asc (code point) → package asc; `SearchQuery`/`SearchResult`/`SearchResultSet` types per [data-model.md](./data-model.md#search)
- [x] T010 [US1] Create `packages/toolchain/src/api.ts` with `search(query, opts)` returning the `search` success-envelope object (`{ query, total, results }`, capped by `limit`, `followUp` qualified with `--from` iff the bare name is ambiguous in this corpus); throws `AcmDiscoveryError` `ACM-D-EMPTY-CORPUS` (depends on T007, T009)
- [x] T011 [US1] Register `search` in `packages/toolchain/src/registry.ts` (variadic `query`, `--type` enum `component`, `--limit` number default 20, `--detail`, `--project`, repeatable `--manifest` per [contracts/cli-discovery.md](./contracts/cli-discovery.md)) and implement the handler as a thin wrapper in `packages/toolchain/src/cli.ts` + human rendering in `packages/toolchain/src/render.ts` (compact default: domain tag, sanitized verbatim one-liner, follow-up; `--detail full` adds source, match reason(s), score; unknown `--type` value → usage error listing supported domains) (depends on T005, T008, T010)
- [x] T012 [US1] Create `packages/conformance/tests/discovery-search.test.ts` against `fixtures/discovery-corpus`: Button-named entries rank above prose-only matches; single-char typo places the intended component top-3 (SC-002); a query matching only a controlled semantic term finds the component (US1-AS3); a query made of regex/glob metacharacters is treated literally; `--limit` caps results while `total` reports uncapped count; zero-match query exits 0 with an explicitly empty set; `--detail full` carries source + reason; golden-pinned text output (byte-exact) (depends on T001, T002, T011)

**Checkpoint**: The MVP works — an agent (or human) can find components across the corpus from free text.

---

## Phase 4: User Story 2 - Read one component's full spec (Priority: P2)

**Goal**: `acm component [name]` prints one component's full Manifest entry verbatim (or lists the corpus), with closest-name suggestions, explicit disambiguation via `--from`, detail levels, and dense mode.

**Independent Test**: Request a known component's detail and see every populated Manifest section verbatim; a misspelled name fails with suggestions; a bare ambiguous name yields qualified candidates, resolvable with `--from`; the bare command lists the corpus at `brief`/`compact`/`full`.

- [x] T013 [P] [US2] Create `packages/toolchain/src/component.ts` per [research R-05](./research.md#r-05--name-resolution-disambiguation-and-suggestions): case-insensitive resolution over `ComponentRef`s, `--from` package scoping and `--module` identity-facet scoping (the intra-package disambiguator, combinable with `--from`), zero matches → top-3 Damerau-Levenshtein suggestions (`reason: "similar name"`), multiple matches → ambiguity candidates each with `source` + a `followUp` qualified at whichever scope resolves it
- [x] T014 [US2] Extend `packages/toolchain/src/api.ts` with `component(name?, opts)`: list mode → `component.list` envelope (package-grouped, fields per active `DetailLevel`); detail mode → `component.detail` envelope (`{ name, source: { package, path }, entry }` with `entry` verbatim, unknown/`x-*` fields preserved); throws `ACM-D-UNKNOWN-COMPONENT` / `ACM-D-AMBIGUOUS-COMPONENT` with suggestions (depends on T013)
- [x] T015 [US2] Register `component` in `packages/toolchain/src/registry.ts` (optional `name`, `--from`, `--module`, `--detail`, `--project`, `--manifest`) with its thin-wrapper handler in `packages/toolchain/src/cli.ts` + human rendering in `packages/toolchain/src/render.ts`: full detail sections (description, identity facets, inputs, events, slots/children, methods, CSS hooks, module exports, semantics, examples — omitting unpopulated ones, all text sanitized-verbatim), list at `brief` (default) / `compact` / `full`, error layouts with candidate/suggestion lines (depends on T005, T008, T014)
- [x] T016 [US2] Implement `--dense` in `packages/toolchain/src/render.ts` + wire in `packages/toolchain/src/cli.ts` per [research R-06](./research.md#r-06--detail-levels-and-dense-mode): component detail projected through the existing `agentViewFromValue` (one-way, ADR 0001 — no view parsing anywhere), one-line-per-entry dense rendering for list and search views (depends on T015)
- [x] T017 [US2] Create `packages/conformance/tests/discovery-component.test.ts` against `fixtures/discovery-corpus`: detail completeness (every populated section present, text verbatim vs the source manifest), list levels, unknown-name → `ACM-D-UNKNOWN-COMPONENT` + suggestions, bare `Button` → `ACM-D-AMBIGUOUS-COMPONENT` with qualified candidates and `--from` resolving each, dense detail **and** dense full-corpus list each ≥ 40% smaller than their `--detail full` counterparts by character count with token counts reported via `gpt-tokenizer` (SC-008); golden-pinned detail output (depends on T001, T002, T016)

**Checkpoint**: The discovery loop is complete — search finds, component delivers the spec.

---

## Phase 5: User Story 3 - Consume every command as typed machine output (Priority: P3)

**Goal**: `--json` on any discovery command emits exactly one typed envelope on stdout; every failure path carries a stable `ACM-D-*` code; exit codes and streams are contract.

**Independent Test**: Run every discovery command with `--json` on success and each forced failure; stdout parses as exactly one well-formed envelope with a known discriminator or a coded error; diagnostics appear only on stderr.

- [x] T018 [US3] Wire machine output through `packages/toolchain/src/cli.ts` + `packages/toolchain/src/envelope.ts`: `--json` serializes the handler's envelope object as the only stdout content (single JSON document + trailing newline); every failure path — including parse-layer usage errors (`ACM-D-USAGE`) and the `ACM-D-UNKNOWN` fallback — emits an error envelope in `--json` mode; exit mapping 0/1/2 per [contracts/envelope.md](./contracts/envelope.md); corpus diagnostics render to stderr via `renderDiagnostics` in both modes ([research R-09](./research.md#r-09--exit-codes-and-stream-discipline)) (depends on T011, T015)
- [x] T019 [US3] Create `packages/conformance/tests/discovery-surface.test.ts` (envelope section) using `runAcm`: for `search`/`component`/(later `capabilities`) × success + every forced failure (`ACM-D-EMPTY-CORPUS`, `ACM-D-UNKNOWN-COMPONENT`, `ACM-D-AMBIGUOUS-COMPONENT`, `ACM-D-BAD-MANIFEST`, `ACM-D-USAGE`) — stdout is exactly one parseable envelope, correct discriminator/code, correct exit status, zero-result search is a success envelope, stderr-only diagnostics (`broken-pkg` present in corpus never pollutes stdout) (depends on T001, T002, T018)

**Checkpoint**: The CLI is agent-consumable — envelopes and codes are dependable on every path.

---

## Phase 6: User Story 4 - Agent self-discovery via the capability manifest (Priority: P4)

**Goal**: `acm capabilities` returns the drift-proof structured self-description of the whole CLI surface.

**Independent Test**: Request the capability manifest; it enumerates every command with arguments, options, machine-output support, response types, and examples; any invocation composed from it is accepted; an undescribed registry entry fails the gate.

- [x] T020 [US4] Create `packages/toolchain/src/capability.ts`: pure projection of `REGISTRY` (handlers excluded) into the CapabilityManifest payload — `apiVersion: 1`, `name`, `version` (from `packages/toolchain/package.json`), `description`, `globalOptions`, `commands[]`, `jsonSupported`, `responseTypes`, `errorCodes` — per [contracts/capability-manifest.md](./contracts/capability-manifest.md) (depends on T004, T006)
- [x] T021 [US4] Register `capabilities` in `packages/toolchain/src/registry.ts` (accepts `--json` only; any other flag → `ACM-D-USAGE`) with its thin-wrapper handler in `packages/toolchain/src/cli.ts` and a human rendering in `packages/toolchain/src/render.ts` (command/option summary tables from the same payload) (depends on T018, T020)
- [x] T022 [US4] Add the capability drift gate to `packages/conformance/tests/discovery-surface.test.ts`: every registry entry has a non-empty description, ≥ 1 example, and non-empty `responseTypes` iff `jsonSupported`; the full payload matches a version-normalized golden (`packages/conformance/fixtures/discovery/capability.golden.json` — beside the NS-DISC fixtures, outside the corpus project); accuracy check — an invocation composed per command strictly from the manifest is accepted and answers with a declared response type (depends on T002, T021)

**Checkpoint**: Agents learn the CLI from one call; surface changes are reviewable golden diffs.

---

## Phase 7: User Story 5 - Programmatic access with identical data (Priority: P5)

**Goal**: The same operations as importable functions with identical data, plus envelope consumer utilities — parity gated per operation.

**Independent Test**: For each operation, the API result deep-equals the spawned CLI's `--json` stdout; a forced failure throws `AcmDiscoveryError` with the same code and suggestions the envelope carries; `parseResponse`/`isError`/`assertResponse` classify raw output correctly.

- [x] T023 [P] [US5] Extend `packages/toolchain/src/envelope.ts` (part 2) with the consumer utilities per [contracts/api.md](./contracts/api.md): `parseResponse` (parse + envelope-shape validation, throws naming the problem), `isError` narrowing, `assertResponse` (throws `AcmDiscoveryError` on error envelope, explicit type-mismatch error otherwise), and per-discriminator payload types (`SearchResponse`, `ComponentListResponse`, `ComponentDetailResponse`, `CapabilitiesResponse`, `CLIResult`)
- [x] T024 [US5] Re-export the discovery public surface from `packages/toolchain/src/index.ts`: `search`, `component`, `capabilities`, `AcmDiscoveryError`, `parseResponse`, `isError`, `assertResponse`, and the envelope/payload types — extending the existing "public integration surface" doc comment (depends on T010, T014, T020, T023)
- [x] T025 [US5] Add the parity gate to `packages/conformance/tests/discovery-surface.test.ts`: per operation (`search`, `component` list + detail, `capabilities`) deep-equal API result vs `JSON.parse(runAcm([...,'--json']).stdout)` on identical inputs against `fixtures/discovery-corpus`; per error code, `AcmDiscoveryError.code`/`.suggestions` equal the envelope's fields (SC-007) (depends on T019, T024)

**Checkpoint**: All five stories functional — one computation per operation, two surfaces, gated identical.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: The cross-story mandated gates (hostile inertness, determinism, seeded proofs) and doc alignment.

- [x] T026 Create `packages/conformance/tests/discovery-gates.test.ts`: hostile inertness through the CLI (FR-011/SC-005 — `hostile-pkg` text via `search` and `component` in human mode contains no ESC/C0 byte; in `--json` mode round-trips byte-exact inside `data` with envelope structure unaffected); determinism (SC-004 — repeated identical invocations byte-identical, incl. `--json` and `--dense`); performance smoke (SC-002 — search over a generated ≥ 100-component corpus in a temp dir completes < 1 s); end-to-end SC-001 case — parse `capabilities --json` output, compose a search invocation from it alone, run a result's `followUp`, assert a `component.detail` envelope; SC-004's two-platform half is discharged by the existing CI matrix running this suite (note it in the test header) (depends on T012, T017, T019, T021)
- [x] T027 Add discovery seeded proofs to `packages/conformance/tests/gate-seeded.test.ts` (Constitution IX / repo `test:seeded` convention): a registry entry with a blanked description MUST fail the capability drift gate; rendering with the sanitizer bypassed MUST fail the inertness assertion; a handler mutating its envelope after render MUST fail the parity gate (depends on T022, T025, T026)
- [x] T028 [P] Update `AGENTS.md` (reference CLI command list gains `search | component | capabilities`) and `llms.txt` (index the 004 spec + contracts), using CONTEXT.md vocabulary exactly (invariant #8)
- [x] T029 Run [quickstart.md](./quickstart.md) end-to-end against `fixtures/discovery-corpus` and the full gate set: `pnpm test`, `pnpm test:seeded`, `pnpm lint`, `pnpm format` — all green; commit goldens produced along the way as reviewed diffs (depends on T026, T027, T028)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately; T001/T002/T003 are mutually parallel
- **Foundational (Phase 2)**: T004 → T005; T006 → T007; T008 independent — BLOCKS all stories
- **US1 (Phase 3)**: needs Phase 2; T009 can start with Phase 2 in flight (pure module)
- **US2 (Phase 4)**: needs Phase 2; independent of US1 at the module level (component.ts vs search.ts) but shares `render.ts`/`api.ts`/`registry.ts` files — parallelize only across different files
- **US3 (Phase 5)**: needs the US1 + US2 handlers it wraps (T011, T015)
- **US4 (Phase 6)**: needs T004 (registry) + T018 (json wiring for the `capabilities` command)
- **US5 (Phase 7)**: needs the API functions (T010, T014, T020) and envelope core (T006)
- **Polish (Phase 8)**: T026 needs the story gates; T027 last-gate; T028 anytime after Phase 6

### User Story Dependency Notes

US1 and US2 are independently testable increments (text mode). US3 layers machine
output over both without changing computed data. US4 depends only on the registry +
json wiring, not on search/component internals. US5 packages what US1–US4 built.
Deviation from the template's "all stories independent" ideal is inherent to a
single-binary CLI and was accepted in the plan (thin-wrapper architecture, R-08).

### Parallel Opportunities

- Phase 1: T001 ∥ T002 ∥ T003
- Phase 2: T006 ∥ T008 (T004→T005 chain alongside)
- Phase 3: T009 ∥ (Phase 2 tail)
- Phase 4: T013 ∥ US1's T012 (different files)
- Phase 7: T023 ∥ Phase 6 work
- Phase 8: T028 ∥ T026

## Parallel Example: start of implementation

```bash
# After Phase 1 kickoff, run in parallel:
Task: "T001 corpus fixture tree in packages/conformance/fixtures/discovery-corpus/"
Task: "T002 runAcm spawn helper in packages/conformance/tests/helpers.ts"
Task: "T003 CI glob check in .github/workflows/ci.yml"

# Inside Phase 2:
Task: "T006 envelope.ts part 1 (codes, error class)"
Task: "T008 render.ts part 1 (sanitizer)"
# while T004 → T005 (registry → cli rewrite) proceeds sequentially
```

## Implementation Strategy

**MVP first (US1)**: Phases 1–3 deliver a working, gated `acm search` in text mode —
the agent's entry point — with the registry migration already banked. Stop, run
`discovery-search.test.ts` + the full existing suite (legacy behavior pinned), demo.

**Incremental delivery**: +US2 (the follow-up half of the loop) → +US3 (agent-grade
machine output) → +US4 (self-description) → +US5 (programmatic parity) → Polish
(cross-cutting mandated gates + docs). Each checkpoint leaves `pnpm test` green and
every shipped surface golden-pinned; ranking or rendering changes after that are
intentional, reviewable golden diffs.
