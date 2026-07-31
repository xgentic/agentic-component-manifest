# Data Model: ACM Analyzer CLI

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

The emitted **Manifest** itself is defined by `packages/spec/schema/acm.schema.json`
and is *not* redefined here (FR: this feature produces it, never reshapes it). The
entities below are the analyzer's own runtime and fixture model.

## AnalyzerSettings (resolved configuration)

The merge result of CLI flags > settings file > defaults ([R-09](./research.md#r-09--settings-file--option-set)).

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `globs` | `string[]` | `['src/**/*.{js,ts,jsx,tsx}']` | non-empty strings; plugin `fileExtensions` may extend defaults only (never user values) |
| `exclude` | `string[]` | `[]` | — |
| `outdir` | `string` | `'.'` | manifest filename is always `agentic-component-manifest.json` (discovery convention); directory created if absent |
| `frameworks` | `string[]` | `[]` (vanilla) | each a built-in name (`vanilla`, `lit`, `stencil`, `angular`, `react`); repeatable/comma-separated on the CLI, one-or-many in the settings file (`framework` singular is an alias; both keys set → fatal); duplicates collapse to the first occurrence; plugins run in the order given; unknown → fatal error listing supported values (FR-004) |
| `dev` | `boolean` | `false` | verbose run trace to stderr (discovery, parse counts, plugin pipeline, framework import census, per-plugin yield, summary); observation never alters output |
| `quiet` | `boolean` | `false` | suppress progress, keep errors; `dev` and `quiet` mutually exclusive → usage error |
| `watch` | `boolean` | `false` | — |
| `plugins` | `AnalyzerPlugin[]` | `[]` | settings-file only (functions can't cross the CLI boundary); each entry must satisfy the plugin interface shape or fatal config error |
| `config` | `string \| undefined` | auto-discover `acm-analyzer.config.{js,mjs}` | CLI-only flag; missing explicit path → fatal; malformed file → fatal naming file (never silent fallback) |

**State**: constructed once per invocation; immutable afterwards (watch cycles reuse it).

## AnalyzerPlugin (public interface)

One plugin = one framework's (or one enrichment concern's) participation in analysis
([R-03](./research.md#r-03--plugin-architecture-one-public-interface-four-cem-descended-phases)). Built-ins and external plugins are indistinguishable to the core.

| Field | Type | Notes |
|-------|------|-------|
| `name` | `string` | required, unique per session; diagnostics are attributed to it |
| `fileExtensions` | `string[]?` | extra default-glob extensions (e.g. Vue adds `.vue`) |
| `preprocess` | `(file) => SourceText?` | optional container-format unwrap (Vue SFC → script text); must be pure |
| `collect` | `(module, ctx) => void?` | per-module pre-pass: gather cross-declaration facts |
| `analyze` | `(node, module, ctx) => void?` | per-declaration extraction into the working entry |
| `moduleLink` | `(module, ctx) => void?` | per-module post-pass (exports, re-export dedup) |
| `packageLink` | `(manifest, ctx) => void?` | whole-manifest post-pass; last chance to contribute |

**Contribution rules** (enforced by the emit gate, not trust): Tier 1 data only into
core fields; anything else under `x-*`; contributions that make the manifest invalid
abort emission (FR-011, US4 scenario 4). Plugin execution order: framework plugin
first, then user `plugins` in array order — deterministic.

## AnalysisSession

One run of the engine (one-shot, or one watch cycle).

| Field | Type | Notes |
|-------|------|-------|
| `settings` | `AnalyzerSettings` | immutable |
| `plugins` | `AnalyzerPlugin[]` | resolved framework plugin + user plugins |
| `modules` | `SourceModule[]` | lexicographically sorted by path (determinism) |
| `diagnostics` | `Diagnostic[]` | accumulated across phases |
| `result` | `ManifestDocument \| null` | `null` when no valid manifest could be produced |

**Transitions**: `discover → parse → collect → analyze → moduleLink → packageLink →
validate → canonicalize → write`. `discover` matching zero files → fatal diagnostic
(edge case: never a silent empty manifest). Per-file parse failure → diagnostic +
module skipped, session continues (FR-012). `validate` failure → no write, exit 1.

## SourceModule

| Field | Type | Notes |
|-------|------|-------|
| `path` | `string` | project-relative, POSIX separators (determinism across OS) |
| `text` | `string` | raw bytes as UTF-8; the source of all verbatim extraction |
| `ast` | `ts.SourceFile` | syntax-only ([R-01](./research.md#r-01--parse-layer-typescript-compiler-api-syntax-only)) |
| `container` | `'ts' \| 'sfc'` | SFC modules carry block offsets so diagnostics point into the original file |

## EntryDraft → manifest entry

Working representation a plugin fills during `analyze`; serialized into the schema's
declaration shape at `moduleLink`.

- **Identity facets**: exactly the applicable ones per framework — tag name
  (vanilla/Lit/Stencil), module + export (all), selector (Angular) — plus
  `paradigmClass`. One draft per implementation artifact; re-exports reference the
  original declaration, never duplicate it (edge case in spec).
- **Members**: inputs, events, slots, methods, cssProperties, cssParts — field names
  exactly as in the schema; source order preserved.
- **Descriptions**: verbatim doc-comment text or absent — the draft has no way to
  synthesize one (constructor takes only extracted spans; FR-008 by construction).
- **Types**: every typed node carries `{ structured, raw }` produced by TypeMapping;
  both-or-neither enforced at the draft API level.

## TypeMapping

Implementation of `docs/type-mapping.md` ([R-02](./research.md#r-02--structured-type-tier-documented-syntactic-mapping-rules)).

| Input (TS syntax) | Structured output |
|-------------------|-------------------|
| keyword types (`string`, `number`, `boolean`, `void`, …) | `{ kind: 'primitive' }` |
| literal types | `{ kind: 'literal', value }` |
| union / intersection | `{ kind: 'union' / 'intersection', members: […] }` |
| array / tuple | structural mapping per grammar |
| type reference (same file or named import) | `{ kind: 'reference', name, module? }` |
| anything past documented depth/complexity bound | grammar's opaque fallback + verbatim `raw` |

**Invariant**: `raw` is always the exact source slice; mapping is total (never
throws, worst case = opaque).

## Diagnostic

| Field | Type | Notes |
|-------|------|-------|
| `code` | `string` | `ACM-A-*` namespace (analyzer-owned; distinct from toolchain's validator codes) |
| `severity` | `'error' \| 'warning'` | errors block writing; warnings → exit 3 |
| `file` / `span` | `string` / `{line, col}?` | SFC-aware remapping to the original file |
| `message` | `string` | names file + problem (FR-012); rendered via toolchain `renderDiagnostics` |
| `plugin` | `string?` | attribution when raised by/about a plugin |

**Exit-status mapping** ([R-11](./research.md#r-11--emission-pipeline-and-exit-codes)): no diagnostics → 0; warnings only → 3; any error → 1; usage/config → 2.

## Fixture entities (conformance)

| Fixture | Contents | Gate |
|---------|----------|------|
| Witness retrofit ×4 (`witness/{lit,react,vue,angular}/src/`) | compiling source beside existing `agentic-component-manifest.json` | analyze(src) byte-equals golden (FR-013) |
| Analyzer goldens (`analyzer/{vanilla,stencil}/`) | `src/` + `agentic-component-manifest.json` | byte-match (FR-013 extension for frameworks without a witness slot) |
| Stress testbed (`testbed/{lit,angular}/`) | maximally complex compiling source + `agentic-component-manifest.json` + `acm.view.yml` | byte-match + [testbed-inventory](./contracts/testbed-inventory.md) walk (FR-014, SC-008) |
| Seeded failures | in-test mutations (invalid plugin output, invented member, canonical drift) | each is caught (Principle IX) |
