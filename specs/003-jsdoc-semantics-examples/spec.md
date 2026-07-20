# Feature Specification: Doc-Comment Semantics & Examples Extraction

**Feature Branch**: `003-jsdoc-semantics-examples`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "the semantic should be defines by a jsdocs tsdocs tag as well as examples they should be extracted from the comments by the analyzer"

## Overview

Today the analyzer produces only Tier-1 (derived) content — inputs, events, slots, methods, CSS hooks — and never the two agent-facing Tier-2 fields the format exists for: a component's **semantic classification** and its **usage examples**. Those fields exist in the schema and appear only in hand-authored witness fixtures; the analyzer strips them before comparison.

This feature closes that gap. A component author documents the component's role and usage **in the source doc comment** — the same place its description already lives — and the analyzer extracts that into the manifest's `semantics` and `examples` fields, validating the role against the controlled vocabulary and confirming each example compiles against the component before it becomes core content. Documentation stays next to the code (it cannot drift), and every consuming agent gets a component's meaning and a *known-working* example from the manifest alone.

This extends the analyzer's existing doc-comment tag vocabulary (which already reads `@fires`, `@slot`, `@cssprop`, `@csspart`) with two more tags, and applies to every framework the analyzer supports, because extraction happens in the shared doc-comment layer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Classify a component's role from its doc comment (Priority: P1)

A component author adds a semantic-classification tag to a component's doc comment naming its role from the controlled vocabulary (e.g. `button`, `dialog`, `combobox`). When the analyzer runs, the produced manifest carries a `semantics` classification for that component, so an agent searching for "a button" or "a dialog" finds it from metadata alone.

**Why this priority**: Semantic classification is the single most valuable piece of agent-facing metadata and the smallest independently shippable slice — it turns an opaque API surface into something an agent can *discover by intent*. It delivers value even with no examples.

**Independent Test**: Annotate a component with the semantic tag and a valid term, run the analyzer, and confirm the manifest's declaration carries `semantics.term` equal to that vocabulary term (with optional notes), and that the output is schema-valid and canonical.

**Acceptance Scenarios**:

1. **Given** a component whose doc comment declares a semantic term from the controlled vocabulary, **When** the analyzer runs, **Then** the declaration's `semantics.term` in the manifest equals that term.
2. **Given** the same tag additionally carries free-text notes, **When** the analyzer runs, **Then** `semantics.notes` carries that text verbatim and `semantics.term` still carries the term.
3. **Given** a component with no semantic tag, **When** the analyzer runs, **Then** the declaration has no `semantics` field (absent, never invented) and the manifest is still valid.
4. **Given** two components each annotated with different valid terms, **When** the analyzer runs twice, **Then** both runs are byte-identical and each carries its own term.

---

### User Story 2 - Extract usage examples from doc comments (Priority: P2)

A component author writes one or more usage examples in the component's doc comment using the standard example tag. When the analyzer runs, it confirms each example actually compiles against the component and emits the compiling ones into the manifest's `examples` array with their source code (and a title where the author provided one), so an agent can copy a snippet that is *known to work* without reading the component's source.

**Why this priority**: Examples are the second pillar of agent-facing metadata but build on the same doc-comment extraction seam as US1; they are valuable independently (a component can have examples without a semantic term) but rank below classification because discovery precedes usage. Compile-verification is what makes them trustworthy core (Tier-2) content rather than possibly-stale prose.

**Independent Test**: Add one or more example blocks to a component's doc comment, run the analyzer, and confirm the manifest's declaration carries an `examples` array with the source (and title/lang) of each compiling example, in source order, schema-valid and canonical — and that a deliberately broken example is excluded with a diagnostic.

**Acceptance Scenarios**:

1. **Given** a component whose doc comment contains one example block that compiles against the component, **When** the analyzer runs, **Then** the declaration's `examples` array has one entry whose source is the example's code verbatim.
2. **Given** a component with multiple compiling example blocks, **When** the analyzer runs, **Then** `examples` lists them in source order, each an independent entry.
3. **Given** an example block that opens with a caption line, **When** the analyzer runs, **Then** that caption becomes the entry's `title` and the remaining lines become `source`.
4. **Given** a component with no example blocks, **When** the analyzer runs, **Then** the declaration has no `examples` field and the manifest is still valid.
5. **Given** an example block that does not compile against the component (e.g. wrong property, missing import), **When** the analyzer runs, **Then** that example is excluded from `examples`, a diagnostic names the file and the compilation error, and any other compiling examples are still emitted.

---

### User Story 3 - Safe, deterministic handling of invalid annotations (Priority: P3)

When an author mistypes a semantic term, omits it, over-runs a structural limit, or writes a malformed example, the analyzer reports a precise diagnostic and **never emits an invalid manifest** — the offending optional field is left out rather than corrupting the output or silently accepting a bad value. Because `semantics` and `examples` are optional, a bad annotation degrades to "field absent + diagnostic", never to a failed build or a wrong value in the manifest.

**Why this priority**: This is the constitutional guardrail (controlled vocabulary; never an invalid manifest; determinism). It is lower priority than the happy paths because it hardens rather than delivers the core value, but it is required before the feature can be trusted in CI.

**Independent Test**: Feed the analyzer components with (a) an unknown semantic term, (b) a semantic tag with no term, (c) an oversize note/example, and confirm each produces a diagnostic, the offending field is omitted, and the resulting manifest is still schema-valid and canonical.

**Acceptance Scenarios**:

1. **Given** a semantic tag whose term is not in the controlled vocabulary, **When** the analyzer runs, **Then** it emits a diagnostic naming the file and the invalid term, and the declaration carries no `semantics` field (the invalid term never reaches the manifest).
2. **Given** a semantic tag with no term text, **When** the analyzer runs, **Then** it emits a diagnostic and omits `semantics`.
3. **Given** more than one semantic tag on the same component, **When** the analyzer runs, **Then** it applies a single deterministic choice, emits a diagnostic about the extras, and the result is byte-identical across runs.
4. **Given** an example whose source exceeds the structural size limit (or more examples than the collection limit), **When** the analyzer runs, **Then** it emits a diagnostic and produces a manifest that still validates inside the limits, rather than aborting the whole manifest.

---

### Edge Cases

- **Unknown term**: a term not in the controlled vocabulary is diagnosed and dropped; it never appears in the manifest (Principle VI).
- **Empty / missing term**: a semantic tag with no term is diagnosed and dropped.
- **Duplicate semantic tags** on one component: one deterministic winner (first in source order), diagnostic on the rest.
- **Empty example block**: an example tag with no body is diagnosed and skipped.
- **Non-compiling example**: an example that fails to compile against the component is diagnosed and excluded from core `examples`; other compiling examples on the same component are unaffected (FR-005a).
- **Structural limits**: notes beyond the field length limit, an example source beyond the source limit, or more than the maximum number of examples are diagnosed; the offending optional item is dropped so the manifest still validates inside the limits (never a truncated or aborted manifest).
- **Example language**: an example whose language cannot be determined falls back to a default language; an unsupported language value is diagnosed and the example dropped.
- **Where the tag lives**: the semantic tag applies to a component declaration; the same tag on a non-component export is ignored (no component to attach to).
- **Cross-framework**: the same annotation on a Lit, Angular, React, or vanilla component yields the same `semantics`/`examples` shape, because extraction is framework-blind.
- **Injection safety**: notes and example captions are extracted as inert manifest data, never interpreted as instructions (Principle X); overlong or hostile text is bounded by the structural limits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The analyzer MUST recognize the `@acmSemantic` doc-comment tag on a component declaration and emit the declaration's `semantics.term` from the tag's term value. The tag body is `@acmSemantic <term> - <notes>`: the text before the first ` - ` is the term, the remainder (optional) is the notes — the same split convention the analyzer already applies to `@fires`/`@slot`/`@cssprop`/`@csspart`.
- **FR-002**: The analyzer MUST validate the term against the project's controlled vocabulary and MUST NOT emit a `semantics` classification whose term is outside that vocabulary; an out-of-vocabulary term is a diagnostic, not manifest content.
- **FR-003**: The analyzer MUST support optional free-text notes on the semantic tag, emitted verbatim as `semantics.notes`, and MUST never emit notes without a valid term (notes accompany, never replace, a term).
- **FR-004**: The analyzer MUST recognize the standard example doc-comment tag on a component declaration and emit one `examples` entry per example block, preserving source order.
- **FR-005**: Each emitted example MUST carry the example's source code verbatim; where the author provides a caption/title, it MUST be emitted as the entry's `title`; the entry MUST declare a `lang` from the allowed set.
- **FR-005a**: The analyzer MUST verify that each extracted example **compiles against the component** before emitting it as core content. An example that fails to compile MUST NOT appear in the core `examples` array; it MUST instead produce a diagnostic naming the file and the compilation error. (Compilation runs in the analyzer's producer-side sandbox — never in a consumer — satisfying the Tier-2 rule that core examples are mechanically verified, not merely present.)
- **FR-006**: Absence MUST be faithful: a component with no semantic tag emits no `semantics`; a component with no example tags emits no `examples`. The analyzer MUST NOT synthesize either from inference.
- **FR-007**: Extraction MUST be deterministic — the same source yields byte-identical `semantics`/`examples` output across repeated runs and across platforms.
- **FR-008**: The produced manifest MUST remain schema-valid and canonical after semantics/examples are added; an annotation that would violate the schema or a structural limit MUST NOT be emitted, and MUST NOT abort or truncate the whole manifest (the offending optional item is dropped with a diagnostic).
- **FR-009**: Every malformed or rejected annotation (unknown/empty term, duplicate semantic tag, empty/oversize/over-count example, unsupported language) MUST produce a diagnostic that names the source file and the problem.
- **FR-010**: Extraction MUST be framework-blind: the same annotation produces the same `semantics`/`examples` output for every framework the analyzer supports (vanilla, Lit, Angular, React), because it is handled in the shared doc-comment layer.
- **FR-011**: The semantic term and example source the analyzer reads MUST be taken verbatim from the source doc comment (the author's authored intent), consistent with keeping authored content sourced in code rather than added directly to the manifest.
- **FR-012**: The feature MUST be exercised by golden fixtures that pin the extracted `semantics`/`examples` byte-for-byte, and by seeded-failure cases proving invalid annotations are rejected for the right reason (controlled vocabulary, limits, determinism).

### Key Entities *(include if feature involves data)*

- **Semantic Classification**: the component's role, drawn from the controlled vocabulary (a fixed set of ~45 Open-UI / WAI-ARIA-anchored terms such as `button`, `dialog`, `tabs`, `combobox`, `grid`). Optional free-text notes may accompany the term but never replace it. Attaches to a component declaration.
- **Usage Example**: one runnable snippet showing how to use the component — a language (`ts` | `tsx` | `html`), verbatim source code, and an optional short title. It reaches the core `examples` array only if it compiles against the component. A component may carry several, in source order.
- **Doc-comment Annotation**: the tag in a component's source doc comment that carries the above — the authoring surface for both entities, sitting alongside the description and the existing `@fires`/`@slot`/`@cssprop`/`@csspart` tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of components annotated with a valid semantic tag expose that term in the manifest; 0% of produced manifests contain a semantic term outside the controlled vocabulary.
- **SC-002**: For a component annotated with example blocks, an agent can retrieve every compiling authored example (source, and title where given) from the manifest without reading component source — 100% of compiling examples appear, in authoring order, and 0% of non-compiling examples reach the core `examples` array.
- **SC-003**: Re-running the analyzer on unchanged source produces byte-identical `semantics`/`examples` output every time and on every supported platform (determinism).
- **SC-004**: A component annotated with a semantic term and examples produces a manifest byte-identical to the corresponding hand-authored golden — i.e. the analyzer can reproduce the Tier-2 content that previously had to be authored by hand.
- **SC-005**: Every malformed annotation surfaces a diagnostic that lets the author locate and fix it, and no malformed annotation ever produces an invalid or non-canonical manifest (measured by the seeded-failure suite: 100% caught, 0 invalid manifests emitted).
- **SC-006**: Adding semantics/examples extraction does not regress analysis throughput beyond the existing performance ceiling (full analysis of the benchmark corpus stays within its current budget).

## Assumptions

- **Extraction is syntax-only; example verification is type-aware**: semantic-term reading and example extraction read the written doc-comment text (the term's validity is checked against the vocabulary list, not inferred). Example *compile-verification* (FR-005a) is the one deliberate exception — it needs a type-aware compilation of the snippet against the component, a new capability distinct from the analyzer's syntax-only API extraction. The plan defines the sandbox; it does not change how the rest of the manifest is derived.
- **Controlled vocabulary is the existing one**: the term set is the project's current controlled vocabulary; this feature consumes it and does not expand or redefine it.
- **Declaration-level scope for v1**: the semantic tag classifies a whole component (declaration), not individual members; member-level semantics are out of scope for v1.
- **Standard example tag for examples**: usage examples reuse the standard JSDoc/TSDoc example tag rather than a bespoke one, so existing documentation is picked up without rewriting.
- **Language detection default**: when an example does not indicate its language, it defaults to `ts`; a fenced-code-block language hint, when present, selects `tsx`/`html`.
- **Optional by construction**: because `semantics` and `examples` are optional core fields, a rejected annotation (unknown term, non-compiling example, over-limit item) degrades to "absent + diagnostic", never to a failed build.
- **Compilation sandbox is the analyzer's**: the analyzer verifies examples in its own producer-side sandbox (never in a consumer, per Principle X). It compiles each example against the component's own types/package; the exact sandbox mechanics (tsconfig, dependency resolution) are a planning detail.
- **Builds on the existing seam**: extraction extends the analyzer's existing shared doc-comment tag layer, so all supported frameworks inherit it without per-framework work.
