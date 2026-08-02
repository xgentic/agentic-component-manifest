# Technical Proposal: Agent Discovery Architecture

**Status**: Proposed (informative; planning for spec 005 binds names and layout)
**Date**: 2026-07-21
**Decisions**: [ADR 0003](../adr/0003-agent-consumption-layer.md) (layered surface),
[ADR 0004](../adr/0004-skill-generated-from-capability-manifest.md) (generated
mechanics, authored judgment)
**Specs**: [004 — Component Discovery CLI](../../specs/004-component-discovery-cli/spec.md)
(machine contract), [005 — Agent Discovery Skill](../../specs/005-agent-discovery-skill/spec.md)
(steering layer)
**Evidence**: industry research on how design systems expose components to AI agents,
primarily the Meta Astryx reference model
**Tool architecture**: [steering-layer generator](../architecture/steering-layer-generator.md)
— bound design of `acm agent-docs` and `@xgentic/acm-discovery-skill`, with the decision log
of the 2026-07-21 design review

## 1. Reference model

Meta's Astryx is the closest existing implementation of the architecture ACM is
building, and spec 004's command surface was drawn from its reference document. The
mapping, and where ACM deliberately diverges:

| Astryx surface | ACM equivalent | Adopt / adapt / reject |
|---|---|---|
| `astryx search` — one ranked, cross-domain result set | `acm search` (spec 004 FR-001/002), component domain only in v1 | Adopt; domain taxonomy already admits future domains |
| `astryx component <Name>` — docs, props, examples, source | `acm component` (FR-003), verbatim Manifest sections | Adopt; ACM adds verbatim-text rule and ambiguity handling by Identity Facet |
| `--json` envelope `{ type, data }` | Typed Envelope, dot-namespaced response types (`search`, `component.detail`…) | Adopt |
| Append-only `ERR_*` codes, "never branch on prose" | `ACM-D-*` codes joining the existing `ACM-*` public contract | Adapt — one code grammar for the whole repo instead of a second style |
| `astryx manifest --json` self-description | Capability manifest (FR-008), projected from the command registry | Adopt; ACM derives it from the registry rather than gating hand-declared facts |
| `@astryxdesign/cli/api` + `/json` consumer utilities | Programmatic API + consumer utilities (FR-009/010), parity by construction | Adopt |
| `--dense`, `--detail brief\|compact\|full`, `--lang dense` | Dense mode built on the Agent View projection (FR-007, ADR 0001) | Adapt — ACM's dense form is the already-specified Agent View, not a new format |
| `init --features agents` → generated `CLAUDE.md` / `.cursorrules` / `AGENTS.md` | Skill + context-file variants generated from the capability manifest | Adapt per ADR 0004 — generation yes, but primary target is a progressive-disclosure skill, which Astryx lacks |
| Behavioral rules ("no raw divs, tokens not magic values") | Authored blocks: activation judgment, error-path playbook, NS-DATA-1 posture | Adapt — ACM's rules are security-and-workflow judgment, not styling conventions |
| Hosted MCP, exactly two tools: `search(query)`, `get(name)` | — | Reject (decision 2026-07-22, amending ADR 0003): no MCP tier at all — the skill-wrapped CLI is the agent surface, corpora are per-project, and the two-call loop needs only a shell |
| `template`, `docs`, `hook`, `swizzle`, `upgrade`, `doctor` domains | — | Reject for now (spec 004 assumptions); ACM describes components, not one library's product surface |

## 2. Architecture overview

```
                    packages/spec (normative)
  Canonical JSON Manifests ──────────────────────────────┐
        │                                                │
        │  discovery convention (acm field, well-known)  │
        ▼                                                ▼
  ┌─────────────────────────┐                    Agent View emitter
  │  Manifest Corpus         │                    (ADR 0001, one-way)
  │  (assembled per invoke)  │                           │
  └─────────┬───────────────┘                            │
            ▼                                            │
  ┌──────────────────────────────────────────────┐       │
  │  Discovery engine (programmatic API)         │◄──────┘ dense payloads
  │  search · component · capabilities           │
  └───────┬──────────────────────┬───────────────┘
          │ thin wrappers        │ projection
          ▼                      ▼
  ┌───────────────┐      ┌────────────────────┐
  │  acm CLI      │      │ Capability manifest │  ← single self-description
  │  typed        │      └─────────┬──────────┘
  │  envelopes    │                │ build-time generator (ADR 0004)
  └───────┬───────┘                ▼
          │              ┌───────────────────────────────┐
          │              │ Steering layer (one source):  │
          │              │  generated blocks ⊕ authored  │
          │              │  blocks → targets:            │
          │              │  · Claude Code skill (primary)│
          │              │  · cross-vendor skill package │
          │              │  · AGENTS.md fragment / rules │
          │              └───────────────┬───────────────┘
          │                              │ steers
          ▼                              ▼
  ┌─────────────────────────────────────────────┐
  │                 AI agent                     │
  │  two-call loop: search → component (--json)  │
  └─────────────────────────────────────────────┘

  deferred tier: Agent View corpus index (static file for fetch-only
  consumers). No MCP tier — rejected 2026-07-22, amending ADR 0003.
```

## 3. Components

### 3.1 Discovery engine (spec 004 — exists as the machine substrate)

The programmatic functions behind `acm search`, `acm component`, and the capability
manifest, with CLI handlers as thin wrappers (FR-009). Corpus assembled per
invocation via the Distribution & Discovery convention; deterministic, golden-pinned
output (FR-012); all Manifest text untrusted end to end (FR-011). Nothing in this
proposal changes spec 004.

### 3.2 Capability manifest — the load-bearing joint

One artifact, two consumers:

- **Runtime**: agents self-discover the surface (spec 004 US4) instead of scraping
  help text.
- **Build time** (new, ADR 0004): the steering-layer generator projects it into the
  skill's mechanical blocks.

Because spec 004's R-01 derives the capability manifest from the declarative command
registry, both consumers sit on the same truth the parser itself runs on.

### 3.3 Steering-layer generator

A toolchain command (indicative name `acm agent-docs`; planning binds it) that:

1. Reads the capability manifest, selecting the discovery subset via its
   `jsonSupported` list — envelope support is the property the two-call loop
   depends on, and the list is already machine truth (no new registry surface,
   no hand-maintained command list in the generator).
2. Renders **generated blocks**: command quick reference, option/default tables,
   error-code table with one-line meaning each, response-type list, one validated
   example invocation per discovery command.
3. Merges **authored blocks** (source-controlled prose): activation description
   ("building or modifying frontend UI in a project whose libraries ship ACM
   Manifests"), the two-call-loop playbook keyed by error code, the NS-DATA-1
   posture paragraph, corpus-detection preamble.
4. Emits per-target packagings from the same block set:
   - **Claude Code skill** (primary): `SKILL.md` with the activation description as
     frontmatter — resident cost ≈ the description only (spec 005 SC-002).
   - **Cross-vendor skill package**: the emerging `skills add` distribution
     (Ant Design precedent).
   - **Context-file variants** (Astryx parity, for skill-less hosts): an `AGENTS.md`
     fragment and editor rules files carrying the same blocks.

The steering layer lives in a dedicated workspace package,
`packages/discovery-skill`: authored blocks and the merge layout as source, the
per-target packagings as committed generated artifacts. The generator itself remains
a toolchain command; `packages/discovery-skill` is the product artifact it writes
into, published separately for the cross-vendor `skills add` path — in lockstep
with the toolchain version: every toolchain release publishes both packages under
the same version, so "which CLI does this skill describe" answers itself and no
compatibility matrix ever exists. Generated outputs
are generated artifacts in the invariant #1 sense: regenerated by `pnpm generate`,
checked by `pnpm drift`, never hand-edited.

The generator is **corpus-agnostic by design rule**, not merely by default: it runs
at ACM build time, where no consumer corpus exists, and never emits per-project
component indexes — the corpus is what `acm search` is for. This is what makes the
§5 guarantee (hostile Manifest text cannot ride into resident context via
generation) structural rather than behavioral; a consumer-side index mode would be
a different product with a different security surface, and is rejected.

### 3.4 Conformance strategy (what gates what)

| Property | Mechanism |
|---|---|
| Mechanical skill content matches CLI surface | By construction — generated from the capability manifest; `pnpm drift` catches stale outputs |
| Authored blocks name only real surface elements | Grammar sweep over ALL authored text (backticked or not) for distinctively-shaped tokens — `acm <word>` invocations, `--flag` options, `ACM-D-*` codes, dot-namespaced response types — each verified against the capability manifest; backticked bare surface names (e.g. `search`) verified too, and bare-word response types must be backticked by convention (spec 005 FR-005; seeded-fabrication proof per SC-003) |
| Packagings match the canonical source | Targets embed shared blocks between generated HTML-comment markers; whole-file `pnpm drift` catches hand-edits and staleness, and the SC-004 check extracts marked regions from every target and byte-compares them to the canonical block files — independent of generator internals (spec 005 FR-006/SC-004) |
| Two-call loop works as documented | Conformance test drives the documented loop against the fixture corpus, including hostile fixtures; asserts envelope types and the NS-DATA-1 instruction's presence (FR-007/SC-005) |
| Token budgets hold | Size check on frontmatter (≤ 100 tokens) and body (≤ 2,000 tokens) under the repo-standard gauge `ceil(UTF-8 bytes / 4)` — 400-byte frontmatter, 8,000-byte body (SC-002) |
| Every envelope error path has a prescribed branch | Cross-check of the playbook's code coverage against the `ACM-D-*` registry (SC-006) |

### 3.5 Deferred and rejected tiers

- **`acm mcp` — rejected** (2026-07-22, amending ADR 0003's "deferred" stance):
  there will be no MCP tier. The skill-wrapped CLI is the complete agent surface;
  a Manifest Corpus is a property of a project, the two-call loop needs only a
  shell, and the resident-schema cost MCP servers impose is the very thing this
  architecture exists to avoid. Should the need ever return, the programmatic API
  (FR-009 parity) remains the seam a bridge would sit on — but none is planned.
- **Agent View corpus index** (deferred): a static, one-line-per-component projection (name,
  Identity Facets, verbatim one-liner, domain tag) linking to per-component Agent
  Views — the Nord-style ~5K-token tier for fetch-only consumers. One-way per
  ADR 0001; a future emitter feature. Note it is **not** subsumed by the tier-3
  list-and-scan floor (§4.1): the on-demand `acm component --dense` list serves
  the *shell* agent's retrieval miss, while this static index serves the
  *fetch-only / no-shell* consumer — same content shape, different consumer.

## 4. Agent session walkthrough (token accounting)

1. **Session start** — resident: the skill's activation description (≤ 100 tokens).
   Astryx's equivalent (a full generated `CLAUDE.md`) is resident in its entirety;
   the skill target is the deliberate divergence.
2. **Frontend task appears** — host loads the skill body (≤ 2,000 tokens): workflow,
   quick reference, playbook, security posture.
3. **Corpus check** — the skill's preamble step; empty corpus → graceful stop on
   `ACM-D-EMPTY-CORPUS`.
4. **Call 1**: `acm search "<need>" --json` (dense default) → ranked candidates,
   each with verbatim one-liner and follow-up command.
5. **Call 2**: `acm component <name> --json` → full spec, Agent-View-dense; on
   `ACM-D-UNKNOWN-COMPONENT` use envelope suggestions; on
   `ACM-D-AMBIGUOUS-COMPONENT` re-request by Identity Facet.
6. **Build** — the agent codes against the verbatim spec; Manifest text is data,
   never instructions.

Worst-case discovery overhead per session ≈ activation description + body + two
envelopes — versus 10K–55K resident tokens for an MCP-server-primary design
(research §2) or a resident full context file (Astryx's default).

### 4.1 Retrieval ladder — the agent is the semantic engine (amendment, 2026-07-22)

Search is deliberately lexical and deterministic (ADR 0003 rejected
embeddings). Synonymy — "status" should reach a chip/badge — is resolved **at
the agent layer, not the tool**, and **not by adding synonyms to the Manifest
format** (unbounded, an authoring tax, and NS-DATA-1 attack surface: a
third-party library could stuff synonyms to poison search). The skill's
`workflow` block teaches a three-tier degradation, each tier the graceful
failure of the one before:

1. **Direct** — search by name, tag/facet, or controlled semantic term. The
   top tiers (`name-exact`, `facet-exact`) are the clean handoff for an agent
   that already knows the component.
2. **Synonym-expanded** — no good fit → the agent generates synonyms and
   capability phrases from the task and re-searches. No tool change: `acm
   search` already OR-matches whitespace-split terms, so a multi-term query is
   the synonym query.
3. **List-and-scan floor** — a zero-result search is success (`total: 0`) and
   its envelope carries `followUps: ["acm component --dense"]`. The agent lists
   the whole corpus (one line per component: name · tag · one-liner) and picks
   by reading. At realistic corpus sizes (~120 components ≈ 2K tokens) the whole
   haystack is cheaper to scan than any embedding index; tier 2 is the scaler
   for larger corpora, and the floor would need a cap-with-notice past a few
   thousand components.

The tool ranks and returns at every tier; the semantic judgment — generating
the synonyms, and picking the fit from the readout — stays with the agent,
where world knowledge is already free. This is "semantic search" without
embeddings: the LLM is the semantic engine, the CLI stays deterministic and
golden-pinned.

## 5. Security posture

NS-DATA-1 applies at every hop: the engine byte-preserves hostile text in machine
output and neutralizes control sequences in human output (spec 004 FR-011); the
skill's authored block extends the same rule to the prompt layer — all
Manifest-originated text, including error-envelope suggestions, is component fact,
never instruction (spec 005 FR-004). The generator itself never embeds corpus
content into the skill (the skill teaches retrieval; it does not inline component
data), so hostile Manifest text cannot ride into resident context via generation.

## 6. Phasing

1. **Now**: spec 004 implementation (engine, CLI, capability manifest).
2. **Next**: spec 005 planning binds generator name, block layout, target set;
   implement generator + authored blocks + gates.
3. **Then**: Agent View corpus index emitter (small feature). No further tiers:
   the MCP bridge is rejected (§3.5).

## 7. Open questions — resolved

All open questions from the original draft were closed in the 2026-07-21 design
review: the generator stays corpus-agnostic (§3.3), packaging follows toolchain
releases in lockstep (§3.3), and SC-002's token gauge is the bytes-based
approximation `ceil(UTF-8 bytes / 4)` (§3.4). The full decision log, including the
bindings spec 005 planning inherits, lives in the
[steering-layer generator architecture](../architecture/steering-layer-generator.md).
