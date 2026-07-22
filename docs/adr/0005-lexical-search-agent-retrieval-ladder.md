# Discovery search stays lexical; the agent is the semantic engine, and Manifests never carry synonyms

ADR 0003 chose a skill-wrapped discovery CLI and rejected embedding search for
v1, but left an unanswered question the moment an agent uses it: an agent needs
"a status indicator" and the corpus calls it a `chip` (semantic term `badge`) —
how does the vague need reach the right Component when the words don't match?
The obvious fixes both fail on inspection. Embedding/semantic search reintroduces
the staleness, infrastructure, and non-determinism ADR 0003 rejected (and would
break the byte-identical output SC-004 gates on two platforms). Per-Component
synonyms in the Manifest format are unbounded, an authoring tax, and — because
Manifest text is untrusted (NS-DATA-1) — an attack surface: a third-party
library could stuff `synonyms: ["button", "everything", "status"]` to hijack
every search (search-result poisoning).

We decided the semantic layer lives **at the agent, not the tool, and not the
format**. `acm search` stays purely lexical, tiered, and deterministic
(golden-pinned). The skill's authored `workflow` block teaches a three-tier
retrieval ladder, each tier the graceful failure of the one before:

1. **Direct** — search by name, tag/facet, or controlled semantic term; the top
   tiers (`name-exact`, `facet-exact`) are the clean handoff when the agent
   already knows the Component.
2. **Synonym-expanded** — no good fit → the agent generates synonyms and
   capability phrases from the task and re-searches. No tool change: `acm
   search` already OR-matches whitespace-split terms, so a multi-term query *is*
   the synonym query.
3. **List-and-scan floor** — a zero-result search is success (`total: 0`) and
   its envelope carries `followUps: ["acm component --dense"]`; the agent lists
   the whole corpus one line per Component (name · tag · one-liner) and picks by
   reading.

The tool ranks and returns at every tier; the semantic judgment — generating the
synonyms and picking the fit from the readout — stays with the agent, where
world knowledge is already free. This is "semantic search" without embeddings.

## Considered Options

| | A. Embedding / semantic search | B. Synonyms in the Manifest format | C. Lexical tool + agent-driven ladder (chosen) |
|---|---|---|---|
| Determinism (SC-004) | no — model/version dependent | yes | yes — golden-pinned |
| Freshness / infra | reindex, infra cost | as authored | none — per-invocation, no index |
| Synonym coverage | broad but fuzzy | whatever each author wrote | the LLM's full world knowledge, per task |
| Untrusted-data posture | n/a | **poisonable** — authored by the party being searched for | safe — no corpus-authored ranking input |
| Cost at scale | infra always-on | authoring tax forever | tier 2 scales; tier 3 floor is cheap ≤ ~few thousand Components |

- **A — embeddings** — rejected (as in ADR 0003): staleness, infrastructure,
  non-determinism, and zero industry uptake for component discovery.
- **B — Manifest-level synonyms** — rejected: unbounded and an authoring tax,
  but disqualifying is NS-DATA-1 — synonyms authored by the library being
  searched for are search-result poisoning. If a curated synonym table is ever
  wanted it belongs in the central controlled vocabulary (bounded, trusted),
  never per-Manifest.

## Consequences

- No schema change: the ladder is skill prose plus one additive envelope field
  (`followUps`, present only on `total: 0`) — the deterministic retrieval-miss
  signal. "Weak but non-zero" stays the agent's judgment; the tool only signals
  the hard empty case (a "weak" threshold would be exactly the non-deterministic
  ranking-internal kept out of contract).
- The dense Component list becomes a first-class surface (name · tag · one-liner
  per line): the tier-3 floor an agent scans on a miss.
- This does **not** subsume the deferred Agent View corpus index (ADR 0003): the
  on-demand `acm component --dense` list serves the *shell* agent's miss, while
  the static index serves *fetch-only / no-shell* consumers — same content
  shape, different consumer.
- The floor is cheap at realistic corpus sizes (~120 Components ≈ 2K tokens);
  tier 2 is the scaler, and the floor would need a cap-with-notice past a few
  thousand Components.
- Architecture recorded in the
  [technical proposal §4.1](../proposals/agent-discovery-architecture.md).
