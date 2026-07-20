# Feature Specification: ACM Analyzer CLI

**Feature Branch**: `002-acm-analyzer-cli`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "a new package the analyzer its also a cli, exactlly like the https://github.com/open-wc/custom-elements-manifest/tree/master/packages/analyzer custom elements manifes analyzer it can scann a project and export ace definition out of a project. The analyzer shoudl support multiple frameworsk like lit, stencil, angular, react, vue and so on as plugins. it should support a setting sile like cem analyzer as well as cli command as cem analyzer the sam eones, instead od stencil paramete make a generc one called framework. it should moduary support multiple frameworks"

## Clarifications

### Session 2026-07-19

- Q: What determines whether a class member is part of the recorded "public API
  surface" (vs. excluded as internal)? → A: Exclude any member flagged non-public by a
  statically-visible signal — a TS `private`/`protected` modifier, an ECMAScript
  `#`-private field, a `@private`/`@internal` JSDoc tag, or a leading-underscore name;
  include all others.
- Q: In JavaScript source, do JSDoc type annotations (`@type`, `@param {T}`,
  `@returns {T}`) feed the type tiers, or is all JavaScript treated as untyped? → A:
  JSDoc-typed nodes are typed — raw tier is the verbatim JSDoc type text, structured
  tier is mapped by the same rules; "untyped" means no type annotation of any kind.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analyze a project and produce a manifest (Priority: P1)

A component library maintainer runs a single analyze command against their project. The
analyzer scans the source files, extracts every component's public API surface —
identity facets, inputs, events, slots/children, methods, CSS hooks, and module
exports, with doc-comment descriptions carried verbatim — and writes a valid ACM
manifest in canonical JSON. With no configuration at all, the analyzer handles standard
(vanilla) web components out of the box.

**Why this priority**: Producing a manifest from real source is the analyzer's entire
reason to exist, and it is the project's first Producer — until now every manifest has
been hand-authored. A working analyze command for one component model is a viable MVP
on its own.

**Independent Test**: Run the analyze command on a small vanilla web-component project
with zero configuration; the emitted manifest validates against the ACM schema, every
derived field is traceable to the source, and running the command a second time yields
a byte-identical file.

**Acceptance Scenarios**:

1. **Given** a project containing standard web components, **When** the analyze command
   runs with no configuration, **Then** a manifest is written that validates against
   the ACM schema and lists every public component with its API surface.
2. **Given** unchanged source, **When** the analyze command runs twice, **Then** both
   outputs are byte-identical canonical JSON.
3. **Given** a component whose members carry doc comments, **When** analyzed, **Then**
   each description field contains the verbatim doc-comment text; **Given** a member
   with no doc comment, **Then** its description is absent — never invented.
4. **Given** a source file that cannot be parsed, **When** the analysis runs, **Then**
   a diagnostic names the file and the remaining files are still analyzed.

---

### User Story 2 - Select a framework with one generic option (Priority: P2)

A maintainer of a Lit, Stencil, Angular, React, or Vue component library selects their
framework through a single generic `framework` option — on the command line or in the
settings file — instead of per-framework switches. The matching framework plugin
recognizes that framework's authoring patterns (e.g., reactive properties, decorated
inputs/outputs, function-component props) and maps them onto the universal ACM
concepts, filling exactly the identity facets that apply.

**Why this priority**: Multi-framework coverage is what distinguishes the ACM analyzer
from its CEM ancestor; the generic `framework` option is the user-visible contract for
it. It builds directly on the P1 analysis engine.

**Independent Test**: Analyze one fixture project per shipped framework, passing only
`framework` with the corresponding value; each run emits a valid manifest whose
identity facets and API surface match that framework's expected shape.

**Acceptance Scenarios**:

1. **Given** a Lit component with reactive properties and dispatched events, **When**
   analyzed with the framework option set to Lit, **Then** the manifest records them as
   inputs and events, and the entry carries a tag-name identity facet.
2. **Given** a React function component with typed props, **When** analyzed with the
   framework option set to React, **Then** the manifest records the props as inputs and
   the entry carries a module + export-name identity facet and no tag name.
3. **Given** an Angular component with decorated inputs, outputs, and a selector,
   **When** analyzed with the framework option set to Angular, **Then** the manifest
   records them and the entry carries a selector identity facet.
4. **Given** an unrecognized framework value, **When** the analyze command runs,
   **Then** it fails with a message listing the supported framework values.
5. **Given** the stress-testbed's maximally complex Lit and Angular components,
   **When** each is analyzed with its framework selected, **Then** the emitted
   manifest byte-matches the checked-in golden manifest for that component.

---

### User Story 3 - Configure through a settings file with CLI override (Priority: P3)

A maintainer checks a settings file into their repository declaring which files to
include and exclude, where to write the manifest, which framework to use, and which
plugins to load — the same option set the reference CEM analyzer offers. Running the
bare analyze command picks the settings up automatically; any option passed on the
command line overrides the file. A watch mode re-analyzes on source changes during
development.

**Why this priority**: Team workflows and CI need reproducible, committed
configuration; CEM-analyzer users expect this exact shape. It layers on top of P1/P2
without changing analysis behavior.

**Independent Test**: Commit a settings file with include/exclude patterns, an output
directory, and a framework; run the bare command and verify all are honored; re-run
with a conflicting command-line option and verify the command line wins.

**Acceptance Scenarios**:

1. **Given** a settings file declaring include globs, exclude globs, an output
   directory, and a framework, **When** the analyze command runs with no flags,
   **Then** every declared option is honored.
2. **Given** a settings file and a conflicting command-line option, **When** the
   command runs, **Then** the command-line value takes precedence.
3. **Given** watch mode is active, **When** a watched source file changes, **Then**
   the manifest is regenerated; **When** a change introduces a parse error, **Then**
   a diagnostic is reported and watching continues.
4. **Given** a quiet-output option, **When** the command runs, **Then** routine
   progress output is suppressed while errors are still reported.

---

### User Story 4 - Extend the analyzer with custom plugins (Priority: P4)

A framework author or design-system team writes their own plugin and registers it in
the settings file. The plugin participates in the analysis lifecycle: it can teach the
analyzer a new framework entirely, or enrich the emitted manifest with additional data
under namespaced `x-*` extensions. The analyzer core itself contains no
framework-specific knowledge — every framework, including the five that ship with the
analyzer, goes through the same plugin seam.

**Why this priority**: Modularity is what keeps the core framework-agnostic (the Prime
Directive) and lets the ecosystem grow without core releases; it is the load-bearing
architecture behind P2 but only becomes a user-facing feature once a public plugin
contract exists.

**Independent Test**: Register a custom plugin from the settings file that adds a
namespaced extension field to every entry; verify the field appears in the output and
the manifest still validates. Implement a toy framework purely through the public
plugin interface and verify it produces valid entries with no core modification.

**Acceptance Scenarios**:

1. **Given** a settings file registering a custom plugin, **When** the analysis runs,
   **Then** the plugin's lifecycle hooks are invoked and its contributions appear in
   the output.
2. **Given** a plugin contributing framework-specific or otherwise unverifiable data,
   **When** the manifest is emitted, **Then** that data lives under namespaced `x-*`
   extensions and the manifest still validates against the schema.
3. **Given** a new framework implemented entirely as an external plugin, **When** it is
   selected via the framework option, **Then** analysis succeeds with no change to the
   analyzer core.
4. **Given** a plugin whose contribution would make the manifest invalid, **When** the
   analyzer prepares to write output, **Then** the invalid result is rejected with a
   diagnostic and no manifest file is written.

---

### Edge Cases

- Project where the include patterns match no files: the command reports this
  explicitly rather than silently writing an empty manifest.
- Project with matched files but no recognizable components: a valid manifest with an
  empty component list is emitted, with a notice.
- Untyped source — a node with no type annotation of any kind, neither a TypeScript
  type nor a JavaScript JSDoc type (`@type`, `@param {T}`, `@returns {T}`): the
  structured type tier and the raw type text are omitted together — never one without
  the other. A JavaScript node that does carry a JSDoc type is typed, and its raw tier
  is the verbatim JSDoc type text.
- A source type too complex to structure: the declared opaque fallback plus the
  verbatim raw type text, per the documented mapping rules — never a silently missing
  structured tier.
- Files in the project that don't match the selected framework's patterns (e.g., plain
  utility modules): analyzed for module exports only or skipped, never misattributed
  as components.
- Two components in one file, or one component re-exported from several modules: each
  implementation yields exactly one entry; re-exports don't multiply entries.
- Output directory does not exist: it is created.
- Watch mode receiving a rapid burst of file changes: results in a consistent final
  manifest (no interleaved partial writes).
- Settings file present but malformed: the command fails with a message naming the
  file and the problem, rather than silently falling back to defaults.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST deliver an analyze command that scans a project's source
  files and writes an ACM manifest describing every discovered component's public API
  surface: identity facets, inputs, events, slots/children, methods, CSS hooks, and
  module exports.
- **FR-002**: All emitted manifests MUST be ACM Canonical JSON that validates against
  the ACM schema; the analyzer MUST validate before writing and MUST NOT write an
  invalid manifest. Repeated runs over unchanged input MUST be byte-identical across
  runs and platforms (no timestamps, no environment-dependent values).
- **FR-003**: With no framework selected, the analyzer MUST handle standard (vanilla)
  web components — mirroring the reference CEM analyzer's default.
- **FR-004**: Framework selection MUST be a single generic `framework` option (command
  line and settings file), replacing the reference analyzer's per-framework switches.
  Plugins for Lit, Stencil, Angular, React, and Vue MUST ship with the analyzer; an
  unrecognized value MUST fail with the list of supported values.
- **FR-005**: All framework support MUST be modular: each framework is a plugin behind
  a public plugin interface, the analyzer core MUST contain no framework-specific
  knowledge, and a new framework MUST be addable as an external plugin with no core
  change.
- **FR-006**: The analyzer MUST support a settings file offering the reference CEM
  analyzer's option set — include globs, exclude globs, output directory, framework
  selection, development/verbose output, quiet output, watch mode, and plugin
  registration — and the same options as command-line flags where they apply.
  Precedence MUST be: command line over settings file over built-in defaults.
- **FR-007**: The analyzer MUST provide a watch mode that re-analyzes on source
  changes, keeps running through per-file errors, and never leaves a partially
  written manifest.
- **FR-008**: Every derived field MUST satisfy Tier 1 provenance: verifiable against
  the analyzed source, with description fields carrying verbatim doc-comment text and
  absent when the source has none. The analyzer MUST NOT invent members,
  descriptions, or defaults.
- **FR-009**: Every typed node MUST carry both the structured type tier and the
  verbatim raw source type, produced per the analyzer's documented mapping rules,
  with the declared opaque fallback where structuring fails — establishing this
  analyzer as the reference analyzer those rules belong to. A node's type is taken from
  its TypeScript type annotation or, in JavaScript source, from its JSDoc type
  annotation (`@type`, `@param {T}`, `@returns {T}`); a node with neither is untyped and
  carries no type tier.
- **FR-010**: Each entry MUST describe exactly one implementation artifact in one
  framework and fill exactly the identity facets that apply (tag name; module +
  export name; selector).
- **FR-011**: The plugin interface MUST expose analysis lifecycle hooks through which
  plugins contribute to and transform manifest output; plugin-contributed data that is
  not Tier 1 derivable MUST land under namespaced `x-*` extensions.
- **FR-012**: The analyzer MUST report diagnostics that name the affected file and
  problem, continue past per-file failures, and distinguish through its exit status
  between success, completed-with-warnings, and failure.
- **FR-013**: For each shipped framework plugin, analyzing that framework's witness
  component MUST reproduce the corresponding checked-in witness fixture, retrofitting
  Tier 1 verification onto the existing fixture corpus; these checks MUST run in the
  conformance harness.
- **FR-014**: The feature MUST deliver an analyzer stress testbed for the Lit and
  Angular plugins: for each of the two frameworks, one maximally complex,
  DataGrid-class component exercising every universal concept that framework can
  express — for Lit: reactive properties with attribute reflection and converters,
  typed custom events, default and named slots, public methods, CSS custom properties
  and parts, and form-associated behavior; for Angular: decorated and signal-based
  inputs, two-way bindings, outputs, multi-selector content projection, host-level
  CSS hooks, injected configuration, and public methods — checked in as source
  together with a hand-verified golden ACM manifest. Analyzing the testbed source
  MUST reproduce its golden manifest byte-for-byte, and these checks MUST run in the
  conformance harness as the stress companion to the button-class witness checks
  (FR-013).
- **FR-015**: A member is part of the recorded public API surface only when it carries
  no statically-visible non-public signal. The analyzer MUST exclude any member marked
  `private` or `protected` (access modifier), declared as an ECMAScript `#`-private
  field, tagged `@private` or `@internal` in its doc comment, or named with a leading
  underscore; every other member MUST be recorded. Visibility MUST be decided from
  syntax alone, so the decision is deterministic and verifiable against source (Tier 1).

### Key Entities

- **Analyzer**: the engine that scans source, orchestrates plugins, and emits one
  manifest per run; framework-blind by construction.
- **Analyze command**: the user-facing CLI wrapping the analyzer; options mirror the
  reference CEM analyzer with `framework` as the one generic selector.
- **Framework Plugin**: a module implementing the public plugin interface for one
  framework's authoring patterns; five ship built in, others load externally.
- **Plugin Interface**: the published lifecycle contract (hooks, inputs, contribution
  rules) that both built-in and external plugins use identically.
- **Analyzer Settings**: the committed settings file — include/exclude patterns,
  output directory, framework, verbosity, watch, plugins — merged with command-line
  overrides.
- **Diagnostic**: a per-file, per-problem report emitted during analysis; fatal only
  when no valid manifest can be produced.
- **Analyzer Stress Testbed**: the maximally complex Lit and Angular components,
  checked in as source with golden manifests; the analyzer's hardest per-framework
  regression gate, complementing the button-class witness fixtures.
- **Manifest**: the emitted ACM Canonical JSON document (as defined by the existing
  schema feature); this feature produces it, never redefines it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A maintainer with an existing component project produces a valid
  manifest with a single command and zero configuration, in under five minutes from
  first install.
- **SC-002**: 100% of analyzer runs over unchanged input produce byte-identical
  manifests, verified across two platforms in the conformance harness.
- **SC-003**: All five shipped framework plugins analyze their witness components into
  manifests that exactly match the checked-in witness fixtures.
- **SC-004**: In golden-fixture comparisons, 100% of derived fields are verifiable
  against source and zero members or descriptions are invented.
- **SC-005**: At least one framework is demonstrably implemented purely through the
  public plugin interface with zero analyzer-core changes.
- **SC-006**: Every configuration capability of the reference CEM analyzer (include,
  exclude, output directory, dev, quiet, watch, plugins, framework selection) has a
  working equivalent, so a CEM-analyzer user can migrate their setup without losing
  any capability.
- **SC-007**: Analyzing a 100-component library completes in under 30 seconds on a
  typical developer machine, and watch mode reflects a single-file change in the
  manifest within 5 seconds.
- **SC-008**: The Lit and Angular stress-testbed components analyze into manifests
  that byte-match their golden manifests, with every framework capability listed in
  FR-014 present in both source and golden output — no capability silently dropped.

## Assumptions

- "ace definition" in the feature description is read as the ACM manifest; output
  follows the discovery convention's conventional filename (`agentic-component-manifest.json`) in the chosen
  output directory.
- One framework per analyzer invocation, mirroring the reference CEM analyzer;
  multi-framework monorepos run the analyzer once per package. Cross-framework
  merging is constitutionally excluded regardless (one entry per implementation).
- The shipped framework set (vanilla web components, Lit, Stencil, Angular, React,
  Vue) covers all four paradigm classes; further frameworks (Svelte, Solid, Preact,
  FAST, …) arrive as plugins — external first — rather than blocking this feature.
- Each framework plugin targets that framework's current idiomatic authoring style
  (e.g., decorated class components for Angular, function components for React);
  legacy styles are out of scope until requested.
- The analyzer emits derived (Tier 1) content only. Authored Tier 2 content (semantic
  classification, usage examples) enters manifests through authoring workflows or
  plugins, not through automatic derivation — an analyzer that guessed semantics would
  violate the provenance model.
- Format-to-format converters (CEM ⇄ ACM) remain out of scope; the analyzer derives
  manifests from source, it does not convert existing manifests.
- The stress-testbed golden manifests are hand-authored and schema-validated first
  (like the foundation witness fixtures), then pinned as the analyzer's byte-exact
  targets; the testbed components are real, compiling source — the source-level
  counterpart of the maximal fixture's DataGrid-class ambition. Stress testbeds for
  the remaining frameworks follow with demand, not in this feature.
- Advertising the manifest from the package metadata (the discovery convention's `acm`
  field) remains the package author's step; the analyzer documents it but does not
  rewrite package metadata.
- Naming note: per the precedent set in feature 001, CLI/settings option names and
  serialization terms appear here because they are the user-facing contract of a
  developer tool — the deliverable is the tool's behavior — while languages, parsers,
  and library choices remain unconstrained for planning.
