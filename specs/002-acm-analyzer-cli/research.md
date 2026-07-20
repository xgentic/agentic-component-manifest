# Research: ACM Analyzer CLI

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-19

All Technical Context unknowns are resolved below. Format per decision: Decision /
Rationale / Alternatives considered.

## R-01 — Parse layer: TypeScript compiler API, syntax-only

- **Decision**: Parse every analyzed file with `ts.createSourceFile` (syntactic AST
  only). No `ts.Program`, no type checker, no `node_modules` resolution, no execution
  of analyzed code.
- **Rationale**: (a) Determinism — output depends only on the analyzed file bytes,
  never on installed dependency versions or checker inference changes across TS
  releases. (b) Speed — SC-007's 30 s / 100 components is trivial without a program.
  (c) Security — Principle X and Principle IV forbid executing analyzed code; a
  syntax-only parse cannot. (d) Precedent — the reference CEM analyzer works the same
  way, and ACM's raw type tier is defined as *verbatim source text*, which the syntax
  tree gives us exactly.
- **Alternatives considered**: Full `ts.Program` + checker (rejected: heavy, requires
  the analyzed project's dependencies to be installed, and inferred-type printing is
  not stable enough across TS versions to byte-pin); Babel (rejected: weaker TS type
  syntax fidelity); SWC/oxc (rejected: fast, but foreign ASTs make verbatim type-text
  extraction and JSDoc handling harder; can be revisited for performance later).

## R-02 — Structured type tier: documented syntactic mapping rules

- **Decision**: `packages/analyzer/docs/type-mapping.md` is the normative-for-tooling
  document defining how TS type syntax maps to the schema's structured type grammar:
  keyword primitives → `primitive`; literal types → `literal`; unions/intersections →
  `union`/`intersection` of mapped members; arrays/tuples mapped structurally;
  same-file and import-clause type references → `reference` (with `module` from the
  import specifier, package-relative); everything beyond a documented depth/complexity
  bound → the grammar's declared opaque fallback, always with verbatim `raw` text.
  Golden fixtures pin every rule.
- **Rationale**: Constitution VI says "best structured approximation" is defined by
  the reference analyzer's documented mapping rules — this feature creates that
  analyzer, so the rules document is a deliverable, not an afterthought. Both-or-
  neither (structured+raw) and opaque-fallback behavior are constitutional
  requirements.
- **Alternatives considered**: Checker-driven type expansion (rejected per R-01);
  unstructured raw-only emission (rejected: violates the layered type model).

## R-03 — Plugin architecture: one public interface, four CEM-descended phases

- **Decision**: Public plugin interface with the CEM analyzer's four lifecycle phases —
  `collect` (per-module pre-pass), `analyze` (per-declaration extraction),
  `moduleLink` (per-module post-pass), `packageLink` (whole-manifest post-pass) — plus
  an ACM-specific declared `name` and optional `fileExtensions` contribution. Every
  built-in framework, including vanilla, is a plugin consuming only this interface.
  The `framework` option resolves a built-in name (`lit`, `stencil`, `angular`,
  `react`, `vue`) to its bundled plugin; external frameworks load through the
  `plugins` array in the settings file (a future `framework: <package-specifier>`
  passthrough is left open, not built now).
- **Rationale**: Principle VIII forbids new names for shared concepts — CEM's phase
  vocabulary is the established precedent our target users already know. Dogfooding
  the public interface for built-ins is what makes SC-005 (external framework, zero
  core changes) true by construction rather than by promise.
- **Alternatives considered**: One package per framework plugin (rejected for now:
  publishing overhead before any external consumer exists; the public interface keeps
  the door open and the spec only requires *modularity*, not package granularity);
  a bespoke visitor-pattern API (rejected: gratuitous divergence from CEM).

## R-04 — Vanilla + Lit extraction

- **Decision**: Vanilla (default, no `framework` set): classes extending
  `HTMLElement`, `customElements.define` calls, `observedAttributes`,
  public class members; JSDoc tags `@fires`/`@event`, `@slot`, `@cssprop`/
  `@cssproperty`, `@csspart` (CEM tag vocabulary) feed events, slots, and CSS hooks.
  Lit plugin adds: `@customElement(tag)`, `@property({attribute, reflect, type,
  converter})` and `static properties`, default values from initializers,
  statically-evident `dispatchEvent(new CustomEvent('name'))` detection, tag-name +
  module/export identity facets.
- **Rationale**: Byte-for-byte reproduction of the existing Lit witness fixture
  requires exactly these sources of truth; CEM tag vocabulary is Principle VIII
  compliance.
- **Alternatives considered**: Runtime registration discovery (rejected: dynamic,
  violates static-only); template parsing for slots (rejected for v1: JSDoc `@slot`
  is the CEM-established Tier 1 channel; template scanning can arrive additively).

## R-05 — Angular extraction

- **Decision**: Syntactic analysis of `@Component` metadata (`selector`, `template`/
  `templateUrl`, `inputs`/`outputs` arrays, `host`), member decorators `@Input`/
  `@Output`/`@HostBinding`, and the signal APIs `input()`, `input.required()`,
  `output()`, `model()` (model → input + change output, the two-way pair). Slots =
  `<ng-content select="…">` occurrences, found by a minimal tag scan of the inline
  template or the referenced template file. Identity facets: selector + module/export.
  DI internals (constructor params, `inject()`) are not API surface and are ignored;
  public methods are.
- **Rationale**: Angular is the constitution's mandatory structural outlier; signal
  inputs and `model()` are today's idiomatic authoring style (spec assumption), and
  all of it is statically visible in syntax. A full `@angular/compiler` dependency is
  version-coupled and heavyweight for what is a handful of statically recognizable
  forms.
- **Alternatives considered**: `@angular/compiler` template AST (rejected: heavy,
  version drift risk; revisit if the tag scan proves insufficient); analyzing
  compiled Ivy metadata (rejected: build-output analysis breaks source verbatimness).

## R-06 — Stencil extraction

- **Decision**: `@Component({tag, shadow, styleUrl})`, `@Prop()` (→ inputs, with
  `reflect`/`mutable` options), `@Event() EventEmitter<T>` (→ events with typed
  payload), `@Method()` (→ methods), `@State()`/`@Watch()` ignored (internal), JSDoc
  tags as in R-04. Identity: tag name + module/export.
- **Rationale**: Stencil's decorator metadata is fully syntactic — the easiest of the
  five. Replaces CEM's `--stencil` switch under the generic `framework` option per
  the feature description.
- **Alternatives considered**: Reusing Stencil's own `docs-json` output (rejected:
  that is format conversion, out of scope by spec assumption, and it executes the
  Stencil toolchain).

## R-07 — React extraction

- **Decision**: Exported function components (including `forwardRef`/`memo`
  wrappers) with a props type resolvable *within the analyzed file* (interface, type
  alias, or inline literal): each prop → input (JSDoc description, `?` → optional,
  default from destructuring defaults). Callback props (including `on*`) remain
  inputs — React has no separate event channel, and inventing one would violate
  Tier 1 mechanical truth. Identity: module + export name only (no tag, no selector).
  Class components: public props type analyzed the same way; legacy patterns
  (propTypes) out of scope per spec assumption.
- **Rationale**: Same-file resolution keeps R-01's determinism; the witness React
  fixture's shape confirms inputs-only is the correct mechanical description.
- **Alternatives considered**: Cross-file type resolution via checker (rejected per
  R-01; the opaque fallback + raw text covers imported prop types honestly);
  react-docgen (rejected: divergent AST layer, and its inference rules are not ours
  to pin).

## R-08 — Vue extraction

- **Decision**: `@vue/compiler-sfc` `parse()` extracts SFC blocks (never executes
  them); `<script setup lang="ts">` content then goes through the same TS syntax
  parse. Extracted: `defineProps` (type-literal or object form) → inputs,
  `defineEmits` → events, `defineSlots` → slots, `defineExpose` → methods/public
  surface, `defineModel` → input + `update:` event pair. Plain `.ts` components using
  `defineComponent` get the object-literal form of the same mapping. Identity:
  module + export (SFC default export = component).
- **Rationale**: The SFC container format genuinely requires the official parser —
  hand-parsing SFC is where determinism goes to die; the macros are compile-time
  constructs designed for exactly this static reading.
- **Alternatives considered**: Regex block extraction (rejected: fragile, violates
  "real, compiling source" testbed ambitions); `vue-docgen-api` (rejected: brings its
  own inference rules we cannot pin as ours).

## R-09 — Settings file + option set

- **Decision**: `acm-analyzer.config.js` / `.mjs` at project root (explicit path via
  `--config`), loaded with native dynamic `import()`, default export object:
  `{ globs, exclude, outdir, framework, dev, quiet, watch, plugins }` — the CEM
  analyzer's option set with `framework` replacing `litelement`/`fast`/`stencil`/
  `catalyst`. Defaults: `globs: ['src/**/*.{js,ts,jsx,tsx}']` (+ `.vue` added by the
  Vue plugin's `fileExtensions`), `exclude: []`, `outdir: '.'` (manifest filename
  always `agentic-component-manifest.json` per the discovery convention), `framework: undefined` → vanilla,
  `dev/quiet/watch: false`, `plugins: []`. Precedence: CLI > settings file > defaults.
  Malformed or throwing settings file = fatal usage error naming the file (exit 2),
  never silent fallback.
- **Rationale**: FR-006 mandates CEM parity + precedence; executing the user's own
  config is the established CEM/ESLint/Vite trust model (it is the user's code, not
  analyzed input — Principle X governs *analyzed* sources and *manifests*, not the
  operator's own configuration).
- **Alternatives considered**: JSON/YAML config (rejected: cannot register plugin
  functions, breaks CEM parity); cosmiconfig-style multi-location search (rejected:
  more magic, no user demand); TS config files (deferred: needs a loader dep; `.mjs`
  covers v1).

## R-10 — CLI shape, glob and watch machinery

- **Decision**: Bin `acm-analyzer`, single subcommand `analyze` (CEM parity), flags
  `--config, --globs, --exclude, --outdir, --framework, --watch, --dev, --quiet`
  parsed with `node:util` `parseArgs`. File discovery via `tinyglobby` with results
  sorted lexicographically (deterministic module order). Watch via `chokidar`
  (100 ms debounce, re-analyze, atomic temp-file + rename write so no partial
  manifest is ever observable; per-file parse errors are diagnostics, the watcher
  keeps running).
- **Rationale**: `parseArgs` is stdlib (zero deps for the hot path); Node 20 lacks
  `fs.glob` (22+) and `fs.watch` recursive semantics differ per platform — tinyglobby
  and chokidar are the boring, proven choices.
- **Alternatives considered**: commander/yargs (rejected: dependency weight for eight
  flags); native `fs.watch` recursive (rejected: platform-inconsistent on Linux for
  the supported Node range).

## R-11 — Emission pipeline and exit codes

- **Decision**: Assemble manifest → `validateManifest` (toolchain) → canonical text
  via the reference canonicalizer → atomic write. Any schema/limit violation
  (including one introduced by a user plugin, and including a doc comment exceeding a
  per-field NS-LIMIT) aborts the write with a diagnostic — never truncate (truncation
  would forge Tier 1 verbatimness). Exit codes: `0` success; `3` completed with
  warnings (manifest written, non-fatal diagnostics); `1` failure (no valid manifest
  produced); `2` usage/config error. `--watch` stays alive across per-cycle failures.
- **Rationale**: FR-002/FR-012 and Principle V/X; code `3` for degraded-success
  follows the existing toolchain convention of reserving specific non-zero codes for
  non-fatal gate outcomes.
- **Alternatives considered**: Writing then warning (rejected: FR-002 forbids
  writing invalid output); truncating over-limit fields (rejected: Tier 1 violation).

## R-12 — Witness-source retrofit strategy (FR-013)

- **Decision**: Author `src/` for the four existing witness fixtures (lit, react,
  vue, angular) such that the analyzer reproduces the checked-in `agentic-component-manifest.json`
  byte-for-byte. The goldens are the fixed target; source is written to them. If a
  witness manifest turns out to be unproducible from real source (a hand-authoring
  artifact), the manifest is corrected in a reviewed, regenerate-and-diff commit —
  never silently. Stencil and vanilla (no paradigm-class witness slot of their own)
  get analyzer golden fixtures under `fixtures/analyzer/` with the same byte-match
  contract.
- **Rationale**: Spec 001 explicitly promised this retrofit ("later analyzer features
  will retrofit Tier 1 verification onto the same fixtures"); goldens-first keeps the
  coverage matrix stable.
- **Alternatives considered**: Regenerating all witness manifests from fresh source
  (rejected: churns the coverage matrix and Agent View goldens without need).

### R-12a — FR-013 reproduces the Tier-1 projection (decision, implementation phase)

- **Context discovered during implementation**: The four witness `agentic-component-manifest.json` files carry
  `semantics` and `examples`, which are `acmTier: authored-verifiable` (Tier 2). The
  analyzer is a **Tier-1-only** producer (plan Principle IV: "semantics/examples are
  never auto-derived"), so it cannot emit those two nodes. Worse, `gate-coverage`
  (feature 001) requires `semantics` **and** `examples` to be witnessed in **every**
  paradigm class, and each class has exactly one witness — so R-12's literal escape
  hatch (trim the golden) would break the coverage Prime Directive (Principle II/IX).
- **Decision**: FR-013 is satisfied against the **Tier-1 projection** of each witness —
  `analyze(witness/<fw>/src)` byte-matches `witness/<fw>/agentic-component-manifest.json` **with its Tier-2
  `semantics`/`examples` removed and re-canonicalized**. The witness goldens, their
  `acm.view.yml`, `acm.src.yml`, and `gate-coverage` are left **untouched**. The
  conformance gate (`analyzer-witness.test.ts`) computes the projection mechanically.
- **Rationale**: This is the least-invasive reading that (a) keeps the analyzer
  Tier-1-only as designed, (b) preserves every feature-001 conformance guarantee
  including the coverage matrix, and (c) still proves the analyzer reproduces every
  *derivable* byte of each witness. A Tier-1 producer reproducing Tier-2 hand-authored
  content is a category error; the projection makes the real obligation explicit.
- **Alternatives considered**: Trim the goldens (rejected: breaks `gate-coverage`,
  churns feature-001 artifacts); teach the analyzer to emit `examples` from `@example`
  and `semantics` from a tag (rejected: contradicts Principle IV, and `examples` are
  `authored-verifiable` — they must compile in CI, which a syntax-only analyzer cannot
  guarantee).

## R-13 — Stress testbed design (FR-014)

- **Decision**: One DataGrid-class component per framework, checked in as real,
  compiling source with byte-pinned goldens (`agentic-component-manifest.json` + `acm.view.yml`):
  - **Lit — `AcmeDataGrid` (`acme-data-grid`)**, single TS module: ≥ 10 reactive
    properties covering every mapping-rule shape (literal unions, generics-bearing
    references, arrays, functions, objects → opaque fallback), attribute reflection
    + custom converter, rich JSDoc on every member, ≥ 4 typed custom events, default
    + ≥ 3 named slots (JSDoc `@slot`), ≥ 3 public methods (incl. async), ≥ 4 CSS
    custom properties with syntax + defaults, ≥ 3 CSS parts, form-associated
    (`static formAssociated = true`) — every FR-014 Lit capability.
  - **Angular — `AcmeDataGridComponent` (`acme-data-grid`)**, standalone component:
    decorated `@Input`s (incl. aliased + transform) *and* signal `input()`/
    `input.required()`, ≥ 2 `model()` two-way pairs, decorated `@Output` *and* signal
    `output()`, multi-selector `<ng-content>` projection (≥ 3 selectors + default),
    host-level CSS custom properties + `@HostBinding`, injected configuration token
    (present in source, correctly *absent* from the manifest — a negative assertion),
    ≥ 3 public methods — every FR-014 Angular capability.
  - `contracts/testbed-inventory.md` enumerates capability → expected manifest node;
    the SC-008 test walks that inventory against both goldens so nothing is silently
    dropped.
- **Rationale**: FR-014's capability list becomes mechanically checkable (Principle
  IX) instead of a vibe; "real, compiling source" is a spec assumption, so both
  components must typecheck under the repo's TS.
- **Alternatives considered**: Reusing the maximal fixture's manifest as the golden
  (rejected: it is framework-neutral hand-fiction, not derivable from one real
  source file; the testbed is the *source-level* counterpart, not the same artifact).

## R-14 — Runtime dependency budget

- **Decision**: New runtime deps limited to: `typescript`, `@vue/compiler-sfc`,
  `tinyglobby`, `chokidar`. Everything else is stdlib or workspace-internal.
- **Rationale**: Each maps to one irreducible capability (parse TS, parse SFC, glob,
  watch); keeps the analyzer installable in constrained CI.
- **Alternatives considered**: Zero-dep purism via hand-rolled glob/watch (rejected:
  reinventing chokidar is how determinism and cross-platform behavior die).
