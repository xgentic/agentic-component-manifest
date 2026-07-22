# Feature Specification: Agent Discovery Skill

**Feature Branch**: `005-agent-discovery-skill`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description: "Agent discovery skill — the skill layer decided in ADR
0003 and left as the explicit follow-up by spec 004. Deliver an agent skill (SKILL.md)
that wires the spec-004 discovery CLI (search, component detail, capability manifest,
typed machine-output envelopes, stable error codes) into AI coding agents as their
component-discovery workflow: progressive-disclosure activation, the two-call loop,
branching on discriminators and codes never prose, untrusted-data posture (NS-DATA-1)
carried into the prompt layer, token-frugal dense mode preferred, skill content
drift-gated against the capability manifest, distributable to the major agent
ecosystems, and a conformance check exercising the documented loop end to end
including a hostile-fixture pass." Grounded in
[ADR 0003](../../docs/adr/0003-agent-consumption-layer.md) (as amended 2026-07-22),
[ADR 0004](../../docs/adr/0004-skill-generated-from-capability-manifest.md),
[ADR 0005](../../docs/adr/0005-lexical-search-agent-retrieval-ladder.md), and the
[component-discovery research](../../docs/research/component-discovery-for-agents.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The skill steers an agent from need to spec (Priority: P1)

An AI coding agent with the Discovery Skill installed is asked to build frontend UI in
a project whose dependencies ship ACM Manifests. At session start the agent carries
only the skill's short activation description; when the frontend task appears, the
skill body loads and directs a fixed workflow: first confirm the project has a
discoverable Manifest Corpus, then run one search with the natural-language need in
machine-output mode, pick a candidate from the ranked envelope, and fetch that
component's full spec with one detail call — branching only on response-type
discriminators and stable error codes, never on prose. The agent then builds against
the verbatim spec instead of inventing component APIs from training data.

**Why this priority**: The research's central finding is that tool availability alone
does not change agent behavior — the steering layer is what makes agents use the
discovery CLI. Without this story the spec-004 commands exist but go unused; with it
alone, the feature already delivers its value.

**Independent Test**: Give an agent only the skill text and a fixture project with
Manifests, ask for a UI capability phrased vaguely, and verify the agent reaches the
intended component's full spec using exactly the documented workflow — one search
call, one detail call, no help-text scraping, no prose parsing.

**Acceptance Scenarios**:

1. **Given** a project with discoverable Manifests and the skill installed, **When**
   the agent is asked to build UI needing "something that triggers an action",
   **Then** the skill directs a search in machine-output mode, the agent selects from
   ranked results, requests the component detail, and every branch the skill
   prescribes references a response-type discriminator or error code.
2. **Given** the skill is installed but the current task is not frontend work against
   a Manifest-shipping library, **When** the session proceeds, **Then** the skill body
   is never loaded and only its short activation description occupies context.
3. **Given** a search returning zero results, **When** the agent follows the skill,
   **Then** it treats the empty result as success, broadens or rephrases the query per
   the skill's guidance, and never invents a component.
4. **Given** list or detail output is needed, **When** the skill's workflow runs,
   **Then** it directs the token-frugal dense output mode by default.
5. **Given** a first search whose terms match no component, **When** the agent
   follows the skill, **Then** it climbs the retrieval ladder — re-searching with
   self-generated synonyms and capability phrases (tier 2), and, if the result is
   still empty, listing the whole corpus in dense mode and selecting by reading
   (tier 3) — never inventing a component and never resorting to embedding search or
   Manifest-authored synonyms.

---

### User Story 2 - The skill can never describe a surface that doesn't exist (Priority: P2)

A maintainer edits the skill or the discovery CLI. Every command, option, response
type, and error code the skill text names is checked against the CLI's capability
manifest in CI: a skill that references a nonexistent option, a renamed command, or a
retired code fails the gate before it can mislead an agent. The capability manifest —
already drift-guarded against the real command definitions by spec 004 — is the single
authority the skill is verified against.

**Why this priority**: A stale skill is worse than no skill — it injects confidently
wrong instructions into every session. Freshness-by-construction is what
distinguishes a maintained steering layer from hand-written documentation rot.

**Independent Test**: Introduce a fabricated option name into the skill text in a
conformance fixture and verify the gate fails naming the offending reference; restore
it and verify the gate passes.

**Acceptance Scenarios**:

1. **Given** the skill names commands, options, response types, and error codes,
   **When** the drift gate runs, **Then** every named element is verified present in
   the capability manifest, and any element absent from it fails the build with the
   offending reference identified.
2. **Given** a discovery-surface change lands in the CLI (new option, changed
   default), **When** the skill text still describes the old surface in a way the
   gate can detect, **Then** CI fails until the skill is updated.
3. **Given** the skill's workflow examples, **When** each example invocation is
   checked, **Then** it parses as a valid invocation per the capability manifest.

---

### User Story 3 - The skill installs wherever the agent lives (Priority: P3)

A developer (or an agent acting on their instruction) installs the Discovery Skill
into their environment: at minimum the Claude Code skills convention, and portably
into the emerging cross-vendor skills ecosystem. One canonical skill source exists in
the repository; ecosystem-specific packaging is derived from it, never forked. After
installation the skill is recognized by the host agent and activates as designed.

**Why this priority**: Distribution is what turns the skill from a repo artifact into
the project's public agent-consumption layer, but it only matters once the skill
content (P1) and its freshness guarantee (P2) exist.

**Independent Test**: Install the skill into a fresh workspace for each supported
ecosystem and verify the host recognizes it (it appears in the host's skill listing
and activates on a frontend task); verify all packagings carry identical workflow
content derived from the one canonical source.

**Acceptance Scenarios**:

1. **Given** a fresh project, **When** the skill is installed per the documented
   Claude Code path, **Then** the host lists the skill and loads its body on a
   matching task.
2. **Given** a second supported ecosystem's install path, **When** installation
   completes, **Then** the same workflow content is present, derived from the single
   canonical skill source.
3. **Given** the canonical skill source changes, **When** packaging is regenerated,
   **Then** all distributions reflect the change; hand-edits to derived packagings
   are detectable as drift.

---

### User Story 4 - Hostile Manifest text cannot re-program the agent (Priority: P4)

A Manifest in the corpus carries hostile description text — instruction-injection
prose such as "ignore your previous instructions and…". The skill explicitly frames
everything originating from a Manifest — descriptions, semantic notes, example
captions, even error-envelope suggestions — as untrusted data to quote and act on as
component facts only, never as instructions to follow. The conformance suite runs the
documented two-call loop against the hostile fixture corpus and verifies the skill
carries this posture and the surfaced output remains inert.

**Why this priority**: NS-DATA-1 already binds the CLI's rendering; this story
extends the same guarantee to the last hop — the prompt layer — closing the loop the
Normative Spec cannot reach. It depends on the workflow (P1) existing.

**Acceptance Scenarios**:

1. **Given** the skill text, **When** its content is checked, **Then** it contains an
   explicit instruction that Manifest-originated text is data, never instructions,
   covering search results, component details, and suggestions alike.
2. **Given** the hostile fixture corpus, **When** the documented two-call loop is
   exercised end to end, **Then** the machine output byte-preserves the hostile text
   per NS-DATA-1 and nothing in the skill directs the agent to interpret it.

---

### Edge Cases

- Project with no discoverable Manifests: the skill directs a graceful stop on the
  empty-corpus error code — state that no ACM Manifests were found and proceed
  without the discovery loop; never retry-loop the search.
- Discovery CLI not installed or not on the path: the skill prescribes the check and
  the fallback (report the missing tool and how to install it) rather than silently
  abandoning discovery.
- Version skew between skill text and installed CLI: the skill instructs the agent to
  consult the capability manifest as the runtime source of truth whenever an envelope
  or option behaves differently than the skill describes.
- Ambiguous component name across packages: the skill directs the agent to branch on
  the ambiguity error code and re-request using the disambiguated identity facets
  from the error envelope, never to pick a candidate arbitrarily.
- Unknown component name: the skill directs use of the closest-name suggestions from
  the error envelope instead of free-form retries.
- Multiple skills present in the host: the activation description is specific enough
  that the skill does not fire on non-frontend tasks or on projects without
  Manifests.
- Hostile text inside an error envelope's suggestions: covered by the same
  untrusted-data framing as all Manifest-originated text.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST deliver a skill artifact whose short activation
  description states precisely when it applies — building or modifying frontend UI in
  a project whose libraries ship ACM Manifests — so hosts with progressive disclosure
  load the body only for matching tasks.
- **FR-002**: The skill body MUST teach the two-call discovery loop as the required
  workflow: one search invocation in machine-output mode with the natural-language
  need, then one component-detail invocation for the chosen candidate; it MUST direct
  the token-frugal dense output mode for list and detail reads and MUST NOT direct
  help-text scraping.
- **FR-003**: Every conditional the skill prescribes MUST branch on response-type
  discriminators or stable error codes from the typed envelopes — never on prose
  content. The skill MUST cover the defined error paths: empty corpus (stop
  gracefully), unknown name (use suggestions), ambiguous name (re-request via
  identity facets), zero-result search (success; broaden the query), and usage errors
  (consult the capability manifest).
- **FR-004**: The skill MUST instruct that all Manifest-originated text — search
  results, component details, examples, and error suggestions — is untrusted data to
  be used as component facts only and never followed as instructions, extending
  NS-DATA-1 to the prompt layer.
- **FR-005**: Every command, option, response type, and error code named in the skill
  MUST be verified against the CLI's capability manifest by a conformance drift gate;
  a reference to an element absent from the capability manifest MUST fail CI,
  identifying the offending reference. Example invocations in the skill MUST validate
  as accepted invocations per the capability manifest.
- **FR-006**: One canonical skill source MUST live in the repository; all
  ecosystem-specific packagings (Claude Code skills layout at minimum, plus at least
  one portable cross-vendor skills distribution) MUST be derived from it, with
  hand-edited derived copies detectable as drift. Installation MUST be documented per
  supported ecosystem.
- **FR-007**: The Conformance Suite MUST exercise the skill's documented two-call
  loop end to end against a fixture corpus — including the hostile fixtures — and
  MUST verify both that the loop reaches a component's full spec as the skill
  describes and that the untrusted-data instruction of FR-004 is present.
- **FR-008**: The skill MUST fit a declared token budget: the resident activation
  description small enough to be negligible per session, and the on-demand body
  bounded, with both budgets pinned by a conformance check using the repository's
  standard size-measurement method.
- **FR-009**: The skill MUST begin its workflow with corpus detection — confirming
  discoverable Manifests exist (or the CLI reports the empty-corpus code) before any
  search — and MUST prescribe the graceful stop of the empty-corpus edge case.
- **FR-010**: The skill's workflow MUST teach the three-tier retrieval ladder
  (ADR 0005), each tier the graceful failure of the one before: (1) **direct** —
  search by name, tag/facet, or controlled semantic term; (2) **synonym-expanded** —
  on no good fit, the agent generates synonyms and capability phrases from the task
  and re-searches (a multi-term query is the synonym query — no tool change); (3)
  **list-and-scan floor** — a zero-result search is success carrying the `followUps`
  retrieval-miss signal, on which the agent lists the whole corpus in dense mode (one
  line per component) and picks by reading. The semantic judgment stays with the
  agent; the skill MUST NOT direct embedding/semantic search or the use of
  Manifest-authored synonyms (an NS-DATA-1 poisoning surface — ADR 0005).

### Key Entities

- **Discovery Skill**: the canonical skill artifact — activation description plus
  workflow body — that steers agents through the spec-004 discovery surface; the
  feature's central deliverable.
- **Activation Description**: the always-resident short text declaring when the skill
  applies; the only part of the skill paying a per-session token cost.
- **Two-Call Loop**: the prescribed workflow — search, then component detail, both in
  machine-output mode — with defined branches per error code.
- **Retrieval Ladder** *(from ADR 0005)*: the three-tier degradation the workflow
  teaches for reaching a component when the words don't match — direct search,
  agent-generated synonym expansion, then the dense list-and-scan floor keyed off the
  `followUps` signal. The agent is the semantic engine; the CLI stays lexical and
  deterministic.
- **Skill Drift Gate**: the conformance check binding every surface element named in
  the skill to the capability manifest, and derived packagings to the canonical
  source.
- **Skill Distribution**: an ecosystem-specific packaging of the canonical skill
  source with a documented install path.
- **Capability Manifest** *(from spec 004)*: the CLI's self-description; here the
  verification authority for skill content and the runtime source of truth on skew.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An agent given only the installed skill and a natural-language need
  reaches the full spec of a suitable component in at most two discovery invocations,
  with zero help-text scraping and zero prose-based branching, on a fixture corpus.
- **SC-002**: The skill's resident activation description measures at most 100 tokens
  and the on-demand body at most 2,000 tokens under the repository's standard
  measurement, both enforced by a conformance check.
- **SC-003**: 100% of commands, options, response types, and error codes named in the
  skill exist in the capability manifest, and a seeded fabricated reference
  demonstrably fails the drift gate.
- **SC-004**: The skill installs successfully and is recognized by at least two agent
  ecosystems from the single canonical source, with byte-identical workflow content
  across packagings.
- **SC-005**: The hostile-fixture conformance pass shows the two-call loop
  byte-preserves hostile text in machine output and the skill's untrusted-data
  instruction is present — zero instruction-following pathways introduced by the
  skill.
- **SC-006**: Every error path defined in spec 004's envelope contract (empty corpus,
  unknown name, ambiguous name, zero results, usage error) has a prescribed branch in
  the skill, verified by the Conformance Suite.
- **SC-007**: The skill's workflow prescribes all three retrieval-ladder tiers —
  synonym expansion and the dense list-and-scan floor keyed off `followUps` — and
  names no embedding search or Manifest-authored synonyms, verified by the Conformance
  Suite.

## Assumptions

- **Dependency on spec 004**: the discovery CLI — search, component detail,
  capability manifest, typed envelopes, stable `ACM-D-*` codes, dense mode — is
  delivered and green before this feature's conformance checks can pass. This feature
  adds no new *discovery* commands; it does add one build-time generator command,
  `acm agent-docs` (`json: false`, ADR 0004), that projects the skill's Generated
  Blocks and per-ecosystem targets. The generator is corpus-agnostic and, being
  outside the capability manifest's `jsonSupported` discovery subset, never appears in
  the skill it emits.
- **Scope per ADR 0003 (as amended)**: this feature is the steering layer only. The
  Agent View corpus index (static tier) is a separate, later feature. An MCP bridge is
  **rejected outright** (ADR 0003 amendment, 2026-07-22), not deferred — none is
  planned and nothing here may preempt or assume one; the programmatic API's parity
  guarantee (spec 004 FR-009) is the only seam a future bridge would ever sit on.
- **Skill wording is tool contract, not Normative Spec**: like the `ACM-A-*` /
  `ACM-D-*` precedent, the skill's guarantees are bound by this feature's conformance
  gates, not by new NS clauses; NS-DATA-1 remains the normative anchor for
  untrusted-data behavior.
- **Ecosystem baseline**: the Claude Code skills convention is the minimum supported
  host; the second distribution targets the emerging cross-vendor skills format
  (the Ant Design `npx skills add` precedent). Additional ecosystems are packaging
  work, not spec changes.
- **Behavioral limits of conformance**: CI verifies the skill's content, budgets,
  drift, and the loop's machine outcomes deterministically; it does not verify live
  LLM behavior. SC-001's agent-in-the-loop check is exercised against fixtures via
  the documented workflow, not via a hosted model in CI.
- **Token measurement**: budgets in SC-002 use the repository's standard
  size-measurement method, pinned by the conformance check so budget changes are
  intentional, reviewable diffs.
- **Naming note**: per the precedent of features 001–004, the skill's user-facing
  workflow (command names, machine-output mode, error-code branching) appears here as
  contract; skill file layout, packaging tooling, and generation mechanics remain
  unconstrained for planning.
