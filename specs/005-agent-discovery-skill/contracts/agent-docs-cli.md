# Contract: `acm agent-docs` command

The steering-layer generator command (R-09 / decision D8). A **public** registry command,
`json: false`, corpus-agnostic and deterministic. It projects the capability manifest ⊕
authored blocks into the per-ecosystem targets. This contract binds its CLI surface;
behavior is gated in `packages/conformance`.

## Registry declaration

| Property | Value |
|---|---|
| name | `agent-docs` |
| `jsonSupported` | `false` (never emits a typed envelope; not in the discovery subset) |
| options | `--target <name>` (enum), `--write` (boolean) |
| examples | `acm agent-docs --target agents-md`, `acm agent-docs --write` |

`--target <name>` choices = the generator's target set: `claude-skill`, `skills-package`,
`agents-md`, `rules`. The enum MUST equal `Object.keys(buildSkillFiles().targets)` (gated,
G3).

## Modes

### 1. Print a target — `acm agent-docs --target <name>`

- **stdout**: the full content of that target's main file (byte-reproducible for the
  installed toolchain version).
- **Unknown target**: exit **2**, stderr `unknown target: <name> (supported: claude-skill, skills-package, agents-md, rules)`.
- Use: emit a context-file variant on demand for a skill-less host; safe anywhere because
  generation is corpus-agnostic.

### 2. Regenerate — `acm agent-docs --write`

- Writes every stale file under `packages/discovery-skill/generated/**` (creating parent
  dirs), then prints `regenerated: <rel paths>` or `fresh` if nothing changed. Exit **0**.
- This is what `pnpm generate` (via `drift --write`) invokes for these artifacts.

### 3. Freshness check — `acm agent-docs` (no flags)

- Compares every generated file to its expected content. If all match: stdout `fresh`,
  exit **0**. If any differ: exit **3**, stderr `stale agent-docs artifacts (run \`pnpm generate\`): <rel paths>`.
- Equivalent coverage is also folded into the repo-wide `acm drift` (drift.ts wires the
  skill files into `checkDrift`), so `pnpm drift` catches skill staleness too.

## Determinism

Output is byte-identical for a given toolchain version: fully specified block order, no
timestamps, no environment values (mirrors spec 004 FR-012). The command reads the
capability manifest in-process (`buildCapabilityManifest()`), never by scraping CLI
output.

## Invariants

- Generated outputs are invariant #1 artifacts — regenerated, never hand-edited.
- The command never reads a consumer Manifest Corpus and never inlines component data (R-07).
- `agent-docs` self-excludes from the skill it emits (`json: false` ⇒ outside the
  `jsonSupported` discovery subset).
