# Phase 0 Research: Agent Discovery Skill

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-22

## Method

This feature's design was resolved ahead of planning in a recorded design review
(2026-07-21) and three ADRs; there are **no open `NEEDS CLARIFICATION` items** in the
plan's Technical Context. Phase 0 therefore *consolidates* already-bound decisions into
the Decision / Rationale / Alternatives format rather than dispatching new research. Each
entry cites its binding source; the authoritative decision log is
[architecture §9 (D1–D8)](../../docs/architecture/steering-layer-generator.md#9-decision-log-design-review-2026-07-21)
and the [agent-discovery proposal](../../docs/proposals/agent-discovery-architecture.md),
grounded in the industry survey
([research](../../docs/research/component-discovery-for-agents.md), Meta Astryx reference).

## Decisions

### R-01 — Generated mechanics + authored judgment (not fully-authored, not fully-generated)

- **Decision**: The skill is two block sets: *Generated Blocks* projected mechanically
  from the spec-004 capability manifest, and *Authored Blocks* of hand-written judgment.
  The drift gate narrows to authored-reference verification + packaging fidelity.
- **Rationale**: The highest-value content (when discovery applies, the error playbook,
  the NS-DATA-1 posture) is judgment no manifest carries; the mechanical content
  (commands, options, codes) must never drift. Splitting by block type gets both.
- **Alternatives**: (A) fully hand-authored + CI drift gate — permanent maintenance tax,
  CI the only thing between agents and stale text; (B) fully generated (Astryx `init
  --features agents`) — can't express judgment. Both rejected — [ADR 0004](../../docs/adr/0004-skill-generated-from-capability-manifest.md).

### R-02 — Discovery subset = the capability manifest's `jsonSupported` list (D1)

- **Decision**: The commands the skill describes are exactly those in `jsonSupported`
  (today `search`, `component`, `capabilities`) — not a hand-maintained list.
- **Rationale**: Envelope support is precisely the property the two-call loop needs, and
  the list is already machine truth. `agent-docs` is `json: false`, so it self-excludes.
- **Alternatives**: a curated command list in the generator — rejected as a second
  source of truth that could drift.

### R-03 / R-04 — Dedicated package (D2), version lockstep (D3)

- **Decision**: The steering layer lives in `@acm/discovery-skill`, versioned in
  lockstep with `@xgentic/acm` — every toolchain release publishes both at the same
  version.
- **Rationale**: A clean `skills add` publishing unit, separated from the tool that
  writes it; lockstep means "which CLI does this skill describe" answers itself and no
  compatibility matrix ever exists.
- **Alternatives**: emit into `packages/toolchain` or an independent version line —
  rejected (mixes tool and product; reintroduces a skew question).

### R-05 — Packaging fidelity via block markers + whole-file drift + region byte-compare (D4)

- **Decision**: Every shared block is embedded between `<!-- acm:block id -->` /
  `<!-- /acm:block id -->` markers; the SC-004 gate extracts marked regions from each
  target and byte-compares to the canonical block file. Whole-file `pnpm drift` remains
  the primary staleness gate.
- **Rationale**: Verifies the "byte-identical across packagings" property without
  trusting generator internals; markers are invisible in markdown and inert in rules
  files. The one exception (`activation` → SKILL.md frontmatter, which can't carry a
  comment) is gated by comparing the frontmatter value directly.
- **Alternatives**: trust the generator / diff whole files only — rejected (couldn't
  localize a fidelity break to a block).

### R-06 — Authored-reference detection by grammar sweep (D5)

- **Decision**: A sweep over ALL authored text (backticked or not) extracts
  distinctively-shaped tokens — `acm <word>` invocations, `--flag` options, `ACM-D-*`
  codes, dot-namespaced response types — and verifies each against the capability
  manifest.
- **Rationale**: Catches the unmarked, sloppy reference an author drops in prose; false
  positives are rare and cheap to reword.
- **Alternatives**: check only backticked spans — rejected (misses the common case where
  an author writes a bare `--flag` in prose).

### R-07 — Corpus-agnostic generation as a design rule, not a default (D6)

- **Decision**: The generator never reads a consumer Manifest Corpus and never inlines
  component data; it runs at ACM build time where no corpus exists.
- **Rationale**: Makes the guarantee "hostile Manifest text cannot ride into resident
  context via generation" *structural* rather than behavioral. The skill teaches
  retrieval; it does not embed component facts.
- **Alternatives**: a consumer-side index mode — rejected as a different product with a
  different security surface (§8).

### R-08 — Token gauge `ceil(UTF-8 bytes / 4)`, budgets 400 / 8,000 bytes (D7)

- **Decision**: Budgets measured by a dependency-free byte-based approximation; activation
  ≤ 400 bytes (≈ 100 tokens), SKILL.md body ≤ 8,000 bytes (≈ 2,000 tokens), markers
  included.
- **Rationale**: The skill targets multiple hosts, so no single vendor's tokenizer is
  "correct"; a bloat guardrail needs determinism, not precision. Also keeps frontmatter
  under Claude Code's 1024-char description limit.
- **Alternatives**: a real tokenizer dependency — rejected (vendor-specific, adds a dep
  for a guardrail that doesn't need precision).

### R-09 — Generator command `acm agent-docs`, public, `json: false` (D8)

- **Decision**: The generator is a public registry command named `agent-docs`,
  corpus-agnostic and deterministic, so public exposure is safe and useful for emitting
  context-file variants; it declares `json: false`.
- **Rationale**: Determinism + corpus-agnosticism make the command reproducible anywhere;
  `json: false` keeps it out of the discovery subset it describes.
- **Alternatives**: keep generation repo-private (pnpm-only) — rejected (the `AGENTS.md`
  fragment / rules variants are useful to emit on demand for skill-less hosts).

### R-10 — Retrieval stays lexical; the agent is the semantic engine (ADR 0005)

- **Decision**: `acm search` stays lexical, tiered, deterministic. The skill's workflow
  teaches a three-tier ladder — direct → agent-generated synonym expansion → dense
  list-and-scan floor (keyed off the additive `followUps` signal on `total: 0`).
- **Rationale**: Puts synonymy where world knowledge is already free (the agent) without
  embeddings (staleness, infra, non-determinism — would break byte-identical output) and
  without Manifest-authored synonyms (an NS-DATA-1 search-poisoning surface).
- **Alternatives**: (A) embedding/semantic search; (B) synonyms in the Manifest format —
  both rejected — [ADR 0005](../../docs/adr/0005-lexical-search-agent-retrieval-ladder.md).

### R-11 — No MCP tier (ADR 0003 amendment, 2026-07-22)

- **Decision**: An `acm mcp` bridge is rejected outright, not deferred. The skill-wrapped
  CLI is the complete agent surface; the two-call loop needs only a shell.
- **Rationale**: An MCP tier reintroduces the 10K–55K resident tool-schema cost this
  architecture exists to avoid, for no consumer the skill + (deferred) Agent View corpus
  index don't already serve. The programmatic API's FR-009 parity remains the only seam a
  future bridge would sit on.
- **Alternatives**: deferred MCP bridge (the pre-amendment stance) — superseded.

### R-12 — Four targets from one block set

- **Decision**: `claude-skill` (primary), `skills-package` (cross-vendor `skills add`),
  `agents-md` fragment, and editor `rules` — all assembled from the same ordered blocks;
  the two skill packagings are byte-identical files.
- **Rationale**: Astryx precedent extended with a progressive-disclosure skill it lacks;
  adding an ecosystem is a new target layout, never new content.
- **Alternatives**: skill-only — rejected (skill-less hosts need the context-file
  variants). The cross-vendor layout is validated against the live installer at
  implementation time (the one item [architecture §10](../../docs/architecture/steering-layer-generator.md#10-left-to-spec-005-planning) left open — task T017).

## Unresolved

None. No `NEEDS CLARIFICATION` remained after the 2026-07-21 review; the single
implementation-time verification (cross-vendor `skills add` layout) is tracked as task
T017, not a design unknown.
