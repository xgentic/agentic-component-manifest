# Research: Doc-Comment Semantics & Examples Extraction

Phase 0 decisions. Each resolves an unknown from the Technical Context; format is Decision / Rationale / Alternatives.

## R-01 — Semantic tag grammar (`@acmSemantic`)

**Decision**: A single tag `@acmSemantic <term> - <notes>`. Everything before the first ` - ` is the term; the remainder (optional) is verbatim notes. This reuses `splitDescription()` in [`jsdoc.ts`](../../packages/analyzer/src/jsdoc.ts) — the exact head/`-`/description split already applied to `@fires`/`@slot`/`@cssprop`/`@csspart`. Tag name matching is case-insensitive (`tagsOf()` already lowercases), so `@acmSemantic`/`@acmsemantic` both match.

**Rationale**: Consistency with the analyzer's existing CEM-tag vocabulary is worth more than novelty; authors already know the `head - description` shape. The `acm` prefix marks it as ACM-specific Tier-2 (not a renamed CEM concept, Principle VIII) and avoids collision with generic tooling.

**Alternatives considered**:
- `@semantic` (unprefixed) — rejected: collision-prone, doesn't signal ACM ownership.
- `@acmRole term` + a separate notes tag — rejected: two tags for one classification; splits notes off unnecessarily.
- Block-tag with `{term}` brace syntax like `@cssprop {syntax}` — rejected: the term is a single controlled token, not a type; the `head - notes` form is simpler.

## R-02 — Controlled-vocabulary source & term validation

**Decision**: Validate the term against `acmSchema.$defs.semanticClassification.term.enum` — the schema's own enum (45 terms) — imported via `acmSchema` from `@xgentic/acm` (already an analyzer dependency). A term not in the enum is rejected at extraction with a diagnostic; it never reaches the draft.

**Rationale**: Single source of truth (Principle I) — the schema already generates its `term` enum from `packages/spec/data/vocabulary.json`, so reading the enum avoids a parallel term list that could drift. Rejecting at extraction (not at emit) is essential: the schema enum would otherwise reject an out-of-vocabulary term during `validateManifest`, **aborting the whole manifest** — but semantics is optional, so the correct behavior is drop-with-diagnostic, keeping the manifest valid (spec FR-002, FR-008).

**Alternatives considered**:
- Read `vocabulary.json` from `@xgentic/acm-spec` directly — rejected: `@xgentic/acm-spec` has no `exports` map and the schema enum is the already-derived authority.
- Let the emit validator reject bad terms — rejected: that aborts the entire manifest for one optional bad annotation (violates FR-008's "drop the offending optional item, never abort").

## R-03 — Example tag parsing (`@example`)

**Decision**: Recognize the standard `@example` tag. One `examples[]` entry per `@example` block, in source order. Parsing:
- **Title**: if the block's first line is plain prose (not code, not a fence), it becomes `title`; the remaining lines are `source`. Otherwise no title and the whole body is `source`.
- **Language (`lang`)**: from a fenced code block's info string when present (```` ```html ```` → `html`, ```` ```tsx ```` → `tsx`, ```` ```ts ````/```` ```js ```` → `ts`); otherwise default `ts`. A fence with an unsupported language → the example is diagnosed and dropped. Fences are stripped from the emitted `source` (verbatim inner code only).
- Source is captured as a verbatim `Span` over the code region.

**Rationale**: `@example` is the established JSDoc/TSDoc convention (Principle VIII — reuse, don't invent), so existing documentation is picked up without rewriting. The first-line-caption convention matches how TSDoc renders `@example` captions. Defaulting to `ts` fits the analyzer's TypeScript-first corpus; a fence hint covers HTML usage snippets and JSX.

**Alternatives considered**:
- Bespoke `@acmExample` tag — rejected: gratuitous divergence from `@example`.
- Infer `lang` from content heuristics (does it contain JSX?) — rejected: non-deterministic-feeling and surprising; an explicit fence is unambiguous.
- Keep the fence markers in `source` — rejected: `source` must be compilable code (R-04), and fence markers are not code.

## R-04 — Example compile-verification sandbox (the hard problem)

**Decision**: Verify each extracted example with **one `ts.Program` per analysis run** built over an **in-memory `CompilerHost`** that overlays the already-parsed source `SourceFile`s plus one **synthetic example module per example**. Each synthetic module is `import <component> from '<relative path to its module>'; <example source>`, type-checked with the checker; the example is kept in core **iff** its synthetic file has zero syntactic + semantic diagnostics. Compiler options are **hermetic and pinned** (`target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, a fixed `lib: [ES2022, DOM, DOM.Iterable]`, `strict: true`, `noEmit: true`, `skipLibCheck: true`), and **external `node_modules` are not resolved** — only the analyzed source set + the pinned libs are visible.

**Rationale**:
- **Determinism (Principle V, SC-003)** is the governing constraint. Using the project's real `tsconfig` + installed `node_modules` would make pass/fail depend on the environment (dependency versions, TS lib), so the emitted `examples[]` could differ across machines. A pinned, hermetic configuration makes the gate a pure function of the analyzed sources.
- **One program per run** (not per example) keeps the added cost to a single construction + checker pass, protecting SC-006; synthetic files are cheap and share the component `SourceFile`s.
- **Scoping diagnostics to the synthetic file** means a broken example fails only itself; other examples and the manifest are unaffected (spec US2 scenario 5, FR-008).
- Compilation happens only in this **producer-side** sandbox (Principle X — never in a consumer).

**Consequences / documented constraint**: an example that imports an external package the analyzed source set doesn't include will fail the gate. Examples are therefore expected to be expressible against the component + standard DOM/JS globals (the common case for a usage snippet). This is a deliberate, documented limitation, not a silent gap; the diagnostic names the unresolved symbol.

**Alternatives considered**:
- **Extract-only, defer compilation to producer CI** (the originally-recommended smaller scope) — rejected by user decision: examples must be *known-working* in the manifest, which requires the analyzer to verify.
- **Use the project's real `tsconfig`/`node_modules`** — rejected: non-hermetic, breaks determinism (SC-003) and the analyzer's no-external-resolution stance; a richer opt-in mode is a possible **future** feature, explicitly deferred.
- **One `ts.Program` per example** — rejected: O(examples) program construction blows the perf budget.
- **`ts.transpileModule` (syntax-only transpile)** — rejected: transpile does not type-check, so it cannot prove the example actually uses the component's API correctly (it would pass wrong-property examples).

## R-05 — Where verification runs, and how non-compiling examples are pruned

**Decision**: A new **core post-analyze pass** `verifyExamples(moduleContexts, cwd)` in [`examples-verify.ts`](../../packages/analyzer/src/examples-verify.ts), invoked from [`run.ts`](../../packages/analyzer/src/run.ts) **after `runEngine` and before `emit`** (so both one-shot and watch cycles get it). It reads each entry draft's pending examples, runs the R-04 gate, drops non-compiling ones, and pushes `ACM-A-EXCOMPILE` diagnostics. Pruning uses an internal draft method (`EntryDraftImpl`), not the public plugin API — verification is a core integrity gate, not a plugin concern.

**Rationale**: This mirrors how `emit.ts` runs the reference validator as a core, framework-blind gate — verification is the same kind of "core integrity" step, not extraction. Placing it in `run.ts` (the shared single-run core) rather than in `cli.ts` guarantees watch cycles verify too. Doing it before `emit` keeps the "never emit unverified core content" invariant.

**Alternatives considered**:
- A built-in plugin's `packageLink` — rejected: verification isn't framework participation, and plugins get the read-only `ManifestDraft` view (can't prune examples). Keeping it in core also keeps it un-skippable.
- Verify inside `emit.ts` — rejected: `emit` is validate+canonicalize+write; a compiler pass there overloads its single responsibility and couples the toolchain-facing emit to the TS compiler.

## R-06 — Where extraction is wired (framework-blind, spec FR-010)

**Decision**: Add `applyDocMetadata(entry, node, module, ctx)` to [`frameworks/shared.ts`](../../packages/analyzer/src/frameworks/shared.ts) (parsing via new `jsdoc.ts` helpers), and call it once from each framework's per-declaration extraction (`vanilla`/`lit`/`angular`/`react`), exactly where they already call `description()` / `cemTags()`.

**Rationale**: The four frameworks already funnel declaration-level doc-comment work through `shared.ts` helpers; adding one shared function called from each keeps extraction in the shared doc-comment layer (identical output per framework, FR-010) with minimal, uniform edits. The engine can't apply it generically because entries don't retain the `ts.Node` that produced them (plugins own entry creation), so a shared helper at the framework call-site is the pragmatic seam.

**Alternatives considered**:
- Engine-level post-pass over every entry — rejected: entries don't carry their source node; would require a new node↔entry back-reference across the plugin boundary.
- Duplicate the parsing in each framework — rejected: four copies drift; violates the single shared-layer intent.

## R-07 — Diagnostic code registry (`ACM-A-*`)

**Decision**: Add to the `ACM-A-*` family in [`diagnostics.ts`](../../packages/analyzer/src/diagnostics.ts):
- `ACM-A-SEMTERM` — semantic term missing or not in the controlled vocabulary (severity: warning; field dropped).
- `ACM-A-SEMDUP` — more than one `@acmSemantic` on a declaration; first wins, extras diagnosed (warning).
- `ACM-A-EXLANG` — `@example` fence declares an unsupported language (warning; example dropped).
- `ACM-A-EXEMPTY` — `@example` block has no code body (warning; example dropped).
- `ACM-A-EXCOMPILE` — example failed to compile against the component (warning; example dropped, message names file + first TS error).
- `ACM-A-EXLIMIT` — an example/notes value exceeds a structural limit, or > 32 examples (warning; offending item dropped so the manifest stays inside limits).

**Rationale**: These are all **non-fatal** — semantics/examples are optional, so a bad annotation degrades to "absent + diagnostic" (severity `warning`, exit 3), never a failed build (spec US3, FR-009). Naming the file + problem lets the author fix it. The existing exit-status mapping (0 · 3 warnings · 1 failure · 2 usage) already renders these correctly.

**Alternatives considered**:
- Make invalid annotations fatal (exit 1) — rejected: a mistyped optional tag should not fail the whole build (FR-008 / assumption "optional by construction").
- One catch-all code — rejected: the registry values precise, greppable rule ids (consistent with the existing `ACM-A-*` set).

## R-08 — Provenance & attribution

**Decision**: `setSemantics` records provenance path `/semantics`; `addExample` records `/examples/<n>` (mirroring the existing `record()` calls for inputs/events). This keeps the emit-time attribution map (`buildProvenance`) correct if a semantics/examples value ever trips the reference validator.

**Rationale**: The emit validator is the backstop (Principle I). If, despite extraction-time checks, a value reaches emit and violates the schema, the failure must attribute to the contributing framework plugin — the existing provenance machinery already does this for every other member; semantics/examples must participate identically.

**Alternatives considered**: none — this is required for consistency with the existing attribution guarantee (T042).
