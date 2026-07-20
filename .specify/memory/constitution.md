<!--
Sync Impact Report
==================
Version change: 2.0.0 → 3.0.0  [MAJOR]
Rationale: Principle I is redefined — normativity moves from "the JSON Schema is the one
  normative artifact" to a two-layer stack (schema normative for shape; a single
  Normative Spec normative for behavior; schema + conformance suite jointly the source
  of truth). Per the Governance versioning policy, redefinition of a principle is MAJOR.
  Decisions ratified in the 2026-07-18/19 constitution grilling session.

Modified principles:
  I.   "Schema Is the Single Source of Truth" → "Schema and Conformance Suite Are the
       Source of Truth" — two-layer normative stack; same-change rule narrowed to the
       normative layer; one JSON Schema (draft 2020-12) governs canonical JSON and the
       YAML authoring input alike (Yamale and all parallel schema languages rejected).
  II.  Triangulation operationalized: witness-coverage-matrix CI gate; explicit
       applicability annotations; all-four bar with a CEM-inherited grandfather clause;
       paradigm classes clarified as stress-test baskets; identity model fixed to one
       entry per implementation with universal facets.
  IV.  Description fields pinned to Tier 1 (verbatim source doc comments; enrichment
       goes to source, never into the manifest); Tier 2 checks acknowledged as
       form-not-truth; examples optional.
  V.   Canonical form named and specified: the "ACM Canonical JSON" profile
       (schema-declared key order, RFC 8785 scalar rules, pretty-printed layout; pure
       JCS rejected for diff-reviewability); Agent View (deterministic one-way YAML
       projection for agent consumption) added; YAML authoring profile pinned to
       YAML 1.2 core schema.
  VI.  Structured type tier made enforceable: grammar-validated with a declared opaque
       fallback; "best approximation" defined by reference-analyzer mapping rules.
  VIII. Round-trip precision: CEM→ACM→CEM guaranteed at JSON-value equality; ACM→CEM
       only for WC-expressible manifests; converters ship machine-readable
       concept-mapping tables exercised by tests.
  X.   Structural limits made concrete: per-field/per-collection/per-depth normative
       limits, boundary-tested from both sides; maximal fixture doubles as the
       headroom proof.

Added sections: none (all changes land within existing principles/sections)
Removed sections: none

Templates requiring updates:
  ✅ .specify/templates/plan-template.md   — Constitution Check gate is dynamic; no change.
  ✅ .specify/templates/spec-template.md   — generic; no change.
  ✅ .specify/templates/tasks-template.md  — no principle coupling; no change.
  ✅ .claude/skills/speckit-*              — no outdated references.

Related artifacts: CONTEXT.md (glossary), docs/adr/0001 (Agent View),
  docs/adr/0002 (ACM Canonical JSON profile).

Follow-up TODOs: none.
-->

# Agentic Component Manifest (ACM) Constitution

<!--
  ACM is a universal, schema-first manifest format for UI components. It descends from
  the Custom Element Manifest (CEM), generalizing it to describe components from any
  framework (vanilla Web Components, React, Angular, Vue, Svelte, and others) through
  universal concepts, and adds agent-oriented metadata (semantics, examples) so AI
  tooling can discover and use components from metadata alone — never from
  implementation details. Canonical interchange is JSON; YAML serves as an authoring
  input only.
-->

## Core Principles

### I. Schema and Conformance Suite Are the Source of Truth (NON-NEGOTIABLE)

Normativity is a two-layer stack, and both layers are checkable artifacts. Jointly, the
schema and the conformance suite are the single source of truth.

- **The JSON Schema is normative for document shape.** There is exactly one schema —
  JSON Schema draft 2020-12 — applied to the parsed data model, so it governs canonical
  JSON and the YAML authoring input alike; no parallel schema in another language may
  exist. Documentation, validators, TypeScript types, converters, and examples MUST be
  generated from it — never hand-maintained in parallel. Any conflict about what a valid
  manifest looks like resolves in favor of the schema.
- **The Normative Spec is normative for behavior that shape cannot express** —
  canonicalization, must-ignore, round-trip guarantees, conformance classes, discovery,
  and security limits. It is a single document, and every clause in it MUST map to a
  conformance-suite check (Principle IX). A behavioral rule that exists only in
  scattered prose is not normative.
- **No normative change without schema/spec**: Planning artifacts (feature specs, plans,
  issues) MAY propose fields in prose. Nothing merges into the normative layer with
  prose and schema — or spec clause and conformance check — out of sync; the
  corresponding schema/spec modification ships in the same change.
- **Self-documenting nodes**: Every field defined by the specification MUST carry a
  machine-readable `type`, a Markdown-compatible `description`, and a declared
  provenance tier (Principle IV). Schema that omits any of these MUST be rejected —
  including schema an agent generates for itself.

**Rationale**: A single normative source per concern keeps generated types, docs, and
validators from silently drifting, and makes "regenerate and diff" a trustworthy review
mechanism. Confining behavioral rules to one spec document whose every clause is
CI-checked keeps "normative" and "enforceable" the same thing (Principle IX).

### II. Strict Framework Agnosticism — The Prime Directive

The core vocabulary describes components in universal, mechanical terms — inputs
(props/attributes), events, slots/children, methods, CSS hooks, and module exports —
without privileging any framework.

- Framework-specific nomenclature MUST NOT enter the core. A concept that exists in only
  one framework (e.g., React `ref`, Vue `v-model`) MUST be either abstracted to a
  universal mechanical concept (e.g., `DOMNodeReference`, `TwoWayBinding`) or relegated to
  a namespaced extension (`x-react`, `x-vue`). Nothing in the core may require an
  extension to be meaningful.
- **Rule of Triangulation**: Before any structural node is finalized, it MUST map cleanly
  onto all four paradigm classes, each witnessed by a concrete framework:
  1. **Retained-DOM / custom elements** — vanilla Web Components, Lit
  2. **VDOM / JSX function components** — React, Preact
  3. **Compiler-based single-file components** — Svelte, Vue
  4. **Signals- and DI-based** — Angular (MANDATORY witness), Solid

  Angular is the mandatory witness for class 4 because it is the structural outlier
  (dependency injection, structural directives, `ng-content` selectors, signal inputs,
  two-way `[( )]` bindings). Paradigm classes are stress-test baskets, not a partition
  of frameworks — a framework may straddle classes; a witness fixture counts for the
  class whose stressors it exercises.
- **Coverage-matrix enforcement**: "Maps cleanly" is mechanical, not judged. The
  repository maintains at least one witness fixture per paradigm class — a real
  component processed by that framework's reference tooling — and CI generates a
  node × class coverage matrix over the core schema. Every core structural node MUST be
  witnessed in every class: populated in that class's fixture, without carrying core
  semantics in `x-*` extensions and without placeholder values. A node × class cell may
  instead be declared inapplicable only via an explicit machine-readable applicability
  annotation in the schema — a reviewed, diffable event, never a silent gap. Only
  CEM-inherited, WC-specific nodes (Principle VIII) may carry restricted applicability;
  a new node that cannot witness all four classes belongs in an extension, not the core.
- **Identity first**: Component identity is the first node subject to Triangulation, and
  its model is fixed: a component entry describes exactly one implementation artifact in
  one framework. The identity model is universal by offering facets — tag name
  (retained-DOM), module + export name (VDOM and compiler classes), selector (Angular) —
  of which each entry fills those that apply, never as framework extensions. One entry
  MUST NOT merge API surfaces across frameworks (a merged surface is verifiable against
  no single source, breaking Tier 1, and cannot round-trip to CEM). Cross-framework
  kinship ("these entries are all the same design-system button") is not a core concern;
  it lives in extensions until it graduates (Principle III).

**Rationale**: A universal layer only stays universal if no single framework's mental
model leaks into it; triangulating across paradigm classes — not just popular frameworks
— is the concrete test that prevents that leak.

### III. Minimal Core, Namespaced Extensions

Resist completeness. The core stays small; new capabilities enter as namespaced
extensions first and graduate to core only after demonstrated multi-framework adoption.

- **Extensibility as a first-class citizen**: An escape hatch (`x-*` / `customData`,
  following the OpenAPI and CEM precedent) MUST exist at every node level so the format
  never becomes rigid.
- **Graceful degradation, enforced**: The repository MUST maintain two golden fixtures
  gating every merge: a `minimal` fixture (a trivial component) whose canonical form
  stays within a CI-enforced size budget, and a `maximal` fixture (an enterprise
  DataGrid-class component) — both validating against the same schema. Growth of the
  minimal fixture's budget is a reviewable event, never a silent drift.

**Rationale**: CEM's lesson is that a small core survives while a kitchen-sink core
fragments; extensions absorb edge cases without ossifying the spec.

### IV. Static, AST-Level, Provenance-Tiered

The manifest is a static description of a component's API surface — not a runtime
execution engine. Components are described in terms of their abstract syntax tree
properties and typings, not their runtime behavior.

Every field in the specification MUST declare exactly one provenance tier:

- **Tier 1 — Derived**: producible by static analysis of source and verifiable against
  it (inputs, events, types, slots, methods, exports).
- **Tier 2 — Authored-Verifiable**: human- or agent-authored but mechanically checkable.
  Usage examples MUST compile (and where applicable render) against the component in CI;
  semantic classifications MUST come from the controlled vocabulary (Principle VI).
  An authored field with no mechanical check is not Tier 2.
- **Tier 3 — Freeform**: unverifiable prose or tool-specific data. Lives ONLY in
  namespaced extensions (`x-*`); never in the core.

A field that cannot be placed in Tier 1 or Tier 2 does not belong in the core.

- **Descriptions are Tier 1**: Core `description` fields carry verbatim source
  doc-comment text, verifiable by comparison against source. Enrichment happens by
  improving the source documentation and regenerating — never by authoring prose
  directly into core manifest fields. Unsourced prose belongs in `x-*` (Tier 3). This is
  deliberate: it forces documentation back to the source, where it cannot drift from the
  code.
- **Checks gate form, not truth**: Tier 2's mechanical checks (compilation, vocabulary
  membership) are necessary for core membership, not sufficient for correctness — a
  compiling example can still model an anti-pattern, and a vocabulary term can still be
  the wrong term. Truth remains a review concern.
- **Examples are optional**: A manifest with zero examples is fully conformant. Examples
  that cannot be compiled in the producer's CI may ship only as `x-*` (Tier 3).

**Rationale**: Purely derived manifests cannot carry the agentic metadata that is this
project's reason to exist; purely authored manifests rot. Tiering keeps semantics and
examples in the core by making them *verifiable*, even though they are not *derivable*.

### V. Determinism and Canonical Form

The same input MUST always yield byte-identical output.

- **Canonical interchange is JSON**, in the **ACM Canonical JSON profile** defined in
  the Normative Spec: schema-declared key order for specified fields; lexicographic
  (Unicode code point) order for arbitrary-key maps and for unknown/`x-*` keys, which
  sort after declared keys; scalar serialization per RFC 8785 (ES6 number serialization,
  minimal string escaping, UTF-8); pretty-printed 2-space indentation, LF newlines,
  single trailing newline; arrays keep semantic (source) order, never sorted. No
  timestamps, no environment-dependent or nondeterministic values. Canonicalization is a
  producer obligation checked by regenerate-and-diff; consumers only validate. The
  project deliberately owns this custom profile and its reference canonicalizer — pure
  RFC 8785 was rejected because minified single-line output defeats diff review, which
  is a constitutional goal.
- **YAML is authoring-only**: the authoring input is YAML 1.2 (core schema), string keys
  only, no custom tags, and MUST parse into the JSON data model — where the one JSON
  Schema validates it — then compile to canonical JSON. YAML is never the interchange or
  distribution format; no canonical YAML form is defined or promised.
- **The Agent View**: the Normative Spec defines a deterministic YAML projection of
  canonical JSON — fixed emitter rules, no anchors, schema-declared key order — for
  token-frugal consumption by AI agents. It is generated one-way from canonical JSON,
  is never authoritative, is never converted back, and is never distributed as the
  manifest. Consumers that surface manifests to agents derive it locally; a golden
  JSON→YAML fixture pair gates emitter conformance.

**Rationale**: Determinism makes manifests reviewable in diffs and safe for agents to
regenerate. YAML has no canonical form (quoting styles, anchors, implicit typing), so it
is confined to the edges: an input humans and agents write, and a derived view agents
read — YAML costs materially fewer tokens than formatted JSON in an LLM context — while
the artifact of record stays canonical JSON.

### VI. Machine-First, Human-Debuggable, Agent-Ready

The primary consumers are tooling — IDE language servers, bundlers, documentation
generators, design systems, and AI agents. When human readability and machine readability
conflict, strict machine readability wins. The format MUST nonetheless remain readable,
diffable plain text.

- **Layered type model**: Every typed node carries a structured machine tier (a
  JSON-Schema-like type expression) AND preserves the raw source type text (e.g., the
  original TypeScript type) verbatim. The structured tier serves strict consumers; the
  raw tier serves losslessness (Principle VIII). Neither may be omitted where source
  typing exists. The structured tier MUST validate against the spec's type-expression
  grammar; where full structuring fails, the producer emits the grammar's declared
  opaque fallback form plus the raw text. "Best structured approximation" is defined by
  the reference analyzer's documented mapping rules and pinned by golden fixtures and
  determinism — never judged ad hoc.
- **Controlled semantic vocabulary**: Semantic-meaning fields MUST draw from a controlled
  vocabulary anchored to the Open UI component taxonomy and WAI-ARIA roles / APG
  patterns. Freeform semantic notes MAY accompany a controlled term, never replace it.
  An unconstrained "semantics" string is prose, not semantics.
- **Agent-ready by design**: Agent-oriented metadata — semantic classification and usage
  examples — is first-class core content (Tier 2), so an agent can discover a component
  and understand its inputs, events, and behavior from the manifest alone.

**Rationale**: The format exists to give AI and other tooling a dependable, framework-
independent metadata layer; ambiguity that a human could tolerate breaks a machine, and
an uncontrolled vocabulary is ambiguity in disguise.

### VII. Additive Evolution and Explicit Versioning

Within a major version, changes are additive only.

- **Must-ignore rule**: Consumers MUST ignore unknown fields. Producers MAY add fields but
  MUST NOT repurpose or remove fields without a major version bump.
- Every manifest MUST self-declare its schema version.
- Every proposed change MUST be classified as **breaking** (modifying or removing a
  required node) or **non-breaking** (adding an optional node), and that classification
  drives the version bump.

**Rationale**: Explicit, additive versioning lets a broad ecosystem of producers and
consumers upgrade independently without coordinated flag days.

### VIII. CEM Descent and Lossless Interop

ACM is a **generalized descendant** of the Custom Element Manifest — not a literal JSON
superset, and not an unrelated format.

- ACM adopts CEM's vocabulary and structure wherever the underlying concept is shared
  (modules, declarations, members, events, slots, CSS parts), and generalizes only where
  CEM is WC-specific (identity, component kinds). New names for shared concepts are
  forbidden.
- **Guaranteed round-trip**: Every valid CEM document MUST convert mechanically to a
  valid ACM document and back to a CEM document that is JSON-value-equal to the input
  (byte equality is not required — incoming CEM is not canonical). The reverse guarantee
  (ACM → CEM) holds only for manifests describing WC-expressible components. Every other
  converter (framework-specific metadata) MUST ship a machine-readable concept-mapping
  table enumerating exactly which nodes it maps, and round-trip tests iterate that
  table — "the concepts both formats share" is an enumerated artifact, never an unstated
  judgment. Unknown extensions MUST be preserved opaquely, never discarded.
- The format follows established web standards and vocabulary rather than inventing
  parallel terms.

**Rationale**: Descent-with-round-trip gives the entire existing CEM ecosystem
(Lit, Stencil, FAST, Storybook) a free migration path without shackling ACM's shape to
CEM's WC-centric skeleton — the adoption benefit of a superset without its structural
debt.

### IX. Every Principle Is Enforceable (NON-NEGOTIABLE)

Each article of this constitution MUST map to something checkable — a validator rule, a
conformance test, or a golden fixture. A principle that cannot fail a CI check is a wish,
not a law.

- **Show your work**: Any proposed universal abstraction MUST be demonstrated by
  expressing at least three concrete, real-world components (e.g., a Button, a Modal, a
  DataGrid) in the proposed format to prove it holds.
- **Adversarial fixtures**: The classics are not enough — they are DOM-ful, slot-ful
  easy cases. Every proposed abstraction MUST additionally be exercised against at least
  one fixture from the standing adversarial set, which MUST include at minimum:
  a headless component (no DOM output), a scoped-slot / render-prop component (data
  flowing into children), a polymorphic `as`-prop component, a controlled/uncontrolled
  input, and a form-associated element. Fixtures live in the repository and run in CI.

**Rationale**: Enforceability turns governance from aspiration into gate; abstractions
break on the weird components, so the weird components are the test.

### X. Manifests Are Untrusted Input

The primary consumer is an AI agent, which makes every description field a potential
prompt-injection vector. A manifest describes a component; it never instructs a consumer.

- Consumers — especially agents — MUST treat all manifest text (descriptions, semantic
  notes, example captions) as data, never as instructions to follow.
- The conformance suite MUST include hostile fixtures (manifests whose text attempts
  instruction injection) verifying that reference consumers surface them as inert data.
- Validators MUST enforce the normative structural limits defined in the Normative
  Spec — per-field string lengths, per-collection node counts, and nesting depth; never
  whole-document caps, which would conflict with legitimately large manifests. Limits
  are boundary-tested from both sides: the maximal fixture (Principle III) MUST validate
  inside them (the headroom proof), and hostile fixtures exceeding them MUST be
  rejected. Consumers MUST NOT execute code from manifest content. Example
  compilation/rendering happens in the producer's CI sandbox, never in the consumer.

**Rationale**: A format designed for agents that ignores adversarial manifests ships the
vulnerability with the spec.

## Agentic Development Workflow

This project is developed with AI agents; the following rules govern how agents may change
the specification and its artifacts.

- **Spec before code**: Agents change the spec/schema first and get it validated (and
  ideally human-reviewed) before regenerating downstream artifacts. No implementation
  change may introduce behavior that is absent from the spec.
- **Traceability**: Every generated change MUST cite the constitutional article, spec
  section, or issue it implements. Untraceable diffs are rejected.
- **Small, reversible increments**: Agents produce minimal diffs against canonical form.
  Because determinism (Principle V) holds, "regenerate and diff" is the universal review
  mechanism, and the conformance suite plus round-trip tests gate every merge.
- **Mandatory conflict-resolution path**: When a multi-agent swarm is used (e.g., a
  Proposer Agent and a Critic Agent), deadlocks MUST be broken by a defined rule. Baseline:
  if the Critic rejects a proposal three times for type ambiguity, the Proposer reverts to
  the last stable schema and narrows the scope of the proposal.

## Quality Gates & Conformance

The conformance test suite and golden fixtures are the executable expression of this
constitution. Conformance is defined in two classes:

- **Producer conformance** (analyzers, converters, authoring tools): emits canonical,
  deterministic JSON; every Tier 1 field verifiable against source; every Tier 2 example
  compiled/rendered in CI; semantic terms drawn from the controlled vocabulary.
- **Consumer conformance** (IDEs, doc generators, agents): honors must-ignore; preserves
  unknown extensions; treats manifest text as data (Principle X); requires no framework
  knowledge to interpret the core.

Every merge MUST pass all applicable gates:

- **Schema validation** — the schema itself is valid and every node satisfies Principle I
  (typed, documented, provenance-tiered).
- **Conformance suite** — sample manifests validate; invalid manifests are rejected for
  the right reason; hostile fixtures behave inertly.
- **Coverage matrix** — every core structural node is witnessed in each paradigm class
  or carries an explicit applicability annotation; no silent gaps (Principle II).
- **Round-trip / interop tests** — CEM → ACM → CEM is JSON-value-lossless; each
  converter's concept-mapping table is exercised; unknown extensions survive opaquely
  (Principle VIII).
- **Determinism check** — regeneration produces byte-identical ACM Canonical JSON, and
  the Agent View emitter matches its golden fixtures (Principle V).
- **Fixture gates** — the minimal fixture stays within its size budget; the maximal
  fixture validates inside the structural limits; the adversarial set passes; examples
  compile (Principles III, IV, IX, X).

CI MUST reject changes that: introduce framework-specific nomenclature into the core;
add a core field without a Tier 1 or Tier 2 provenance; add a field lacking a `type` or
`description`; add an unconstrained semantic string; or make a breaking change without a
major version bump.

## Distribution & Discovery

A manifest no tool can find does not exist.

- Packages MUST advertise their manifest via a single well-known convention: a top-level
  `acm` field in `package.json` pointing to the canonical JSON manifest (conventional
  filename `agentic-component-manifest.json`; parallel to CEM's `customElements` field), with a defined
  well-known path as fallback for non-npm distribution.
- Every distributed manifest self-declares its schema version (Principle VII); consumers
  resolve capability from the declaration, never from guesswork.
- The discovery convention is part of the spec and covered by the conformance suite.

## Governance

This constitution supersedes all other development practices for the ACM project. Where a
practice or convenience conflicts with an article here, the article prevails.

- **Amendment procedure**: The constitution is itself versioned and changes only through an
  explicit, human-approved amendment. Agents MAY propose amendments (with rationale and the
  accompanying schema/test impact) but MUST NOT self-ratify them.
- **Versioning policy** (SemVer for this document):
  - **MAJOR** — a backward-incompatible governance change, or the removal or redefinition
    of a principle.
  - **MINOR** — a new principle or section, or materially expanded guidance.
  - **PATCH** — clarifications, wording, and non-semantic refinements.
- **Compliance review**: Every pull request and review MUST verify compliance with the
  applicable principles. Any deviation MUST be justified in the change's Complexity
  Tracking (see the plan template) or rejected. Complexity that is not justified is not
  merged.
- **Guidance**: Runtime and per-feature development guidance lives in the Spec Kit
  templates and generated feature docs, which MUST remain consistent with this document.

**Version**: 3.0.0 | **Ratified**: 2026-07-18 | **Last Amended**: 2026-07-19
