---
description: "Task list for Agent Discovery Skill implementation"
---

# Tasks: Agent Discovery Skill

**Input**: Design documents from `/specs/005-agent-discovery-skill/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (user stories).
Phase 0/1 design is bound in the repo `docs/` tree, not duplicated here:
[agent-discovery-architecture.md](../../docs/proposals/agent-discovery-architecture.md)
(system) and [steering-layer-generator.md](../../docs/architecture/steering-layer-generator.md)
(tool — package layout §3, block model §4, pipeline §5, targets §6, gates §7, decision
log §9), grounded in [ADR 0003](../../docs/adr/0003-agent-consumption-layer.md) /
[0004](../../docs/adr/0004-skill-generated-from-capability-manifest.md) /
[0005](../../docs/adr/0005-lexical-search-agent-retrieval-ladder.md).

**Tests**: The skill gates (authored-reference sweep, packaging fidelity, token budgets,
playbook coverage, the documented loop incl. hostile fixtures, the seeded-fabrication
proof) are **mandated deliverables** (FR-004..FR-008, FR-010, SC-002..SC-007 +
Constitution IX) — required tasks, not an optional layer. Per-module unit tests are the
OPTIONAL layer; none are generated here.

**Organization**: Tasks are grouped by user story (US1–US4) to enable independent
implementation and testing.

**Current state (2026-07-22)**: this task list formalizes work that was largely built
ahead of it as untracked WIP (`packages/discovery-skill/`,
`packages/toolchain/src/agent-docs.ts`, the `agent-docs` command, `skill-gates.test.ts`,
the `gate-seeded` fabrication proof, and the CONTEXT.md / llms.txt / README updates). A
`[x]` below means the artifact is present on disk **and wired**, verified by inspection.

**Closeout run 2026-07-22**: `pnpm test` green (287/287, incl. `skill-gates` 20 and
`discovery-gates` 6), `pnpm test:seeded` green (10/10), `pnpm drift` fresh, `pnpm lint`
clean. **T017** is now validated (see below) and closed. Only **T025** remains partly
open: `pnpm format` still reports 16 files, but **none belong to this feature** — they
are pre-existing repo-wide Prettier debt (analyzer/spec/agent-view/coverage, clean in
`HEAD`); every feature-005 file is Prettier-clean. Committing the reviewed diffs is
deferred to the repo owner.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Every task includes an exact file path

## Path Conventions

- Generator: `packages/toolchain/src/agent-docs.ts` (+ `drift.ts` / `registry.ts` / `cli.ts` wiring)
- Steering-layer product package: `packages/discovery-skill/` (`blocks/` authored, `generated/` invariant #1)
- Conformance gates: `packages/conformance/tests/skill-gates.test.ts`, `gate-seeded.test.ts`, `discovery-gates.test.ts`
- Gate ids (G1–G6) trace to [architecture §7](../../docs/architecture/steering-layer-generator.md)

---

## Phase 1: Setup (Product Package Scaffold)

**Purpose**: The `@acm/discovery-skill` package every block and target lives in.

- [x] T001 Create the `@acm/discovery-skill` workspace package: `packages/discovery-skill/package.json` (name, `version` in lockstep with `@acm/toolchain` per decision D3, `files: [blocks, generated, README.md]`), the `blocks/` (authored) and `generated/{blocks,targets}/` (invariant #1) directory layout per [architecture §3](../../docs/architecture/steering-layer-generator.md#3-package-layout), and `packages/discovery-skill/README.md` documenting how the package is built (authored vs generated, marker grammar, lockstep)
- [x] T002 Confirm the vitest config and `.github/workflows/ci.yml` pick up `packages/conformance/tests/skill-gates.test.ts` and that `pnpm drift` covers `packages/discovery-skill/generated/**` (the generated artifacts join `pnpm generate` / `pnpm drift`)

---

## Phase 2: Foundational (The Generator) — Blocking Prerequisites

**Purpose**: `acm agent-docs` — the capability-manifest projection + block-merge + target
emission every user story's content and gates run through.

**⚠️ CRITICAL**: No user story work can be verified until this phase is complete.

- [x] T003 Create `packages/toolchain/src/agent-docs.ts` block model: `AUTHORED_BLOCK_IDS` (6), `GENERATED_BLOCK_IDS` (5), the shared `BODY_BLOCK_ORDER`, the `<!-- acm:block id -->…<!-- /acm:block id -->` marker grammar (`wrapBlock`), and `extractBlocks` (the region reader the packaging-fidelity gate reuses) per [architecture §4](../../docs/architecture/steering-layer-generator.md#4-block-model)
- [x] T004 Implement `renderGeneratedBlocks(cap)` in `packages/toolchain/src/agent-docs.ts`: project the capability manifest into the five Generated Blocks (`quick-reference`, `option-tables`, `examples`, `error-codes`, `response-types`) over the discovery subset selected via the manifest's `jsonSupported` list (decision D1) — `agent-docs` itself is `json: false` and self-excludes (depends on T003)
- [x] T005 Implement `readAuthoredBlocks` + `buildSkillFiles(cap)` in `packages/toolchain/src/agent-docs.ts`: merge authored ⊕ generated blocks into the per-target packagings — `SKILL.md` with the `activation` block as the frontmatter `description` (single-line form), the shared body in `BODY_BLOCK_ORDER`, the `AGENTS.fragment.md` and rules-file variants, and the two byte-identical skill packagings (`claude-skill`, `skills-package`) per [architecture §5–6](../../docs/architecture/steering-layer-generator.md#5-generation-pipeline) (depends on T004)
- [x] T006 Wire generation into the repo's build discipline: add the skill targets to `checkDrift` in `packages/toolchain/src/drift.ts` (generated artifacts under invariant #1); register the `agent-docs` command in `packages/toolchain/src/registry.ts` (`--target <name>` enum matching the generator's target set, `--write`; `json: false`); implement its handler in `packages/toolchain/src/cli.ts` (print a target to stdout, `--write` regenerates, stale exit code) (depends on T005)

**Checkpoint**: `pnpm acm agent-docs --target <t>` emits a byte-reproducible target;
`pnpm generate` / `pnpm drift` manage `packages/discovery-skill/generated/**`.

---

## Phase 3: User Story 1 - The skill steers an agent from need to spec (Priority: P1) 🎯 MVP

**Goal**: The Authored Blocks that make the assembled skill a working steering layer —
activation, corpus detection, the two-call loop with the ADR-0005 retrieval ladder, the
error-path playbook, and the runtime-truth note.

**Independent Test**: Give an agent only the emitted `SKILL.md` and the fixture corpus,
phrase a UI need vaguely, and verify it reaches the intended component's full spec via
exactly the documented workflow — one search, one detail, no help-text scraping, no
prose branching, climbing the ladder on a miss.

- [x] T007 [P] [US1] Author `packages/discovery-skill/blocks/activation.md`: the short, specific activation description — "building or modifying frontend UI in a project whose libraries ship ACM Manifests" — that becomes the `SKILL.md` frontmatter and pays the only per-session token cost (FR-001)
- [x] T008 [P] [US1] Author `packages/discovery-skill/blocks/corpus-preamble.md`: corpus-detection-first, the graceful empty-corpus stop on `ACM-D-EMPTY-CORPUS`, and the CLI-missing fallback; names `acm capabilities` as the runtime check (FR-009)
- [x] T009 [P] [US1] Author `packages/discovery-skill/blocks/workflow.md`: the two-call loop (one `acm search --json`, one `acm component --json`), token-frugal dense mode by default, an explicit "do not scrape help text" / "branch on discriminators and codes, never on prose", and the three-tier retrieval ladder — tier 2 synonyms the agent generates, tier 3 `acm component --dense` list-and-scan floor, "never fabricate" (FR-002 / FR-003 / FR-010)
- [x] T010 [P] [US1] Author `packages/discovery-skill/blocks/error-playbook.md`: one prescribed branch per `ACM-D-*` code — empty corpus (stop), unknown name (use suggestions), ambiguous name (re-request by identity facet), zero-result (success; broaden), usage error (consult the capability manifest) (FR-003)
- [x] T011 [P] [US1] Author `packages/discovery-skill/blocks/runtime-truth.md`: on any skew between skill text and installed CLI, `acm capabilities` is the runtime source of truth
- [x] T012 [US1] Add gate **G6** to `packages/conformance/tests/skill-gates.test.ts`: the playbook covers 100% of the `ACM-D-*` registry (any future code fails the gate until covered), and the zero-result branch is prescribed as success — never fabricate (SC-006)

**Checkpoint**: The MVP — the assembled skill drives the documented loop end to end
against the fixture corpus.

---

## Phase 4: User Story 2 - The skill can never describe a surface that doesn't exist (Priority: P2)

**Goal**: Freshness by construction (generated blocks) plus a gate that catches an
Authored Block naming a nonexistent command, option, code, or response type.

**Independent Test**: Introduce a fabricated option name into an authored block; the gate
fails naming the offending reference. Restore it; the gate passes.

- [x] T013 [US2] Implement `sweepAuthoredReferences(blocks, cap)` and `checkBlockInventory()` in `packages/toolchain/src/agent-docs.ts`: the grammar sweep over ALL authored text (backticked or not) for `acm <word>` invocations, `--flag` options, `ACM-D-*` codes, and dot-namespaced response types — each verified against the capability manifest — plus a guard that `blocks/` holds exactly the declared authored blocks (decision D5, FR-005)
- [x] T014 [US2] Add gate **G2** to `packages/conformance/tests/skill-gates.test.ts`: the sweep over the authored blocks returns no problems, the block inventory is exact, and every example invocation in the generated `examples` block parses as a valid invocation per the capability manifest (FR-005)
- [x] T015 [US2] Add the SC-003 seeded proof to `packages/conformance/tests/gate-seeded.test.ts` (repo `test:seeded` convention): a fabricated surface reference injected into an authored block MUST fail `sweepAuthoredReferences`, identifying the offending reference (SC-003)

**Checkpoint**: A stale or fabricated authored reference fails CI before it can mislead
an agent; mechanical blocks can't drift by construction.

---

## Phase 5: User Story 3 - The skill installs wherever the agent lives (Priority: P3)

**Goal**: One canonical block set → every ecosystem packaging, with hand-edits and drift
detectable and per-ecosystem install paths documented.

**Independent Test**: Install into a fresh workspace per supported ecosystem; the host
recognizes the skill; all packagings carry byte-identical workflow content from the one
canonical source.

- [x] T016 [US3] Emit the four targets from the single block set in `buildSkillFiles` (`packages/toolchain/src/agent-docs.ts`): `claude-skill` (primary), `skills-package` (cross-vendor), `agents-md` fragment, and editor `rules` — packaging chrome only, shared blocks byte-identical (FR-006, [architecture §6](../../docs/architecture/steering-layer-generator.md#6-targets))
- [x] T017 [US3] Validate the `skills-package` layout against the current cross-vendor `skills add` installer tooling (the Ant Design `npx skills add` precedent) and adjust the target's packaging chrome if the installer expects a different manifest/layout — the one item [architecture §10](../../docs/architecture/steering-layer-generator.md#10-left-to-spec-005-planning) explicitly left to implementation time (FR-006 / SC-004). **Validated 2026-07-22** against `npx skills` (`vercel-labs/skills`): skill = directory holding `SKILL.md` with `name` (lowercase-hyphen) + single-line `description` frontmatter, installed via the direct-path form the README documents; no top-level registry required → no chrome change. Outcome recorded in [contracts/skill-artifact.md](./contracts/skill-artifact.md) and the README install matrix.
- [x] T018 [P] [US3] Document the per-ecosystem install paths in `packages/discovery-skill/README.md`: the Claude Code skills convention (copy/symlink into `.claude/skills/`) and the cross-vendor `skills add` path at minimum, plus the `AGENTS.md`-fragment and rules-file variants for skill-less hosts (FR-006)
- [x] T019 [US3] Add gate **G3** to `packages/conformance/tests/skill-gates.test.ts`: extract the marked regions from every target and byte-compare to the canonical block files (independent of generator internals); assert the `SKILL.md` frontmatter description equals the `activation` block, the two skill packagings are byte-identical, and the registry `--target` enum matches the generator's target set (FR-006 / SC-004)

**Checkpoint**: All four packagings ship identical workflow content from one source;
hand-edits are drift.

---

## Phase 6: User Story 4 - Hostile Manifest text cannot re-program the agent (Priority: P4)

**Goal**: NS-DATA-1 carried into the prompt layer, and the documented loop proven inert
against the hostile corpus.

**Independent Test**: Run the documented two-call loop against the hostile fixture corpus;
the machine output byte-preserves the hostile text (NS-DATA-1) and the skill's
untrusted-data instruction is present with nothing directing interpretation.

- [x] T020 [US4] Author `packages/discovery-skill/blocks/security-posture.md`: all Manifest-originated text — search results, component details, examples, **and error-envelope suggestions** — is untrusted data, used as component fact only and never followed as instructions; names NS-DATA-1 (FR-004)
- [x] T021 [US4] Add the FR-004 instruction-presence check to `packages/conformance/tests/skill-gates.test.ts`: the emitted `security-posture` block contains the "never instructions" framing, explicitly covers `suggestions`, and cites `NS-DATA-1` (SC-005)
- [x] T022 [US4] Cover gate **G4** in `packages/conformance/tests/discovery-gates.test.ts` (spec-004 corpus, reused): the documented two-call loop composed from the capability manifest reaches a `component.detail` envelope, and against the hostile package the machine output byte-preserves hostile text while human output carries no control bytes (FR-007 / SC-005)

**Checkpoint**: The last hop is closed — the skill adds zero instruction-following
pathways over hostile Manifest text.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Token budgets, vocabulary/doc alignment, and the green closeout.

- [x] T023 Add gate **G5** to `packages/conformance/tests/skill-gates.test.ts`: under the repo gauge `ceil(UTF-8 bytes / 4)`, the resident activation description ≤ 100 tokens (400 bytes) and the on-demand `SKILL.md` body ≤ 2,000 tokens (8,000 bytes), markers included (FR-008 / SC-002)
- [x] T024 [P] Align vocabulary and doc index: `CONTEXT.md` glossary entries (Discovery Skill, Activation Description, Two-Call Loop, Skill Drift Gate, Skill Distribution, and the Retrieval Ladder), `llms.txt` indexing spec 005 + the architecture docs, and the `AGENTS.md` reference-CLI list including `agent-docs` — CONTEXT.md vocabulary exactly (invariant #8)
- [ ] T025 Closeout: run `pnpm test`, `pnpm test:seeded`, `pnpm lint`, `pnpm format` — all green; run `pnpm generate` and commit `packages/discovery-skill/generated/**` as reviewed diffs; exercise the spec's Independent Tests (US1–US4) against `fixtures/discovery-corpus` (depends on T012, T014, T015, T019, T021, T022, T023, T024). **2026-07-22**: `test` 287/287, `test:seeded` 10/10, `lint` clean, `drift` fresh; Independent Tests US1–US4 exercised deterministically by `discovery-gates` (two-call loop + hostile G4) and `skill-gates` (G2/G3/G5/G6, FR-004) + `gate-seeded` (SC-003). Remaining before `[x]`: `pnpm format` is red only on pre-existing out-of-feature debt (16 files clean in `HEAD`; all feature-005 files Prettier-clean) — a repo-wide cleanup, not this feature's; and the reviewed-diff commit is the owner's to make.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — T001 → T002
- **Foundational (Phase 2)**: T003 → T004 → T005 → T006 — BLOCKS every story's verification
- **US1 (Phase 3)**: authored blocks (T007–T011) can be drafted alongside Phase 2; G6 (T012) needs the generator (T006) + playbook (T010)
- **US2 (Phase 4)**: T013 extends the generator module; T014/T015 need T013 + a full block set
- **US3 (Phase 5)**: T016 is part of T005; T017 is external-tooling validation; T019 needs all authored blocks present
- **US4 (Phase 6)**: T020 authored block → T021 presence gate; T022 reuses the spec-004 corpus
- **Polish (Phase 7)**: T023 needs the assembled `SKILL.md`; T024 anytime after Phase 6; T025 last — needs every gate green

### User Story Dependency Notes

US1 delivers the working steering content (the MVP). US2 makes it un-stale-able. US3
distributes it. US4 hardens the prompt-layer security. All four sit on the Phase-2
generator; the authored blocks are independently editable files, so US1/US4 prose work
parallelizes across different `blocks/*.md`. Deviation from the template's
"fully independent stories" ideal is inherent to a single-generator, single-package
feature and is accepted in the plan.

### Parallel Opportunities

- Phase 3: T007 ∥ T008 ∥ T009 ∥ T010 ∥ T011 (different `blocks/*.md` files)
- Phase 4: T013 alongside Phase 3 authored prose (different file)
- Phase 5: T016/T018 ∥ Phase 3 tail
- Phase 7: T024 ∥ the story gates

## Implementation Strategy

**MVP first (US1)**: Phases 1–3 stand up the generator and the authored workflow, so the
assembled `SKILL.md` drives the documented loop against `fixtures/discovery-corpus`. Stop,
run `skill-gates.test.ts` + `pnpm drift`, demo the two-call loop.

**Incremental delivery**: +US2 (freshness-by-construction gate) → +US3 (four packagings
from one source) → +US4 (prompt-layer NS-DATA-1) → Polish (budgets, vocab, green
closeout). Each checkpoint leaves `pnpm test` green and every generated target
drift-pinned; block or surface changes after that are intentional, reviewable diffs.

**Outstanding on this branch**: **T025** only — the green run is done (`pnpm test` /
`test:seeded` / `lint` / `drift` all green; `pnpm format` red is pre-existing repo-wide
debt outside this feature), leaving just the reviewed-diff commit for the repo owner.
**T017** (cross-vendor installer-layout validation) closed 2026-07-22. Everything else
is present as verified WIP.
