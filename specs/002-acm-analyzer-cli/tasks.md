---
description: "Task list for ACM Analyzer CLI implementation"
---

# Tasks: ACM Analyzer CLI

**Input**: Design documents from `/specs/002-acm-analyzer-cli/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: The FR-013 witness-reproduction, FR-014 stress-testbed, and seeded-failure
**conformance gates are mandated deliverables** (FR-013, FR-014, SC-002, SC-008 + Principle IX)
— they are required tasks, not the optional test layer. Per-module unit tests are the OPTIONAL
layer and are marked as such (they may be skipped without failing the spec).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Every task includes an exact file path

## Path Conventions

- New package: `packages/analyzer/` (src/, docs/, tests/) — `@acm/analyzer`, bin `acm-analyzer`
- Conformance fixtures & gates: `packages/conformance/fixtures/`, `packages/conformance/tests/`
- Shared toolchain (consumed, not modified except its `exports` map): `packages/toolchain/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the `packages/analyzer` package and wire it into the workspace.

- [X] T001 Create `packages/analyzer/package.json` (name `@acm/analyzer`, `private: true`, `type: "module"`, `bin: { "acm-analyzer": "./src/cli.ts" }` run via tsx, `engines.node >= 20`), plus `packages/analyzer/tsconfig.json` extending the repo config, and empty `src/`, `docs/`, `tests/` directories
- [X] T002 Add runtime dependencies to `packages/analyzer/package.json` (`typescript`, `@vue/compiler-sfc`, `tinyglobby`, `chokidar`) and workspace deps (`@acm/toolchain`, `@acm/spec`), then run `pnpm install` (depends on T001)
- [X] T003 [P] Add an `exports` map to `packages/toolchain/package.json` publishing the analyzer's integration surface (`validateManifest`, `canonicalize`, `checkCanonical`, `renderDiagnostics`, `Diagnostic`, `agentViewFromValue`/`agentViewFromText`) as the single public entry the analyzer imports
- [X] T004 [P] Add root `analyze` script to `package.json` (`"analyze": "tsx packages/analyzer/src/cli.ts analyze"`) and add `packages/analyzer` + new conformance globs to the CI workflow in `.github/workflows/ci.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The framework-blind contracts and infrastructure every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Define the public plugin interface and context types in `packages/analyzer/src/plugin.ts` per [contracts/plugin-api.md](./contracts/plugin-api.md): `AnalyzerPlugin` (`name`, `fileExtensions?`, `preprocess?`, `collect?`, `analyze?`, `moduleLink?`, `packageLink?`), `PreprocessResult`, `ModuleContext`, `SessionContext`, `ManifestDraft` — exported from the package's public entry (dogfooding seam for SC-005)
- [X] T006 [P] Define analyzer runtime model types in `packages/analyzer/src/types.ts` per [data-model.md](./data-model.md): `AnalyzerSettings` (globs/exclude/outdir/framework/dev/quiet/watch/plugins/config + defaults), `AnalysisSession`, `SourceModule` (path/text/ast/container)
- [X] T007 Implement `packages/analyzer/src/diagnostics.ts`: `ACM-A-*` `Diagnostic` model (code/severity/file/span/message/plugin), SFC-aware span carrier, and the exit-status mapping (0 success · 3 warnings-only · 1 failure · 2 usage/config) — rendered through the toolchain `renderDiagnostics`
- [X] T008 Implement the `EntryDraft` factory and `SessionContext`/`ModuleContext` factories in `packages/analyzer/src/context.ts`: entry factory requires `paradigmClass` + ≥1 identity facet and rejects merged cross-framework surfaces; description setters take verbatim **spans, not strings** (FR-008 by construction); rejects unnamespaced unknown keys (Tier-1-or-`x-*`); exposes `addDiagnostic()` and an injected `TypeMapping` service handle

**Checkpoint**: Plugin contract, runtime types, diagnostics, and the entry-creation seam exist — user stories can begin.

---

## Phase 3: User Story 1 - Analyze a project and produce a manifest (Priority: P1) 🎯 MVP

**Goal**: A single zero-config `analyze` command scans a vanilla web-component project and writes a valid, canonical, byte-stable `agentic-component-manifest.json`.

**Independent Test**: Run the analyze command on a small vanilla web-component project with zero configuration; the emitted manifest validates against the ACM schema, every derived field traces to source, and a second run yields a byte-identical file.

- [X] T009 [P] [US1] Write the documented structured-type mapping rules in `packages/analyzer/docs/type-mapping.md` (primitive/literal/union/intersection/array/tuple/reference + declared opaque fallback beyond the depth bound), per [research R-02](./research.md#r-02--structured-type-tier-documented-syntactic-mapping-rules) and the [data-model TypeMapping table](./data-model.md)
- [X] T010 [US1] Implement the `TypeMapping` service in `packages/analyzer/src/type-mapping.ts` executing `docs/type-mapping.md`: TS type node → `{ structured, raw }`; total (never throws); opaque fallback + verbatim `raw` beyond the depth bound; both-or-neither enforced (depends on T009)
- [X] T011 [P] [US1] Implement `packages/analyzer/src/jsdoc.ts`: verbatim doc-comment span extraction (absent when the source has none) and CEM tag parsing `@fires`/`@event`, `@slot`, `@cssprop`/`@cssproperty`, `@csspart`
- [X] T012 [US1] Implement source discovery + parse in `packages/analyzer/src/discover.ts`: `tinyglobby` include/exclude, lexicographic sort, POSIX-relative paths, `ts.createSourceFile` syntax-only (no program/checker); per-file parse error → diagnostic + skip; zero matches → fatal diagnostic (exit 1, never a silent empty manifest)
- [X] T013 [US1] Implement the framework-blind core engine in `packages/analyzer/src/analyzer.ts`: orchestrate `discover → parse → collect → analyze → moduleLink → packageLink`, drive resolved plugins in order, accumulate diagnostics into the `AnalysisSession` (depends on T005, T008, T012)
- [X] T014 [US1] Implement the emit pipeline in `packages/analyzer/src/emit.ts`: assemble `ManifestDraft` → `validateManifest` (toolchain) → `canonicalize` (toolchain) → atomic temp-file + rename write to `<outdir>/agentic-component-manifest.json`; abort the write with a diagnostic on any schema/limit violation (never truncate); create `outdir` if absent; empty-component list → valid manifest + notice (depends on T003, T008)
- [X] T015 [US1] Implement the default vanilla plugin in `packages/analyzer/src/frameworks/vanilla.ts` (consuming only the public plugin interface): `HTMLElement` subclasses, `customElements.define`, `observedAttributes`, public class members → inputs/methods, JSDoc tags → events/slots/cssProperties/cssParts; `tagName` + module/export identity facets, `paradigmClass: retained-dom` (depends on T005, T008, T010, T011)
- [X] T016 [US1] Implement the CLI entry in `packages/analyzer/src/cli.ts`: `node:util` `parseArgs`, `analyze` subcommand, `--globs`/`--exclude`/`--outdir` flags with defaults, single run wiring engine→emit, exit-code mapping, progress + diagnostics to stderr (stdout reserved) — framework fixed to vanilla at this stage (depends on T013, T014, T015)
- [X] T017 [P] [US1] Create the vanilla analyzer golden fixture `packages/conformance/fixtures/analyzer/vanilla/` (`src/` compiling web-component source + hand-verified `agentic-component-manifest.json`)
- [X] T018 [US1] Create `packages/conformance/tests/analyzer-witness.test.ts` with the vanilla case: analyze `fixtures/analyzer/vanilla/src` → byte-match `agentic-component-manifest.json`, re-run → byte-identical (SC-002), and assert schema-valid + canonical via toolchain (depends on T016, T017)
- [X] T019 [P] [US1] *(optional)* Unit tests for TypeMapping rules and JSDoc extraction in `packages/analyzer/tests/type-mapping.test.ts` and `packages/analyzer/tests/jsdoc.test.ts`

**Checkpoint**: The MVP works — `acm-analyzer analyze` produces a valid, deterministic manifest for vanilla web components with zero config.

---

## Phase 4: User Story 2 - Select a framework with one generic option (Priority: P2)

**Goal**: A single generic `framework` option selects a shipped plugin (Lit/Angular/React); each maps its authoring patterns onto universal ACM concepts.

**Independent Test**: Analyze one fixture per shipped framework passing only `framework`; each emits a valid manifest whose identity facets and API surface match that framework's expected shape; an unknown value fails listing the supported values.

> **Scope decisions recorded during implementation (2026-07-19):**
> - **Vue (T024, T028) is excluded** by explicit user decision. Shipped frameworks are **lit, stencil, angular, react** (`BUILTIN_FRAMEWORKS`); `undefined` → vanilla. The plugin seam still supports adding Vue later with zero core change.
> - **Stencil re-added (2026-07-30):** T021/T030 completed on request, plus a full FR-014 stress testbed (T035, `testbed/stencil`, inventory S1–S17) — a reviewed inventory change, not a silent one. Stencil is `retained-dom` (identity `tagName`), sharing Lit's coverage-matrix slot; no schema change ([research R-06](./research.md#r-06--stencil-extraction)).
> - **FR-013 reproduction targets the Tier-1 projection (research R-12a).** T026/T027/T029 author `witness/<fw>/src` that reproduces each witness `agentic-component-manifest.json` **with its Tier-2 `semantics`/`examples` stripped and re-canonicalized** — the witness goldens, their `acm.view.yml`/`acm.src.yml`, and `gate-coverage` are left untouched. `analyzer-witness.test.ts` computes the projection mechanically. Vanilla keeps its own `analyzer/vanilla` golden; an extra `analyzer/angular` golden covers the classic `@Input`/`@Output` decorator path (witness/angular exercises the signal path).
> - **Angular testbed A4 refinement:** `model()` two-way bindings are surfaced as a single input with `twoWay: true` (encoding both directions), **not** a synthetic `<name>Change` output — consistent with the authoritative `witness/angular` golden (FR-013) and avoiding invented event names (Principle IV).

- [X] T020 [P] [US2] Implement the Lit plugin in `packages/analyzer/src/frameworks/lit.ts`: `@customElement(tag)`, `@property({attribute,reflect,type,converter})` + `static properties`, initializers → `default`, static `dispatchEvent(new CustomEvent('name'))` detection, CEM JSDoc tags; `tagName` + module/export identity ([research R-04](./research.md#r-04--vanilla--lit-extraction)) — also surfaces `static formAssociated = true` as `x-wc.formAssociated` (testbed L17)
- [X] T021 [P] [US2] Implement the Stencil plugin in `packages/analyzer/src/frameworks/stencil.ts`: `@Component({tag})` classes, `@Prop()` → inputs (`reflect`/`attribute`; `mutable` via `x-stencil`), `@Event() EventEmitter<T>` → typed events (`eventName` alias), `@Method()` → methods (**opt-in**; plain public methods excluded), `@State`/`@Watch`/`@Listen`/`@Element` ignored, CEM JSDoc tags; `@Component({formAssociated})` → `x-wc.formAssociated`; `tagName` + module/export identity, `retained-dom` ([research R-06](./research.md#r-06--stencil-extraction))
- [X] T022 [P] [US2] Implement the Angular plugin in `packages/analyzer/src/frameworks/angular.ts`: `@Component` metadata (`selector`, `template`/`templateUrl`, `host`), `@Input`/`@Output`/`@HostBinding`, signal `input()`/`input.required()`/`output()`/`model()` (model → input with `twoWay: true`), `@ng-content` slots via CEM `@slot` JSDoc; `selector` + module/export identity; DI internals ignored ([research R-05](./research.md#r-05--angular-extraction))
- [X] T023 [P] [US2] Implement the React plugin in `packages/analyzer/src/frameworks/react.ts`: exported function components (+ `forwardRef`/`memo`), same-file props type (interface/alias/inline) → inputs (`?` → optional, destructuring defaults → `default`, callback/`on*` props stay inputs); module + export identity only, no tag/selector ([research R-07](./research.md#r-07--react-extraction))
- [~] T024 [P] [US2] ~~Implement the Vue plugin~~ **EXCLUDED by user decision** (see Phase 4 scope note)
- [X] T025 [US2] Implement framework resolution in `packages/analyzer/src/config.ts` (+ wire into `cli.ts`): `--framework`/`framework` value → bundled plugin (`lit`/`stencil`/`angular`/`react`), `undefined` → vanilla; unrecognized value → exit 2 with the supported-values list
- [X] T026 [P] [US2] Retrofit witness source `packages/conformance/fixtures/witness/lit/src/` so `analyze --framework lit` reproduces the Tier-1 projection of the existing `agentic-component-manifest.json` byte-for-byte (FR-013, R-12a)
- [X] T027 [P] [US2] Retrofit witness source `packages/conformance/fixtures/witness/react/src/` so `analyze --framework react` reproduces the Tier-1 projection of the existing `agentic-component-manifest.json` byte-for-byte (FR-013, R-12a)
- [~] T028 [P] [US2] ~~Retrofit witness source `witness/vue/src/`~~ **EXCLUDED** (Vue excluded by user decision)
- [X] T029 [P] [US2] Retrofit witness source `packages/conformance/fixtures/witness/angular/src/` so `analyze --framework angular` reproduces the Tier-1 projection of the existing `agentic-component-manifest.json` byte-for-byte (FR-013, R-12a)
- [X] T030 [P] [US2] Create the Stencil analyzer golden fixture `packages/conformance/fixtures/analyzer/stencil/` (`src/acme-button.tsx` + `events.ts`) so `analyze --framework stencil` reproduces its golden `agentic-component-manifest.json` byte-for-byte (FR-013, R-12)
- [X] T031 [US2] Extend `packages/conformance/tests/analyzer-witness.test.ts` to analyze each `witness/{lit,react,angular}/src` (Tier-1 projection) plus `analyzer/{vanilla,angular,stencil}` → byte-match its golden in the conformance harness (FR-013, SC-003)
- [X] T032 [P] [US2] Create the Lit stress testbed `packages/conformance/fixtures/testbed/lit/`: `src/acme-data-grid.ts` (+ `support.ts`) exercising every capability L1–L17 in [contracts/testbed-inventory.md](./contracts/testbed-inventory.md) + verified golden `agentic-component-manifest.json` + `acm.view.yml`
- [X] T033 [P] [US2] Create the Angular stress testbed `packages/conformance/fixtures/testbed/angular/`: `src/data-grid.component.ts` (+ `support.ts`, dev-time Angular type stubs under `types/`) covering A1–A12 + verified golden `agentic-component-manifest.json` + `acm.view.yml`
- [X] T034 [US2] Create `packages/conformance/tests/analyzer-testbed.test.ts`: byte-match both testbed goldens, walk every [testbed-inventory](./contracts/testbed-inventory.md) row (presence/shape/negative assertions), and verify `acm.view.yml` matches the toolchain agent-view emitter (FR-014, SC-008) (depends on T032, T033)
- [X] T035 [US2] Create the Stencil stress testbed `packages/conformance/fixtures/testbed/stencil/`: `src/acme-data-grid.tsx` (+ `support.ts`, dev-time Stencil type stubs under `types/`) covering S1–S17 + verified golden `agentic-component-manifest.json` + `acm.view.yml`; wire `analyzer-testbed.test.ts` `TESTBEDS` + `STENCIL_ROWS` (FR-014, SC-008; 2026-07-30 re-addition)

**Checkpoint**: All shipped frameworks analyze through one generic `framework` option; witness retrofit and stress testbed gates run in conformance.

---

## Phase 5: User Story 3 - Configure through a settings file with CLI override (Priority: P3)

**Goal**: A committed `acm-analyzer.config.{js,mjs}` drives analysis; CLI flags override it field-by-field; watch mode re-analyzes on change.

**Independent Test**: Commit a settings file with include/exclude, outdir, and framework; the bare command honors all of it; a conflicting CLI flag wins; watch regenerates on change and survives a parse error.

> **Implementation decisions recorded during Phase 5 (2026-07-20):**
> - **chokidar v4 dropped glob support**, so watch mode watches each include glob's
>   magic-free base directory (`globBase`) and lets `discover()` re-apply the real
>   include/exclude every cycle — correctness is independent of the watcher's path
>   precision. Our own output (`<outdir>/agentic-component-manifest.json` + temp files) and `node_modules`/`.git`
>   are ignored so a write never self-triggers.
> - **The reusable single-run core (`analyzeProject`) moved from `cli.ts` to `run.ts`** so
>   `watch.ts` can drive a run without a `cli ↔ watch` import cycle. `cli.ts` re-exports it;
>   the conformance harness now imports it from `run.js`.
> - **`dev`/`quiet` mutual exclusion is checked on the *merged* settings** (in
>   `resolveSettings`), so the conflict is caught whether it comes from two CLI flags or a
>   settings file that sets both — not only from the CLI.

- [X] T035 [US3] Implement settings-file loading in `packages/analyzer/src/config.ts`: auto-discover `acm-analyzer.config.{js,mjs}` at cwd or explicit `--config <path>`; native dynamic `import()` of the default export; reject unknown keys (fatal exit 2); malformed/throwing/non-object export → fatal exit 2 naming the file (never silent fallback); validate each `plugins[]` entry against the interface shape naming the offending index (extends the resolver from T025)
- [X] T036 [US3] Implement the merge + flag wiring in `packages/analyzer/src/config.ts` and `cli.ts`: precedence CLI > file > defaults, list options (`globs`/`exclude`) replaced not merged; add `--config`; `--dev`+`--quiet` mutual exclusion → exit 2; `--quiet` suppresses progress (errors still print), `--dev` verbose to stderr (depends on T035)
- [X] T037 [US3] Implement watch mode in `packages/analyzer/src/watch.ts` + wire `--watch` into `cli.ts`: `chokidar` over resolved globs, 100 ms debounce, re-run the session, atomic never-partial writes, per-file parse error → diagnostic and keep watching, single-file change reflected < 5 s (SC-007); process stays alive across per-cycle 1/3 (exit 2 precedes watching) (depends on T036)
- [X] T038 [P] [US3] *(optional)* Unit test config precedence + malformed-file-is-fatal in `packages/analyzer/tests/config.test.ts`
- [X] T039 [P] [US3] *(optional)* Integration test for the watch cycle (regenerate on change, survive a parse error) in `packages/analyzer/tests/watch.test.ts`

**Checkpoint**: Committed configuration with CLI override and watch mode all work; CEM-analyzer option parity (SC-006) is reachable from the command line and the file.

---

## Phase 6: User Story 4 - Extend the analyzer with custom plugins (Priority: P4)

**Goal**: External plugins participate in the lifecycle through the public interface — teaching a new framework or enriching output under `x-*` — with the core carrying no framework knowledge and invalid contributions rejected before any write.

**Independent Test**: Register a settings-file plugin adding a namespaced field to every entry (field appears, manifest still valid); implement a toy framework purely through the public interface (valid entries, zero core change); a plugin that would invalidate the manifest is rejected with a diagnostic and no file is written.

> **Implementation decisions recorded during Phase 6 (2026-07-20):**
>
> - **Registration + ordering (T040) already landed in Foundational/Phase 5.** `resolvePlugins` returns `[framework, ...settings.plugins]` (framework first, user plugins in array order); `asPlugins` (settings loader) validates each entry against the interface shape and is fatal (exit 2) naming the offending index. Phase 6 adds the proving gate in `analyzer-gates.test.ts` rather than new source.
> - **Attribution via per-contribution provenance (T042).** `EntryDraftImpl` records, for every contribution (`describe`/`add*`/`set` and the entry root), the plugin active at call time against an entry-relative JSON Pointer. `buildProvenance` (context.ts) prefixes these with the entry's output pointer; on a post-`packageLink` validation failure `emit.ts` attributes each diagnostic to the plugin by **longest-prefix pointer match** — so a bad member added by an enrichment plugin during `packageLink` is blamed on *it*, not on the entry's framework creator. Provenance is computed lazily only on the failure path; happy-path byte output is untouched.
> - **Draft-API x-* enforcement extended to member extensions (T041).** `addInput` now rejects unnamespaced keys in a member's `extensions` bag at the seam (was already enforced for `entry.set`); the reference validator remains the post-`packageLink` backstop.
> - **SC-005 fixture (T043).** `fixtures/analyzer/external-plugin/` ships a complete toy "Widget" framework (`toy-framework.ts`) importing the analyzer **only** through its public entry (`plugin.ts`, type-only) and doing all work via `ctx`; `src/badge.ts` + hand-verified `agentic-component-manifest.json` golden. The vanilla default pass is inert on its plain-function source, so `plugins: [toyWidgetPlugin()]` with `framework` unset yields exactly the toy's entries.

- [X] T040 [US4] Implement external plugin registration + ordering in `packages/analyzer/src/config.ts`/`analyzer.ts`: `plugins[]` resolved and run **after** the framework plugin in array order (deterministic); each validated against the interface shape (`name` + ≥1 hook), violation fatal naming the index (depends on T035)
- [X] T041 [US4] Enforce the `x-*` contribution rules end-to-end in `packages/analyzer/src/context.ts` + `emit.ts`: core fields accept only Tier-1 span-derived values, unnamespaced unknown keys rejected at the draft API, `x-*` accepts arbitrary JSON, with the reference validator as the post-`packageLink` backstop (depends on T008, T014)
- [X] T042 [US4] Implement invalid-contribution handling in `packages/analyzer/src/emit.ts`: a contribution that invalidates the manifest aborts emission with a diagnostic **attributed to the offending plugin** and writes no file (US4 scenario 4) (depends on T041)
- [X] T043 [P] [US4] SC-005 demonstration: implement a toy framework plugin importing **only** the public `@acm/analyzer` entry points, with a fixture under `packages/conformance/fixtures/analyzer/external-plugin/`, proving valid entries with zero analyzer-core changes
- [X] T044 [US4] Create `packages/conformance/tests/analyzer-gates.test.ts`: seeded-failure gates proving invalid plugin output is rejected, an invented member is detected, and canonical drift is detected (Principle IX), plus the SC-005 public-entry-only demonstration from T043 (depends on T042, T043)

**Checkpoint**: The plugin seam is a user-facing contract; framework agnosticism of the core is proven by an external framework built entirely on the public interface.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, performance, and CI wiring across all stories.

> **Implementation decisions recorded during Phase 7 (2026-07-20):**
> - **`pnpm drift` is wired into `pnpm test` as a conformance gate**
>   (`packages/conformance/tests/gate-drift.test.ts` calling `checkDrift(false)`), so a
>   local `pnpm test` catches stale generated artifacts without a separate command. The
>   analyzer conformance tests already run under `vitest run`; CI's `gate-analyzer` job now
>   runs `pnpm vitest run analyzer` (matching `pnpm test analyzer`: the 3 conformance suites
>   + the analyzer unit/bench tests) on both platforms, and `gate-drift` also runs the new
>   suite gate.
> - **The bench corpus is *generated*, not checked in.** `tests/bench/generate.ts` writes
>   N deterministic vanilla components into a temp dir; `perf.test.ts` times a full analysis
>   (< 30 s) and a watch single-file cycle (< 5 s). Real numbers are ~0.5 s / <1 cycle, so
>   the ceilings only trip on a genuine regression, never on slow CI. Avoids a hundred
>   near-identical source files in the tree (constitution III ethos).
> - **Quickstart invocation drift fixed (T049).** The analyzer discovers relative to
>   `process.cwd()` and has no path argument, and `pnpm <script>` runs with cwd = the
>   script's package — so the documented `pnpm analyze` idiom cannot reach a project
>   subdirectory (fixtures also carry their own `package.json`, shadowing the root script).
>   The quickstart now defines `acm-analyzer`/`acm` **shell functions** (`pnpm exec tsx …/cli.ts "$@"`)
>   that keep cwd on the project and word-split in both bash and zsh, reading exactly like
>   the future published bins. The framework list was corrected to `lit, angular, react`
>   (Stencil/Vue are an excluded, documented gap), and `pnpm test -- analyzer` → `pnpm test
>   analyzer` (pnpm v10 swallows the arg after `--`). Adding a CLI `--cwd`/path flag to make
>   `pnpm analyze -- <dir>` work from the repo root was considered and deferred as CLI-contract
>   scope creep, not Phase-7 polish.

- [X] T045 [P] Write `packages/analyzer/README.md` including the CEM-analyzer migration map (SC-006) from [contracts/config-file.md](./contracts/config-file.md)
- [X] T046 [P] Cross-link and finalize `packages/analyzer/docs/type-mapping.md`, confirming every rule is pinned by a golden fixture (Principle VI)
- [X] T047 Wire the analyzer conformance tests and `pnpm drift` into `pnpm test` and the two-platform CI matrix in `.github/workflows/ci.yml` (SC-002); confirm `pnpm test analyzer` is green
- [X] T048 [P] Add a performance spot-check: a 100-component bench fixture under `packages/analyzer/tests/bench/` asserting full analysis < 30 s and a watch single-file change reflected < 5 s (SC-007)
- [X] T049 Run the [quickstart.md](./quickstart.md) scenarios 1–4 end-to-end and confirm exit codes, byte-matches, and the no-manifest-on-invalid behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T002 depends on T001; T003/T004 are independent [P].
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phase 3–6)**: All depend on Foundational. US1 is the MVP; US2 builds on the US1 engine; US3 layers config/watch without changing analysis; US4 exposes the plugin seam foundational already provides.
- **Polish (Phase 7)**: Depends on the targeted user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Only Foundational. Independently testable via the vanilla golden fixture.
- **US2 (P2)**: Foundational + the US1 engine/emit/context (plugins plug into T013/T014). Independently testable per framework.
- **US3 (P3)**: Foundational + a working single-run CLI (US1). Does not change analysis behavior; independently testable via a settings fixture.
- **US4 (P4)**: Foundational (plugin interface + EntryDraft). Independently testable via an external-plugin fixture; does not require US2/US3.

### Notable Within-Story Dependencies

- US1: T009 → T010; {T005,T008,T012} → T013; {T003,T008} → T014; {T010,T011} → T015; {T013,T014,T015} → T016; {T016,T017} → T018.
- US2: each plugin (T020–T024) → its witness/testbed fixture (T026–T030, T032–T033) → the gate tests (T031, T034); resolution T025 after the plugins.
- US3: T035 → T036 → T037.
- US4: T035 → T040; {T008,T014} → T041 → T042; {T042,T043} → T044.

### Parallel Opportunities

- Setup: T003 and T004 in parallel.
- Foundational: T006 in parallel with T005/T007 authoring.
- US1: T009, T011, T017 in parallel; the optional T019 in parallel with anything.
- US2: **all five framework plugins T020–T024 in parallel** (distinct files); then all witness/testbed fixtures T026–T030, T032–T033 in parallel (each after its plugin).
- US3: optional tests T038/T039 in parallel.
- US4: T043 in parallel with T040–T042.
- Once Foundational is done, US1/US2/US3/US4 can be staffed in parallel by different developers (each independently testable).

---

## Parallel Example: User Story 2 framework plugins

```bash
# Launch all five framework plugins together (distinct files, no cross-deps):
Task: "Implement the Lit plugin in packages/analyzer/src/frameworks/lit.ts"
Task: "Implement the Stencil plugin in packages/analyzer/src/frameworks/stencil.ts"
Task: "Implement the Angular plugin in packages/analyzer/src/frameworks/angular.ts"
Task: "Implement the React plugin in packages/analyzer/src/frameworks/react.ts"
Task: "Implement the Vue plugin in packages/analyzer/src/frameworks/vue.ts"

# Then, each fixture after its plugin (still parallel across frameworks):
Task: "Retrofit witness source packages/conformance/fixtures/witness/lit/src/"
Task: "Create the Lit stress testbed packages/conformance/fixtures/testbed/lit/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: analyze the vanilla fixture, confirm schema-valid + byte-stable rerun.
5. Ship the MVP — the project's first Producer, one working framework, zero config.

### Incremental Delivery

1. Setup + Foundational → engine contracts ready.
2. US1 → vanilla analyze command (MVP) → validate → demo.
3. US2 → all five frameworks + witness/testbed gates → validate → demo.
4. US3 → settings file + CLI override + watch → validate → demo.
5. US4 → public plugin seam + external-framework proof → validate → demo.

### Parallel Team Strategy

After Foundational: Developer A owns US1→US2 engine/plugins, Developer B owns US3 config/watch, Developer C owns US4 plugin seam + gates. Stories integrate independently through the frozen Foundational contracts.
