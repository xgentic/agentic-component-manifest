# @acm/discovery-skill

The **Discovery Skill**: the steering layer that wires the `acm` discovery CLI
(`search`, `component`, `capabilities`) into AI coding agents as their
component-discovery workflow (ADR 0003/0004, spec 005).

One canonical source, four packagings — all assembled from the same blocks:

| Target | Path | Install |
| --- | --- | --- |
| Claude Code skill (primary) | `generated/targets/claude-skill/acm-discovery/` | copy or symlink the directory into your project's `.claude/skills/` |
| Cross-vendor skills package | `generated/targets/skills-package/acm-discovery/` | point a `skills add`-compatible installer (e.g. `npx skills`) at this skill directory — it reads the directory's `SKILL.md` |
| `AGENTS.md` fragment | `generated/targets/AGENTS.fragment.md` | paste into your project's `AGENTS.md` (skill-less hosts) |
| Editor rules file | `generated/targets/rules/acm-discovery.md` | drop into your editor's rules location |

## How it is built

- `blocks/` holds the **Authored Blocks** — hand-written judgment (when the
  skill applies, the error-path playbook, the NS-DATA-1 untrusted-data
  posture). Edit these.
- `generated/` holds **Generated Blocks** and the per-target packagings,
  projected from the CLI's capability manifest by `acm agent-docs`. Never edit
  these — run `pnpm generate`; staleness and hand-edits fail CI (`pnpm drift`).
- Shared blocks are embedded between `<!-- acm:block … -->` markers and are
  byte-identical across every target, gate-verified.

This package versions in **lockstep** with `@acm/toolchain`: skill `X.Y.Z`
describes exactly CLI `X.Y.Z`; at runtime, `acm capabilities --json` is the
source of truth on any skew.
