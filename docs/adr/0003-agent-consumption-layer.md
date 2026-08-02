# Agents consume manifests through a skill-wrapped discovery CLI, with MCP and static files as derived tiers

An agent building frontend UI must find the right Component from the Manifest corpus
before it can use one — and how it retrieves that information decides token cost,
freshness, and hallucination resistance. An industry survey of ~30 design systems
shows every mature implementation (Ant Design, shadcn/ui, Storybook, Figma, IBM
Carbon) converging on the same layered shape: a derived static index as substrate, a
local CLI querying it, MCP added later as a thin bridge over the same data, and a
skill/rules layer steering the agent — because measured MCP tool schemas cost
10K–55K resident tokens per server, while a skill idles at a few dozen, and tool
availability alone demonstrably does not make agents use a tool.

We decided: the primary agent-consumption surface is the **discovery CLI of spec 004
(`acm search` / `acm component` / capability manifest) wrapped in an agent skill**.
The skill teaches the two-call loop (search → detail), declares when discovery
applies, and carries the NS-DATA-1 posture into the prompt layer. An **Agent View
corpus index** (a static, one-line-per-component projection) is the zero-tooling
tier, and an **`acm mcp` subcommand** — a thin bridge over the same programmatic API
(FR-009 parity) — is deferred until the skill exists. Semantic/embedding search is
rejected for v1: lexical + fuzzy + ranked matches the evidence (grep-beats-embeddings)
and zero surveyed systems shipped embeddings for components.

## Considered Options

| | A. MCP server as primary | B. Static context files only | C. Skill-wrapped CLI, layered (chosen) | D. Embedding search service |
|---|---|---|---|---|
| Resident token cost | 10K–55K per server, always | ~0 (pointers) or huge (inlined) | few dozen (skill frontmatter) | ~0, but infra instead |
| Freshness | live | as published | as installed corpus, versioned | stale per commit; reindex |
| Hallucination resistance | high (tool-mediated) | medium — pull-based, agents skip fetching | high — typed envelopes, verbatim Manifest text, skill enforces the loop | medium — fuzzy semantic hits |
| Portability | high (cross-client standard) | high (plain HTTP/files) | high — any agent with a shell; skills format spreading | low — bespoke |
| Offline / air-gapped | depends | no | yes | yes |
| Determinism (FR-012) | per server | yes | yes — golden-fixture-pinned | no — model/version dependent |
| Fails when | no client config; token budget blown | agent never pulls; fragile `@`-refs | no sandboxed shell; very weak models | corpus drifts; infra cost |
| Industry evidence | chosen as *bridge*, never as store | Nord (documented UX fragility) | Ant Design (CLI → `antd mcp` → skill), shadcn | none shipped |

- **A — MCP-server-primary** — rejected as primary: resident tool-schema cost
  contradicts the token-frugality premise; every surveyed system that ships MCP ships
  it as a wrapper over a CLI/registry substrate, not as the source of truth. Kept as
  a deferred thin bridge for shell-less clients and weaker models.
- **B — static context files only** — rejected as sole surface: pull-based context is
  routinely ignored by agents, and the one static-only system surveyed (Nord)
  documents the integration fragility. Kept as the cheapest tier via the corpus
  index, which is a mechanical Canonical JSON projection (one-way, per ADR 0001).
- **D — embedding/semantic search** — rejected for v1: staleness and infrastructure
  with no industry uptake; spec 004's ranked lexical + fuzzy search covers the
  vague-need-to-component path.

## Consequences

- Spec 004 ships as designed; its typed envelopes, stable `ACM-D-*` codes, and
  capability manifest are the machine contract every other tier reuses.
- The next feature is the discovery skill: a SKILL.md whose instructions are
  drift-gated against the capability manifest, so the skill can never describe
  commands that don't exist.
- The Agent View corpus index becomes a planned emitter feature; `acm mcp` follows
  only after the skill, mapping tools 1:1 onto the existing programmatic API.
- Ranking quality and dense-mode output are agent-facing contract surfaces, pinned by
  golden fixtures — changes are intentional, reviewable diffs.
- Manifest text stays untrusted data end to end (NS-DATA-1): the skill instructs
  agents to treat descriptions as data, and every surface renders hostile text
  inertly.

## Amendment (2026-07-22)

The rejection of embedding search left open how a vague need reaches the right
Component when the words don't match; that is resolved by
[ADR 0005](0005-lexical-search-agent-retrieval-ladder.md) (lexical tool + agent
as the semantic engine + no synonyms in the Manifest format).

The `acm mcp` bridge is **rejected outright**, not deferred. With the discovery
CLI and the Discovery Skill implemented, the two-call loop needs only a shell;
an MCP tier would reintroduce the resident tool-schema cost this decision was
made to avoid, for no consumer that the skill and the (still-planned) Agent View
corpus index do not already serve. The programmatic API's parity guarantee
(spec 004 FR-009) remains the seam any future bridge would sit on, but none is
planned and none should be assumed by later features.
