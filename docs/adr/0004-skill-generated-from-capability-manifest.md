# The discovery skill's mechanical content is generated from the capability manifest; only judgment is authored

ADR 0003 chose a skill-wrapped discovery CLI as the primary agent-consumption
surface, and spec 005 requires the skill to never describe a surface that doesn't
exist. Meta's Astryx — the reference model spec 004's command surface was drawn
from — resolves the same freshness problem structurally rather than by detection:
`astryx init --features agents` **generates** the agent context files (`CLAUDE.md`,
`.cursorrules`, `AGENTS.md` — component index, behavioral rules, CLI quick
reference) from the installed version, whose single source is the same
self-description behind `astryx manifest --json`. Generated steering text cannot
name a command the installed CLI lacks; drift is impossible, not merely caught
(Meta — Astryx).

We decided the ACM discovery skill is assembled from two block types with different
rules. **Generated blocks** — the command quick reference, option/default tables,
error-code and response-type listings, and example invocations — are projected
mechanically from the spec-004 capability manifest by the toolchain, regenerated via
the repo's existing `drift --write` flow, and never hand-edited (invariant #1
territory). **Authored blocks** — when discovery applies (activation description),
the two-call loop's decision playbook per error code, and the NS-DATA-1
untrusted-data posture — are hand-written, because they encode judgment no manifest
carries. The drift gate of spec 005 remains, narrowed to what generation cannot
guarantee: authored blocks referencing surface elements, and derived per-ecosystem
packagings matching the canonical source. Ecosystem targets follow Astryx's
precedent — one generator emits the Claude Code skill *and* context-file variants
(`AGENTS.md` fragment, rules files) from the same blocks — but unlike Astryx the
primary target is a progressive-disclosure skill, keeping the resident cost to the
activation description instead of a whole context file.

## Considered Options

| | A. Fully hand-authored skill + CI drift gate | B. Fully generated skill (Astryx `init --features agents`) | C. Generated mechanics + authored judgment, gate as backstop (chosen) |
|---|---|---|---|
| Freshness of command facts | detected after the fact; red CI until fixed | impossible to drift | impossible to drift (generated blocks) |
| Quality of guidance (when/why, error playbook, security posture) | high — deliberate prose | limited — templates can't weigh judgment | high — authored where judgment lives |
| Maintenance cost per CLI change | every change touches skill text | zero | zero for mechanics; authored text only on semantic change |
| Consistency with repo invariants | weak echo of "never hand-edit generated artifacts" | full | full — generated blocks join `pnpm generate` / `pnpm drift` |
| Astryx precedent | no | yes | yes, extended with a skill target it lacks |

- **A — hand-authored + gate only** — rejected: pays permanent maintenance tax and
  makes CI the only thing between agents and stale instructions; the repo already
  rejects hand-maintained parallels of machine truth (constitution principle I,
  AGENTS.md invariant #1).
- **B — fully generated** — rejected: the highest-value skill content is exactly
  what cannot be projected — activation judgment, error-path playbook, the
  untrusted-data posture. Astryx's generated rules are static boilerplate; ACM's
  security posture must be deliberate prose.

## Consequences

- The toolchain gains a generator (planning names it; think `acm agent-docs`) that
  projects capability-manifest facts into skill/context-file blocks; its outputs are
  generated artifacts under invariant #1 — regenerated, never hand-edited, checked
  by `pnpm drift`.
- Spec 005's FR-005/FR-006 are satisfied mostly by construction; the CI gate narrows
  to authored-block references and packaging fidelity. SC-003's seeded-fabrication
  proof now targets an authored block.
- The capability manifest becomes load-bearing for two consumers (agents at runtime,
  the generator at build time) — strengthening spec 004's requirement that it derive
  from the real command definitions.
- Per-ecosystem outputs (Claude Code skill, `AGENTS.md` fragment, editor rules
  files) are one generator with multiple targets, mirroring Astryx; adding an
  ecosystem is a new target, not new content.
- The architecture is recorded in the
  [technical proposal](../proposals/agent-discovery-architecture.md); planning for
  spec 005 binds names and file layout.
