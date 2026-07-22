# Feature Specification: Component Discovery CLI

**Feature Branch**: `004-component-discovery-cli`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "add a cli tool that will be later used as a tool through
a skill by the agent to find components … tool is like meta astryx, it should help the
agent find specs for components" — accompanied by a reference document describing a
design-system CLI (`acm search`, `acm component`, typed `--json` envelopes with stable
error codes, a self-describing capability manifest, and a programmatic API with
identical data), in which the `docs`, `template`, `upgrade`, and `doctor` commands are
explicitly marked SKIP.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search the manifest corpus for a component (Priority: P1)

An AI agent (or a developer) working in a project needs a UI capability — "something
that triggers an action", "a button", "a date picker" — but does not know what the
component is called or which package provides it. They run a single search command with
a free-text query. The CLI discovers every ACM Manifest reachable from the project,
searches across all component entries, and returns a ranked result list: matches on
component names, identity facets, and controlled semantic terms outrank incidental
mentions in description prose, and near-miss spellings still find their target. Each
result shows the component's name, a one-line description drawn verbatim from the
Manifest, its domain tag, and the exact follow-up command that prints the full spec.

**Why this priority**: Finding the right component from a vague need is the tool's
entire reason to exist — it is the entry point of the agent's discovery loop, and every
other command is a follow-up to a search result. Search alone over discovered Manifests
is a viable MVP.

**Independent Test**: Point the CLI at a project whose dependencies carry ACM Manifests
(or at explicit manifest paths), search for a term matching a known component, and
verify the component appears at the top of the ranked results with a follow-up command
that works when run.

**Acceptance Scenarios**:

1. **Given** a project with discoverable Manifests containing a Button component,
   **When** searching for "button", **Then** Button appears in the results ranked above
   components that merely mention "button" in description prose, each result carries a
   domain tag and a runnable follow-up command, and the result count respects the
   default cap.
2. **Given** a misspelled query ("buttn"), **When** the search runs, **Then** the
   intended component still appears in the top results via fuzzy matching.
3. **Given** a query matching a component's controlled semantic classification but not
   its name, **When** the search runs, **Then** the component is found through its
   semantic term.
4. **Given** a query with no matches, **When** the search runs, **Then** an explicitly
   empty result set is reported as a successful (non-error) outcome.
5. **Given** a result cap option, **When** the search runs, **Then** at most that many
   results are returned; **Given** a detail option, **Then** each result additionally
   shows where the component comes from and why it matched.

---

### User Story 2 - Read one component's full spec (Priority: P2)

Having found a candidate, the agent runs the component command with the component's
name. The CLI prints the component's full spec as recorded in its Manifest: the verbatim
description, identity facets, inputs, events, slots/children, methods, CSS hooks,
module exports, semantic classification, and usage examples. Run without a name, the
same command lists every component in the corpus, at a configurable detail level. A
name that matches nothing fails with a clear message plus closest-name suggestions; a
name that matches several components (same name in different packages or frameworks)
yields a disambiguation list rather than an arbitrary pick.

**Why this priority**: The follow-up half of the discovery loop — search finds the
candidate, this command delivers the spec the agent builds against. Without it, search
results are dead ends.

**Independent Test**: Run the component command for a known component and verify every
API-surface section recorded in the source Manifest appears in the output; run it with
a misspelled name and verify the error carries suggestions; run it with no name and
verify the full corpus is listed.

**Acceptance Scenarios**:

1. **Given** a component present in the corpus, **When** its detail is requested,
   **Then** the output contains every populated section of that component's Manifest
   entry — description, identity facets, inputs, events, slots/children, methods, CSS
   hooks, module exports, semantic classification, and examples — with description text
   verbatim from the Manifest.
2. **Given** no component name, **When** the command runs, **Then** all components in
   the corpus are listed, defaulting to the most compact detail level, with fuller
   levels selectable.
3. **Given** a name matching no component, **When** the command runs, **Then** it fails
   with a stable error code and closest-name suggestions.
4. **Given** the same component name in two different Manifests, **When** its detail is
   requested by bare name, **Then** the CLI presents the candidates disambiguated by
   identity facets and source package instead of silently choosing one, and each
   candidate can be requested unambiguously.

---

### User Story 3 - Consume every command as typed machine output (Priority: P3)

An agent — the feature's primary consumer, later wired in through a skill — invokes any
discovery command with the machine-output option and receives a single typed envelope
on standard output: a response-type discriminator plus the data payload, and nothing
else on that stream. Failures produce an error envelope with a human-readable message,
a stable machine-readable error code to branch on, and, where applicable, suggestions.
The agent branches on discriminators and codes, never on prose, and prose may improve
freely without breaking any consumer.

**Why this priority**: The skill use-case stands or falls on reliable machine output;
it is what turns a human CLI into an agent tool. It layers on P1/P2 without changing
what they compute.

**Independent Test**: Run every discovery command in machine-output mode and verify
standard output parses as exactly one well-formed envelope with a known discriminator;
force each error path and verify every error envelope carries a stable code.

**Acceptance Scenarios**:

1. **Given** any discovery command in machine-output mode, **When** it succeeds,
   **Then** standard output contains exactly one envelope with a response-type
   discriminator and the data payload — no logs, banners, or prompts on that stream —
   and the exit status signals success.
2. **Given** any failure (unknown component, empty corpus, invalid option), **When**
   the command runs in machine-output mode, **Then** the error envelope carries a
   message and a stable error code, suggestions where applicable, and a non-zero exit
   status.
3. **Given** an error whose condition has no specific code, **When** it is reported,
   **Then** it carries the defined fallback code — never an absent code.
4. **Given** a zero-result search in machine-output mode, **When** it completes,
   **Then** it returns a success envelope with an empty result list, not an error.

---

### User Story 4 - Agent self-discovery via the capability manifest (Priority: P4)

Before first use, an agent asks the CLI to describe itself. One command returns a
capability manifest: every discovery command with its arguments, options (types,
choices, defaults), whether it supports machine output, the response types it can
emit, and usage examples. The agent learns the whole surface from a single structured
call — no help-text scraping — and the description is derived from the real command
definitions, so it cannot drift from actual behavior.

**Why this priority**: Self-description is what makes the CLI a first-class agent tool
rather than one that needs hand-maintained documentation in the skill; it depends on
the command surface from P1–P3 existing first.

**Independent Test**: Request the capability manifest and cross-check it against the
actual commands: every command, argument, and option present and accurate; introduce a
hypothetical undescribed command in a conformance check and verify the freshness gate
fails.

**Acceptance Scenarios**:

1. **Given** the CLI is installed, **When** the capability manifest is requested,
   **Then** it enumerates every discovery command with arguments, options (including
   types, choices, and defaults), machine-output support, response types, and at least
   one example per command.
2. **Given** the capability manifest, **When** an agent invokes any command exactly as
   described, **Then** the invocation is accepted and the response carries one of the
   declared response types.
3. **Given** a command surface change without a matching capability description,
   **When** the conformance gates run, **Then** the drift check fails the build.

---

### User Story 5 - Programmatic access with identical data (Priority: P5)

A tool author (or the skill itself, running in-process) imports the discovery
operations as functions instead of spawning the CLI. Each function returns exactly the
data its CLI counterpart emits in machine-output mode; failures raise errors carrying
the same stable codes and suggestions. For consumers that do spawn the CLI, companion
utilities parse, classify, and assert on envelopes so downstream code handles typed
results, not raw text.

**Why this priority**: Parity by construction keeps the two surfaces from diverging
and gives integrators a subprocess-free path; valuable, but only once the command
surface and envelopes exist.

**Independent Test**: For each discovery operation, compare the programmatic result
with the parsed CLI machine output for the same inputs and verify they are identical;
trigger an error both ways and verify the codes match.

**Acceptance Scenarios**:

1. **Given** any discovery operation, **When** invoked programmatically and via the
   CLI in machine-output mode with the same inputs and corpus, **Then** the two
   results are identical.
2. **Given** a failing operation, **When** invoked programmatically, **Then** the
   raised error exposes the same stable code and suggestions the CLI envelope carries.
3. **Given** raw CLI output, **When** passed through the consumer utilities, **Then**
   success and error envelopes are correctly distinguished, and asserting an
   unexpected response type fails explicitly.

---

### Edge Cases

- No Manifests discoverable in the target project: an explicit empty-corpus report
  with its own stable error code — never a silent empty result.
- A discovered file that is not a valid Manifest (unparseable, schema-invalid, or
  exceeding the normative structural limits): a diagnostic names the file and reason,
  the file is excluded, and the rest of the corpus remains searchable.
- Hostile Manifest text (instruction-injection prose, terminal control sequences) in
  any description, semantic note, or example caption surfaced by search or detail
  output: rendered inertly as data — no control-sequence effects on the terminal, no
  content interpreted as instructions, byte-preserved in machine output (NS-DATA-1).
- Two components with the same name in different Manifests: both are listed and
  disambiguated by identity facets and source package; bare-name detail requests never
  silently pick one.
- Two components with the same name inside one source package: the ambiguity report
  disambiguates by module identity facet and its follow-ups resolve at module
  scope — package scoping alone never loops back to the same ambiguity.
- Query strings with regex or glob metacharacters: treated as literal text, never as
  patterns.
- A corpus far larger than the result cap: ranking decides which results appear;
  output reports total match count alongside the capped list.
- Output piped to a file or another process (non-interactive): content identical to
  interactive runs, with no terminal-dependent decoration in machine output.
- Machine-output mode combined with a warning condition (e.g., one skipped invalid
  Manifest): the envelope on standard output stays a single well-formed document;
  diagnostics go to the error stream.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST deliver a search command that queries all component
  entries across the discovered Manifest corpus with free-text input and returns
  ranked results. Ranking MUST place matches on component name, identity facets, and
  controlled semantic terms above matches occurring only in description or example
  prose, and MUST tolerate near-miss spellings (fuzzy matching). Each result MUST
  carry the component name, a one-line description drawn verbatim from the Manifest,
  a domain tag, and the follow-up command that prints the full spec.
- **FR-002**: The search command MUST support: a result cap (default 20), a domain
  filter (rejecting unknown domain values with the list of supported ones), and a
  detail option that adds the component's source (package / Manifest) and the match
  reason to each result. A query with zero matches MUST succeed with an explicitly
  empty result set that carries a `followUps` retrieval-miss signal — runnable next
  commands (e.g. the dense corpus listing), present only on the zero-result envelope —
  as the deterministic cue for an agent's list-and-scan fallback (ADR 0005).
- **FR-003**: The feature MUST deliver a component command that, given a name, prints
  the component's full spec from its Manifest — description, identity facets, inputs,
  events, slots/children, methods, CSS hooks, module exports, semantic
  classification, and usage examples, omitting sections the Manifest does not
  populate — and, given no name, lists every component in the corpus. All text
  originating in the Manifest MUST be reproduced verbatim, never paraphrased or
  summarized.
- **FR-004**: The Manifest corpus MUST be assembled per the spec's Distribution &
  Discovery convention — the `acm` package-metadata field and the defined well-known
  path fallback — across the target project and its installed dependencies, and MUST
  additionally accept explicitly provided manifest paths. Invalid or
  limits-violating files MUST be diagnosed, skipped, and excluded without aborting
  discovery.
- **FR-005**: Every discovery command MUST support a machine-output mode emitting
  exactly one typed envelope on standard output — a response-type discriminator plus
  data on success; a message, stable error code, and optional suggestions on failure —
  with all diagnostics on the error stream and exit status distinguishing success
  from failure. An empty search result is success; an empty corpus and an unknown
  component name are failures with distinct codes.
- **FR-006**: Error codes and response-type discriminators are a public contract under
  the same rule as the existing `ACM-*` diagnostic rule ids: stable, machine-readable,
  never renamed or reused. Every error MUST carry a code, with a defined generic
  fallback code when no specific one applies. Unknown-name errors MUST include
  closest-name suggestions.
- **FR-007**: List views MUST support ordered detail levels — names only < names with
  one-line descriptions < full spec per entry. The component list defaults to the
  most compact level; search results default to the one-line level, since FR-001
  makes the verbatim one-liner part of every search result; single-item views
  default to full. A token-frugal dense output mode MUST be
  available for agent consumption, carrying the same information at materially lower
  size.
- **FR-008**: The feature MUST deliver a capability-manifest command returning a
  self-description of the discovery surface: every command with its arguments,
  options (types, choices, defaults), machine-output support, emittable response
  types, and at least one usage example. The self-description MUST be derived from
  the actual command definitions, with any residual hand-declared facts guarded by a
  conformance drift check so an undescribed command or option fails CI.
- **FR-009**: Every discovery operation MUST be available programmatically as an
  importable function returning data identical to the CLI's machine-output envelope
  for the same inputs, raising errors that carry the same stable codes and
  suggestions. Command handlers MUST be thin wrappers over these functions, and
  per-operation parity MUST be exercised by the Conformance Suite.
- **FR-010**: The feature MUST ship consumer utilities that parse raw CLI output into
  typed envelopes, distinguish success from error, and assert an expected response
  type (failing explicitly on mismatch).
- **FR-011**: All Manifest text MUST be treated as untrusted data end to end: surfaced
  inertly, never interpreted as instructions, with terminal control sequences
  neutralized in human-readable output and content byte-preserved in machine output.
  The Conformance Suite MUST exercise the hostile fixtures through search and detail
  output (NS-DATA-1).
- **FR-012**: Output MUST be deterministic: the same corpus and invocation yield
  byte-identical output across runs and platforms — fully specified ordering,
  deterministic tie-breaking, no timestamps or environment-dependent values.
  Representative outputs MUST be pinned by golden fixtures in the Conformance Suite.

### Key Entities

- **Discovery CLI**: the user- and agent-facing command surface delivered by this
  feature — search, component, and capability-manifest commands joining the existing
  reference CLI; a reference Consumer in conformance terms.
- **Manifest Corpus**: the set of valid Manifests assembled for one invocation via the
  Distribution & Discovery convention plus explicit paths; the universe every query
  runs against.
- **Search Result**: one ranked hit — component name, verbatim one-line description,
  domain tag, follow-up command, and (at higher detail) source and match reason.
- **Component Detail**: the full read-out of one component's Manifest entry; a
  presentation of the Manifest, never a new source of truth.
- **Typed Envelope**: the single machine-output document per invocation — response-type
  discriminator plus data, or message plus stable error code plus optional
  suggestions.
- **Error Code**: a stable, machine-readable failure identifier shared verbatim
  between CLI envelopes and programmatic errors; public contract.
- **Capability Manifest**: the CLI's structured self-description — commands,
  arguments, options, machine-output support, response types, examples — derived from
  the real command definitions and drift-guarded.
- **Programmatic API**: the importable functions mirroring each command with identical
  data, plus the consumer utilities for parsing and asserting on envelopes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Starting from only the capability manifest and a natural-language need,
  an agent reaches the full spec of a suitable component in at most two command
  invocations (one search, one detail), with zero help-text scraping.
- **SC-002**: Over a corpus of at least 100 components, any search completes in under
  one second on a typical developer machine, and queries with a single-character typo
  in a component name place the intended component in the top three results.
- **SC-003**: 100% of machine-output invocations — success and forced-failure paths
  alike — produce exactly one parseable typed envelope, and every failure envelope
  carries a stable error code.
- **SC-004**: Repeated identical invocations over an unchanged corpus produce
  byte-identical output, verified across two platforms in the conformance harness.
- **SC-005**: Hostile-fixture text surfaced through search and detail output produces
  zero terminal control-sequence effects and zero instruction-following, verified by
  Conformance Suite checks.
- **SC-006**: The capability manifest describes 100% of discovery commands, arguments,
  and options, and introducing an undescribed command demonstrably fails the drift
  gate.
- **SC-007**: For every discovery operation, the programmatic result and the parsed
  CLI machine output are identical for identical inputs — exercised per operation in
  the Conformance Suite.
- **SC-008**: For a representative component detail and a full-corpus list, dense mode
  output is at least 40% smaller than the default full output while carrying the same
  information.

## Assumptions

- **Search domains**: v1 searches Components — the only entity the ACM format
  describes today. The reference document's hook, docs-topic, and template domains
  have no ACM counterpart; the result taxonomy (domain tag, domain filter) is shaped
  to admit future domains, but only the component domain is populated in this
  feature.
- **Scope of the reference document**: the commands marked SKIP (`docs`, `template`,
  `upgrade`, `doctor`) are out of scope, and so is `init` — its package-installation
  and theming concerns don't apply to a spec project, and its "AI agent docs" concern
  is the explicitly-later skill feature. This feature delivers the tool and its
  machine contract; wiring it into an agent skill is a follow-up feature.
- **One CLI**: discovery commands join the existing reference `acm` CLI surface
  (alongside validate, compile, canonicalize, agent-view, coverage, drift) rather
  than introducing a second binary. The reference document's backwards-compat shim
  for a bare machine-output invocation does not apply — there is no legacy JSON
  surface to preserve; the standalone capability-manifest command is the one
  self-description entry point.
- **Dense mode and the Agent View**: the token-frugal dense rendering is expected to
  build on the existing Agent View projection for component-level content; it remains
  one-way (ADR 0001) — nothing in this feature parses Agent View output back.
- **Relevance ranking**: the ranking tiers in FR-001 are normative; the precise
  scoring within a tier is not prescribed here — it is pinned by golden fixtures
  (FR-012), making ranking changes intentional, reviewable diffs.
- **Corpus freshness**: the corpus is assembled per invocation from what discovery
  finds at that moment; index caching, watch modes, or daemon processes are
  optimizations left to planning, constrained only by determinism (FR-012).
- **Manifest versions**: the corpus may mix Manifest schema versions; consumers
  resolve capability from each Manifest's self-declared version per the must-ignore
  rule, and unknown fields never break search or detail output.
- **Naming note**: per the precedent set in features 001 and 002, command and option
  names and envelope field names appear here because they are the user-facing
  contract of a developer tool; languages, argument-parsing libraries, search
  algorithms, and package layout remain unconstrained for planning.
