# @xgentic/acm-discovery-skill

The **Discovery Skill**: the steering layer that wires the `acm` discovery CLI
(`search`, `component`, `capabilities`) into AI coding agents as their
component-discovery workflow (ADR 0003/0004, spec 005).

This is the skill's **authoring home**, not a published package. The built skill ships
inside [`@xgentic/acm`](../toolchain/README.md) (as `assets/skill/`), and consumers
install it with one command:

```sh
npx acm init
```

`acm init` detects the project's agent hosts and writes each one's target, byte-identical
to `acm agent-docs --target <name>`.

One canonical source, four packagings — all assembled from the same blocks:

| Target | Path | Installed by |
| --- | --- | --- |
| Claude Code skill (primary) | `generated/targets/claude-skill/acm-discovery/` | `acm init` → `.claude/skills/acm-discovery/SKILL.md` |
| `AGENTS.md` fragment | `generated/targets/AGENTS.fragment.md` | `acm init` → a managed `<!-- acm:skill … -->` region in `AGENTS.md` |
| Editor rules file | `generated/targets/rules/acm-discovery.md` | `acm init` → `.cursor/rules/acm-discovery.md` |
| Cross-vendor skills package | `generated/targets/skills-package/acm-discovery/` | not an `init` target — it is a *source* directory a `skills add`-compatible installer (e.g. `npx skills`) is pointed at |

## How it is built

- `blocks/` holds the **Authored Blocks** — hand-written judgment (when the
  skill applies, the error-path playbook, the NS-DATA-1 untrusted-data
  posture). Edit these.
- `generated/` holds **Generated Blocks** and the per-target packagings,
  projected from the CLI's capability manifest by `acm agent-docs`. Never edit
  these — run `pnpm generate`; staleness and hand-edits fail CI (`pnpm drift`).
- Shared blocks are embedded between `<!-- acm:block … -->` markers and are
  byte-identical across every target, gate-verified.

The skill versions in **lockstep** with `@xgentic/acm` by construction — it ships
inside it: skill `X.Y.Z` describes exactly CLI `X.Y.Z`. At runtime,
`acm capabilities --json` is the source of truth on any skew.
