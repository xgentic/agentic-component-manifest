# Research: Component Discovery CLI

Decisions resolving every open technical question from the Technical Context. No
NEEDS CLARIFICATION markers remain.

## R-01 — Command definition: declarative registry, not a CLI framework

**Decision**: Define every `acm` command as data in a single `registry.ts` — name,
description, positional arguments, options (with type, choices, default), machine-
output support, response types, examples, and handler binding. A generic parser
(`node:util` `parseArgs`, its config generated from the registry) and the dispatch
loop consume the registry; the capability manifest is a pure projection of it. The
six existing commands migrate into the registry with their current flags, exit
codes, and output pinned unchanged by the existing gate suites.

**Rationale**: FR-008 requires the self-description to be "derived from the actual
command definitions" with drift structurally prevented. The reference document
achieves this by deriving from Commander metadata; this repo's equivalent — and
better fit for its schema-first ethos — is to make the definition itself the single
source both the parser and the capability manifest are generated from. The registry
is to the CLI what the schema is to the Manifest. Migrating all commands (not just
the new three) makes the capability manifest complete and makes "an undescribed
command" impossible rather than merely detected. Zero new dependencies.

**Alternatives considered**: Commander (adds the repo's first runtime CLI
dependency, and its metadata still needs the `JSON_SUPPORTED`/`RESPONSE_TYPES`
side-tables the reference document patches on — exactly the drift surface we want
to eliminate); keeping hand-rolled per-command argv handling and hand-writing the
capability manifest (drift-prone by construction, fails FR-008's derivation
requirement); registry covering only the three discovery commands (leaves the
capability manifest incomplete and the drift gate unable to detect a legacy command
growing an undescribed option).

## R-02 — Error codes and response types: `ACM-D-*`, joining the existing contract

**Decision**: Discovery error codes use the repo's diagnostic-id convention with a
new `D` (discovery) namespace: `ACM-D-EMPTY-CORPUS`, `ACM-D-UNKNOWN-COMPONENT`,
`ACM-D-AMBIGUOUS-COMPONENT`, `ACM-D-BAD-MANIFEST`, `ACM-D-USAGE`, and fallback
`ACM-D-UNKNOWN`. Response-type discriminators are dot-namespaced strings:
`search`, `component.list`, `component.detail`, `capabilities`. Both registries live in
`envelope.ts`, are enumerated in [contracts/envelope.md](./contracts/envelope.md),
and fall under AGENTS.md's standing rule: `ACM-*` ids are public contract, never
renamed or reused.

**Rationale**: FR-006 demands the same stability rule as the `ACM-*` ids — using
the same namespace makes that one rule, not two parallel ones, and gives agents a
single code grammar across validation diagnostics and discovery errors. Dot-
namespaced response types follow the reference document and read naturally in a
`switch`.

**Alternatives considered**: the reference document's `ERR_UNKNOWN_COMPONENT` style
(a second, parallel code grammar in the same repo for no benefit); registering the
codes as Normative Spec NS-RULES entries (rejected — NS-RULES registers manifest-
validation rules; these are tool-contract codes, bound by this feature's contracts
and conformance gates, matching the analyzer's `ACM-A-*` precedent).

## R-03 — Corpus assembly and admission

**Decision**: The corpus for one invocation is assembled from, in order: (1) the
target project directory itself (`--project <dir>`, default cwd), (2) every package
directory directly under the project's `node_modules` (including scoped packages),
each resolved through the existing `resolveManifestPath` (NS-DISC-4 order), and
(3) explicitly passed `--manifest <path>` files. Admission is validation-gated:
every candidate file must parse and pass `validateManifest` (which enforces the
NS-LIMIT structural limits) or it is excluded with a diagnostic on stderr.
Skip-vs-diagnose rules: a package with no manifest at all is silently not part of
the corpus; a package whose `acm` field advertises a missing file, or any
unparseable/invalid/over-limit discovered manifest, is a stderr diagnostic (exit
status unaffected); an explicitly passed `--manifest` path that fails admission is
an error (`ACM-D-BAD-MANIFEST`). Corpus order is deterministic: project root, then
packages in lexicographic name order, then explicit paths in argv order.

**Rationale**: NS-DISC-1..5 already define per-package resolution and
`discovery.ts` already implements it — corpus assembly is a loop over it, not new
convention. Enumerating `node_modules` top-level entries is bounded, deterministic,
and needs no dependency-graph traversal; design systems ship manifests in the
packages agents have installed. The silent/diagnostic/error three-way split keeps
noise at zero for the overwhelmingly common manifest-less package while never
hiding a broken advertisement (NS-DISC-4) or a hostile over-limit file.

**Alternatives considered**: resolving only declared dependencies from
`package.json` (misses workspace/hoisted realities, adds graph logic for no
precision gain); recursive `node_modules` traversal (unbounded, slow, and nested
duplicates add nothing); a persistent index/cache or daemon (deferred — SC-002's
1-second budget is met by per-invocation assembly; caching is an optimization the
determinism constraint would complicate).

## R-04 — Search ranking and fuzzy matching

**Decision**: Case-insensitive matching on NFC-normalized text; the query is split
on whitespace into literal tokens (regex/glob metacharacters have no special
meaning). A component matches if at least one token matches; its score is the sum
over tokens of the best-matching tier. Tiers, highest first: name exact > identity-
facet exact (tag name, module + export name, selector) > name prefix > name
substring > name fuzzy > controlled semantic term exact > facet substring >
description/example-caption substring. Fuzzy is Damerau-Levenshtein with a
length-scaled threshold (distance ≤ 1 for tokens ≤ 5 chars, ≤ 2 above), hand-rolled.
Ordering: score descending, then component name ascending (code-point order), then
source package name ascending. The ordinal tier order is contract
([contracts/cli-discovery.md](./contracts/cli-discovery.md)); the numeric weights
are implementation pinned by golden fixtures, so re-tuning is an intentional,
reviewable golden diff (spec assumption "Relevance ranking").

**Rationale**: Implements FR-001's normative tiering (name/facet/semantic above
prose) with typo tolerance (SC-002: single-char typo → top three) while staying
fully deterministic and dependency-free. Sum-of-best-tiers over OR-matched tokens
favors recall — the right default for an agent that will refine via the follow-up
command — and multi-token queries still rank multi-hit components first naturally.

**Alternatives considered**: a fuzzy-search dependency like Fuse.js (unneeded
weight; its floating-point scoring threatens cross-platform byte-determinism);
trigram/BM25-style prose scoring (overkill at corpus scale, harder to pin with
goldens); AND-token semantics (better precision but brittle for agents guessing
vocabulary — the primary user).

## R-05 — Name resolution, disambiguation, and suggestions

**Decision**: `acm component <name>` resolves case-insensitively against component
names across the corpus. Zero matches → `ACM-D-UNKNOWN-COMPONENT` with closest-name
suggestions (same Damerau-Levenshtein machinery, top 3 within threshold, each with
a reason). Multiple matches → `ACM-D-AMBIGUOUS-COMPONENT` with the candidates as
suggestions, each carrying its source package and populated identity facets;
`--from <package>` scopes resolution to one source package and is the documented
disambiguator (echoed in the error's suggested follow-up invocations). Exactly one
match → detail.

**Rationale**: Spec US2-4 forbids silently picking one of several same-named
components; an error envelope with machine-actionable candidates is the shape an
agent can branch on in one step (read code → pick candidate → re-invoke with
`--from`). Reusing the fuzzy machinery keeps one edit-distance definition in the
codebase.

**Alternatives considered**: interactive picker (useless to agents,
non-deterministic for goldens); returning a `component.ambiguous` success envelope
(makes "did I get a detail?" a two-discriminator check on the success path;
error-with-suggestions matches the reference document's pattern agents already
handle); positional `package/Component` syntax (ambiguous with scoped package names
containing `/`).

## R-06 — Detail levels and dense mode

**Decision**: Global `--detail <brief|compact|full>`: list views default to
`brief` (names only, grouped by source package), `compact` adds a one-line verbatim
description, `full` renders complete per-entry detail; single-item views default to
`full`. For `search`, the default is `compact` and `--detail full` adds source
package, matched tier(s), and score. `--dense` is a token-frugal rendering: for
`component <name>`, the entry projected through the existing Agent View emitter
(`agentViewFromValue`) — one-way, per ADR 0001; for list/search views, one line per
entry. SC-008's ≥ 40% size reduction is asserted in the conformance gate by
character count (deterministic), with the existing `gpt-tokenizer` devDependency
used in the same test to report token counts informatively.

**Rationale**: FR-007 fixes the three ordered levels and defaults; mapping dense
component detail onto the Agent View reuses the repo's one already-golden
token-frugal projection instead of inventing a second compressed format (spec
assumption "Dense mode and the Agent View"). Character count keeps the SC-008 gate
byte-deterministic.

**Alternatives considered**: a bespoke dense JSON/abbreviated-key format (a second
compression scheme to maintain and golden, contradicting the Agent View's reason to
exist); making `--dense` a fourth `--detail` level (it is an orthogonal rendering
axis — dense applies at any detail level for lists).

## R-07 — Hostile-text neutralization

**Decision**: All manifest-derived text passes through one sanitizer before human-
readable rendering: C0/C1 control characters (except LF and TAB) and ESC-introduced
sequences (CSI, OSC, DCS, including the raw `\x1b` byte) are replaced with the
Unicode replacement character; text is rendered inertly with no interpretation.
Machine output (`--json`) does NOT sanitize — `JSON.stringify` escapes control
bytes, preserving content byte-faithfully for programmatic consumers. The
conformance gate drives `hostile-pkg` (the injection fixture) through `search` and
`component` in both modes: human output must contain no ESC/C0 byte;
JSON output must round-trip the original text exactly; and the injection prose
appears only inside data fields, never altering envelope structure.

**Rationale**: FR-011 and NS-DATA-1: the terminal is an interpreter, so control
sequences in manifest text are the CLI-surface equivalent of prompt injection —
neutralized at the one rendering choke point. Machine consumers need bytes
preserved (spec: "byte-preserved in machine output"), and JSON string escaping
already makes them inert there.

**Alternatives considered**: stripping (silently deletes data — worse for
debugging than visible replacement); sanitizing JSON output too (violates
byte-preservation and breaks API⇄CLI parity with envelope data); a sanitization
dependency (the character classes involved are a dozen lines).

## R-08 — Programmatic API and parity strategy

**Decision**: `api.ts` exports `search(query, opts)`, `component(name?, opts)`, and
`capabilities()`, each returning exactly the success envelope its CLI
counterpart prints, and throwing `AcmDiscoveryError` (fields: `message`, `code`,
`suggestions?`) mirroring the error envelope. CLI handlers are thin wrappers:
parse argv per registry → call the API function → render (JSON: serialize the
returned envelope; text: render from the same envelope object). `envelope.ts`
exports the consumer utilities `parseResponse`, `isError`, `assertResponse` and the
envelope/code types; `index.ts` re-exports both modules as the toolchain's public
surface. Parity is enforced two ways: structurally (the CLI has no data path that
bypasses the API) and by a per-operation conformance gate that spawns the real CLI
with `--json` and deep-equals stdout against the API result for the same inputs —
including one forced error per code.

**Rationale**: FR-009/FR-010 and SC-007. Deriving text output from the same
envelope object the JSON mode serializes means there is one computation per
operation, making parity a property rather than a test-only promise — the spawn
gate then guards the wrapper seam itself (argv parsing, stream discipline).

**Alternatives considered**: separate render-path implementations for text and
JSON (the exact drift FR-009 exists to prevent); parity via shared unit fixtures
only, without spawning (misses the argv/stdout seam where purity bugs live).

## R-09 — Exit codes and stream discipline

**Decision**: Discovery commands use: `0` success (including a zero-result search
and success-with-skipped-corpus-files), `1` operational failure (unknown component,
ambiguous component, empty corpus, bad explicit manifest), `2` usage error (unknown
command/option/domain value, bad option value). In `--json` mode stdout carries
exactly one envelope and nothing else — all corpus diagnostics and warnings go to
stderr in both modes; usage errors also emit an error envelope (`ACM-D-USAGE`) when
`--json` is present. Text mode keeps stdout for results only.

**Rationale**: FR-005 fixes empty-search-is-success and distinct failure codes;
`2`-for-usage matches the existing `acm` CLI convention so the migrated legacy
commands and new commands agree. Not adopting the analyzer's `3` =
completed-with-warnings keeps the agent contract binary (envelope present or
error), with warnings on stderr where they cannot corrupt parsing.

**Alternatives considered**: exit `3` for skipped-corpus-file warnings (002
analyzer precedent — rejected: a read-only query returning correct results is a
success; agents branch on envelopes, and a non-zero exit on a routine condition
would push skill authors toward ignoring exit codes entirely); silent skipping
without diagnostics (hides NS-DISC-4 breakage).

## R-10 — Normative status: no schema or Normative Spec change

**Decision**: This feature changes neither `acm.schema.json` nor
`normative-spec.md`. The discovery surface is a reference Consumer: NS-DISC governs
how it finds Manifests (already normative, already implemented), NS-LIMIT governs
admission (enforced by the reused validator), NS-DATA-1 governs text handling
(gaining its first CLI-output gates), NS-VIEW governs dense mode (existing
emitter). The CLI's own surfaces — commands, envelopes, codes, capability
manifest — are tool contract, bound by this feature's `contracts/` and enforced in
`packages/conformance`, exactly as 002 handled the analyzer's `ACM-A-*`
diagnostics and CLI contract.

**Rationale**: Constitution I scopes the Normative Spec to format behavior; tool
behavior is governed by contracts + gates (Principle IX). The 002 precedent is
direct.

**Alternatives considered**: adding an NS-CLI section to the Normative Spec
(rejected — would entangle format conformance with one tool's UX; a second tool
implementing discovery differently would not be non-conformant, so these rules are
not format-normative).

## R-11 — Self-description command is `capabilities`, not `manifest`

**Decision**: The self-description command is `acm capabilities`, its envelope
discriminator is `capabilities`, and the programmatic function is
`capabilities()`. The payload concept keeps the descriptive name "capability
manifest" in prose. Decided during `/speckit-analyze` remediation (finding I2,
user decision 2026-07-21).

**Rationale**: In this repository, "Manifest" is the core vocabulary term for the
component document (CONTEXT.md#manifest, AGENTS.md invariant #8) — and this CLI's
entire purpose is finding component Manifests. A command named `acm manifest` that
returns something other than a Manifest is a built-in agent trap and a vocabulary
collision. Reference-parity with the design document that inspired the feature
(which used `acm manifest`) matters less than not overloading the project's most
load-bearing term.

**Alternatives considered**: keeping `manifest` for reference parity (rejected —
the reference CLI had no competing meaning for the word); `describe` (rejected —
vaguer, and `capabilities` matches the payload's name and the spec's
"capability manifest" concept).
