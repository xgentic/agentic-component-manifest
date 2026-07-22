# Agentic Component Manifest (ACM)

The bounded context of the ACM specification project: a universal, schema-first manifest
format describing UI components from any framework, consumed primarily by tooling and AI
agents. The domain here is the format itself — its artifacts, tiers, and guarantees.

This is the project's **ubiquitous language** — the normative glossary. Use these terms
exactly in code, docs, and commit messages ([AGENTS.md](AGENTS.md) invariant #8). Each term
below is a stable heading anchor (e.g. `CONTEXT.md#agent-view`) so other docs can deep-link a
single definition.

## Language

### Manifest

A static, canonical-JSON description of a component library's public API surface and
agent-oriented metadata.
_Avoid_: metadata file, descriptor

### Component

A single implementation artifact in one framework, described by exactly one manifest
entry. Never a merged cross-framework surface.
_Avoid_: design-system component (that is cross-framework kinship — extension
territory), widget

### Identity Facet

One of the universal ways a Component is addressed — tag name, module + export name, or
selector. An entry fills the facets that apply to it.
_Avoid_: framework ID, qualified name

### Canonical JSON

The sole interchange and distribution serialization of a Manifest — deterministic and
byte-stable for identical input.
_Avoid_: canonical YAML (no such form exists or is promised)

### Authoring Input

The YAML a human or agent writes, which compiles to Canonical JSON. Never distributed,
never interchange.
_Avoid_: YAML manifest, YAML format

### Agent View

A deterministic YAML projection of a Manifest, generated mechanically from Canonical
JSON for token-frugal agent consumption. Never authoritative, never converted back.
_Avoid_: YAML manifest, YAML output, YAML interchange

### Normative Spec

The single behavioral specification document — normative for rules the Schema cannot
express (canonicalization, must-ignore, round-trip, discovery, conformance). Every clause
maps to a Conformance Suite check.
_Avoid_: docs, prose spec (scattered)

### Conformance Suite

The executable tests and golden fixtures that give every normative clause its teeth.
Jointly with the Schema, the single source of truth.

### Paradigm Class

One of the four component-model families every core node must map onto: retained-DOM,
VDOM/JSX, compiler-SFC, and signals/DI (Angular as mandatory witness).
_Avoid_: framework category, framework type

### Witness Fixture

A real component, processed by a framework's reference tooling, that proves a core node
maps onto that framework's Paradigm Class in the coverage matrix.
_Avoid_: example component, test component

### Applicability Annotation

A machine-readable schema declaration that a core node does not apply to a Paradigm
Class. Reserved for CEM-inherited nodes; never implicit.
_Avoid_: exemption, skip flag

### Concept-Mapping Table

A converter's machine-readable enumeration of exactly which nodes it maps between ACM
and another format. Round-trip tests iterate it.
_Avoid_: mapping doc, shared concepts (unenumerated)

### Provenance Tier

The declared origin class of every specified field: Derived (Tier 1), Authored-Verifiable
(Tier 2), or Freeform (Tier 3, extensions only).
_Avoid_: field origin, trust level

### Manifest Corpus

The set of valid Manifests assembled for one discovery invocation via the
Distribution & Discovery convention plus explicitly provided paths; the universe a
query runs against.
_Avoid_: index, registry, catalog

### Typed Envelope

The single machine-output document per discovery invocation — a response-type
discriminator plus data on success, or a message plus stable error code plus
optional suggestions on failure. Consumers branch on discriminators and codes,
never on prose.
_Avoid_: JSON output (unqualified), result blob

### Capability Manifest

The discovery surface's structured self-description — commands, arguments, options,
response types, error codes, examples — derived from the real command definitions.
The verification authority for the Discovery Skill and the runtime source of truth
on version skew.
_Avoid_: help output, command docs

### Discovery Skill

The canonical steering artifact — an Activation Description plus a workflow body —
that teaches agents the Two-Call Loop over the discovery surface. One source; every
ecosystem packaging derives from it.
_Avoid_: agent docs, prompt file

### Activation Description

The always-resident short text declaring when the Discovery Skill applies; the only
skill content paying a per-session token cost.
_Avoid_: skill summary, trigger text

### Two-Call Loop

The prescribed discovery workflow — one search, then one component detail, both in
machine output — branching only on response-type discriminators and stable error
codes.
_Avoid_: search flow, lookup sequence

### Steering Layer

The set of per-ecosystem packagings (Discovery Skill, context-file variants)
assembled from Generated and Authored Blocks that steer agents onto the discovery
surface.
_Avoid_: docs layer, agent docs

### Generated Block

A steering-layer content unit projected mechanically from the Capability Manifest;
a generated artifact, never hand-edited, structurally unable to drift from the
surface it describes.
_Avoid_: template section, boilerplate

### Authored Block

A steering-layer content unit of hand-written judgment — activation, error-path
playbook, security posture — that no manifest carries; gate-verified against the
Capability Manifest, never generated.
_Avoid_: manual section, freeform docs
