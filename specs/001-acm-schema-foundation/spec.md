# Feature Specification: ACM Schema Foundation

**Feature Branch**: `001-acm-schema-foundation`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "ACM schema foundation — JSON Schema 2020-12 skeleton, normative spec document, canonical-JSON serialization, YAML authoring profile, Agent View projection, and the conformance/CI gate harness, per constitution v3.0.0 and the decisions ratified in the 2026-07-18/19 grilling session."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Describe and validate a component manifest (Priority: P1)

A component library author (human or AI agent) writes a manifest describing one
component — its identity facets, inputs, events, slots/children, methods, CSS hooks, and
module exports, plus semantic classification — and validates it. Valid manifests are
accepted; invalid manifests are rejected with an error that names the failing node and
the rule it broke.

**Why this priority**: The schema is the product. Without a validatable document shape,
no other capability (canonicalization, projection, conformance) has anything to operate
on. This story alone is a viable MVP: a published schema plus a validator.

**Independent Test**: Author a minimal Button manifest and validate it (accepted);
mutate it seven ways (wrong type, missing identity, unknown enum term, merged
cross-framework surface, missing schema version, oversized field, non-string map key)
and validate each (rejected, each for the stated reason).

**Acceptance Scenarios**:

1. **Given** a manifest describing one component implementation with its applicable
   identity facets, **When** it is validated, **Then** it is accepted.
2. **Given** a manifest whose semantic classification uses a term outside the controlled
   vocabulary, **When** it is validated, **Then** it is rejected naming the field and
   the vocabulary rule.
3. **Given** a manifest that omits its schema version self-declaration, **When** it is
   validated, **Then** it is rejected.
4. **Given** a manifest carrying unknown `x-*` fields at any node level, **When** it is
   validated, **Then** it is accepted and the unknown fields are preserved untouched.

---

### User Story 2 - Author in YAML, distribute canonical JSON (Priority: P2)

An author writes the manifest as YAML (per the pinned authoring profile), compiles it,
and receives canonical JSON. Recompiling unchanged input yields byte-identical output,
so review happens by regenerate-and-diff.

**Why this priority**: Determinism is the constitutional review mechanism and the
precondition for every downstream gate; authoring ergonomics is what makes the format
writable by humans and agents.

**Independent Test**: Compile the same YAML fixture twice on two platforms; assert
byte-identical canonical JSON. Feed YAML using out-of-profile constructs (custom tags,
non-string keys, YAML 1.1 implicit typing) and assert rejection.

**Acceptance Scenarios**:

1. **Given** a YAML authoring input within the profile, **When** compiled twice,
   **Then** both outputs are byte-identical canonical JSON.
2. **Given** YAML relying on YAML 1.1 implicit typing (e.g., an unquoted `no` intended
   as a string), **When** compiled, **Then** the profile's parse rules apply (YAML 1.2
   core schema) and any out-of-profile construct is rejected with the profile rule named.
3. **Given** a hand-edited canonical JSON manifest with reordered keys, **When** the
   determinism check runs, **Then** the drift is detected and reported as a diff.

---

### User Story 3 - Agent consumes a component via the Agent View (Priority: P3)

Tooling that surfaces a component to an AI agent derives the Agent View — the
deterministic YAML projection — from canonical JSON, and the agent correctly answers
questions about the component's API surface from that view alone, at a measurably lower
token cost than the JSON form.

**Why this priority**: Agent consumption is the project's reason to exist, but it
requires the validated shape (P1) and deterministic canonical form (P2) first.

**Independent Test**: Emit the Agent View for each golden fixture; assert byte-equality
with the checked-in golden YAML and assert the token-count reduction target against the
formatted JSON form.

**Acceptance Scenarios**:

1. **Given** a canonical JSON fixture, **When** the Agent View is emitted twice,
   **Then** both emissions are byte-identical and match the golden YAML.
2. **Given** the Agent View of the Button witness fixture, **When** an agent is asked to
   enumerate its inputs, events, and slots, **Then** the enumeration is complete and
   contains no invented members.
3. **Given** a manifest whose description text contains instruction-like content
   ("ignore previous instructions…"), **When** surfaced through the reference consumer,
   **Then** the text is presented as inert data and no instruction is followed.

---

### User Story 4 - Conformance harness gates every change (Priority: P4)

A spec maintainer (or agent) proposing any schema change gets an automatic verdict from
the CI harness: schema self-checks (every field typed, documented, provenance-tiered),
coverage matrix over the witness fixtures, fixture gates (minimal budget, maximal
within limits, adversarial set, hostile set), and determinism checks.

**Why this priority**: The constitution declares unenforceable principles to be wishes;
the harness is what converts the other three stories into laws. It depends on all of
them existing.

**Independent Test**: Submit a change adding a core field without a provenance tier
(rejected); a core field witnessed in only three paradigm classes with no applicability
annotation (rejected); a growth of the minimal fixture beyond budget (rejected as a
reviewable event).

**Acceptance Scenarios**:

1. **Given** a schema change adding a field lacking `type`, `description`, or tier,
   **When** CI runs, **Then** the change is rejected naming the field.
2. **Given** a core node unwitnessed in one paradigm class and not annotated
   inapplicable, **When** the coverage matrix is generated, **Then** the merge is
   blocked showing the empty cell.
3. **Given** a new (non-CEM-inherited) node carrying an applicability annotation,
   **When** CI runs, **Then** the change is rejected — only CEM-inherited nodes may
   restrict applicability.
4. **Given** a hostile fixture exceeding a structural limit, **When** validated,
   **Then** it is rejected; **Given** the maximal fixture, **Then** it validates inside
   the same limits.

---

### Edge Cases

- Component with an empty API surface (no members at all): remains a valid, minimal
  manifest inside the size budget.
- A JavaScript-only component with no source typing: structured type tier absent
  together with raw type text (both-or-neither rule per typed node).
- A type too complex to structure: the declared opaque fallback plus verbatim raw text —
  never a silently missing structured tier.
- Arbitrary-key maps (e.g., keyed by slot name): canonical order is lexicographic by
  code point, independent of authoring order.
- Unknown `x-*` extensions: preserved opaquely through validation, canonicalization, and
  the Agent View.
- Source without doc comments: description fields are absent, not invented — enrichment
  happens in source, never in the manifest (Tier 1 rule).
- Numbers that serialize ambiguously (`1.0` vs `1`, exponents): fixed by the profile's
  scalar rules; a fixture exercises them.
- Identity facets that don't apply (a React component has no tag name): omitted facets
  are valid; at least one facet is required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST deliver one JSON Schema (draft 2020-12) defining the
  manifest document: schema-version self-declaration, component entries (exactly one
  implementation per entry), universal identity facets (tag name, module + export name,
  selector — at least one required), inputs, events, slots/children, methods, CSS
  hooks, module exports, semantic classification, usage examples, and an `x-*`
  extension point at every node level.
- **FR-002**: Every field defined by the schema MUST carry a machine-readable `type`, a
  Markdown-compatible `description`, and exactly one declared provenance tier; the
  harness MUST reject schema changes violating this.
- **FR-003**: The feature MUST deliver the single Normative Spec document covering: the
  ACM Canonical JSON profile, the YAML authoring profile, the Agent View emitter rules,
  the must-ignore rule, structural limits (per-field lengths, per-collection counts,
  nesting depth), and the discovery convention (`acm` field, `agentic-component-manifest.json` filename) — with
  a traceability listing mapping every clause to at least one conformance check.
- **FR-004**: The validator MUST accept every valid fixture and reject every invalid
  fixture with an error naming the failing node and rule.
- **FR-005**: The canonicalizer MUST emit ACM Canonical JSON per the profile, and
  regeneration MUST be byte-identical across runs and platforms.
- **FR-006**: The authoring compiler MUST accept profile-conformant YAML 1.2 input,
  reject out-of-profile constructs naming the violated profile rule, and emit canonical
  JSON.
- **FR-007**: The Agent View emitter MUST project canonical JSON to deterministic YAML
  per the Normative Spec, verified against golden JSON→YAML fixture pairs.
- **FR-008**: The fixture set MUST include: the minimal fixture (CI-enforced size
  budget), the maximal fixture (validating inside all structural limits), the four
  witness fixtures (one per paradigm class, Angular mandatory), the adversarial set
  (headless, scoped-slot/render-prop, polymorphic `as`-prop, controlled/uncontrolled
  input, form-associated element), and hostile fixtures (instruction-injection text;
  over-limit structures).
- **FR-009**: The harness MUST generate the node × paradigm-class coverage matrix from
  the witness fixtures and block merges with unwitnessed, unannotated cells or with core
  semantics smuggled through `x-*`.
- **FR-010**: Applicability annotations MUST be machine-readable in the schema, and the
  harness MUST reject restricted applicability on any node that is not CEM-inherited.
- **FR-011**: Semantic classification fields MUST be constrained to the controlled
  vocabulary (pinned term list anchored to the Open UI taxonomy and WAI-ARIA roles/APG
  patterns), shipped as generated data; freeform notes MAY accompany, never replace, a
  term.
- **FR-012**: TypeScript types and documentation MUST be generated from the schema, with
  a drift check failing CI when generated artifacts are stale.
- **FR-013**: The discovery convention MUST be covered by conformance checks (a package
  advertising `acm` → `agentic-component-manifest.json` is discoverable; a manifest without schema-version
  self-declaration is rejected).

### Key Entities

- **Manifest**: canonical-JSON description of a library's components; self-declares its
  schema version.
- **Component (entry)**: one implementation artifact in one framework; carries identity
  facets, API surface members, semantics, examples.
- **Identity Facet**: tag name / module + export / selector; entries fill what applies.
- **Schema**: the one JSON Schema, normative for shape; every field typed, documented,
  tiered.
- **Normative Spec**: the one behavioral document; every clause traceable to a check.
- **Fixtures**: minimal, maximal, witness (×4), adversarial (×5), hostile — the
  executable constitution.
- **Coverage Matrix**: node × paradigm-class witness report; merge gate.
- **Agent View**: derived deterministic YAML projection; golden-pair checked.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four witness components and all five adversarial components are
  expressible as valid manifests with zero core semantics carried in `x-*` extensions.
- **SC-002**: 100% of regeneration runs (canonical JSON and Agent View, all fixtures,
  two platforms) are byte-identical.
- **SC-003**: 100% of Normative Spec clauses trace to at least one executing conformance
  check; the traceability listing has no orphans in either direction.
- **SC-004**: An agent given only the Agent View of a witness fixture enumerates its
  complete API surface with zero invented members.
- **SC-005**: The Agent View is at least 15% smaller in tokens than the formatted
  canonical JSON for every golden fixture.
- **SC-006**: Every hostile fixture is handled correctly: over-limit fixtures are 100%
  rejected; injection-text fixtures are 100% surfaced as inert data by the reference
  consumer.
- **SC-007**: A deliberately non-conformant schema change (untyped, untiered,
  unwitnessed, or budget-breaking) is blocked by CI in 100% of the seeded attempts.

## Assumptions

- Foundation witness fixtures are hand-authored and schema-validated; production and
  verification of them by per-framework reference analyzers arrives with later analyzer
  features, which will retrofit Tier 1 verification onto the same fixtures.
- The CEM ⇄ ACM converter, framework analyzers, registry/publishing tooling, IDE
  integrations, and the cross-framework kinship extension are out of scope for this
  feature; the harness reserves their gate slots (round-trip and concept-mapping-table
  gates activate when the first converter lands).
- Example compilation is proven end-to-end for one framework toolchain in this feature;
  remaining frameworks follow with their analyzers. Fixtures may ship example-free
  (examples are optional per constitution IV).
- Concrete structural-limit values and the minimal fixture's size budget are fixed in
  the Normative Spec during implementation planning; this spec requires their existence,
  boundary tests on both sides, and reviewable (never silent) changes.
- Naming note: format and serialization terms (JSON, YAML, JSON Schema) appear in this
  spec because they are the domain of a manifest-format project — the deliverable is a
  format — not implementation leakage; the implementation stack for tooling (languages,
  test runners, CI vendor) remains unconstrained here.
