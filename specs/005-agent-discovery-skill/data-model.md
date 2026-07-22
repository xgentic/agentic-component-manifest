# Phase 1 Data Model: Agent Discovery Skill

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-07-22

This feature has no persisted or wire data model — it is a build-time projection. The
"entities" below are the in-memory structures the generator (`agent-docs.ts`) assembles
and the file artifacts it emits. Field names match the implementation.

## Block

The atomic unit of steering content. Every steering-layer output is an ordered
concatenation of Blocks from exactly two kinds.

| Field | Type | Notes |
|---|---|---|
| `id` | `BlockId` | stable identifier; one of the 11 declared ids |
| `kind` | `authored \| generated` | authored = hand-edited prose; generated = projected |
| `content` | string | markdown; trimmed; embedded between markers in targets |

**`BlockId`** = `AUTHORED_BLOCK_IDS ∪ GENERATED_BLOCK_IDS`.

### Authored Blocks (6) — source-controlled prose in `blocks/*.md`

| id | Purpose | Requirement |
|---|---|---|
| `activation` | when discovery applies; becomes SKILL.md frontmatter `description` | FR-001 |
| `corpus-preamble` | corpus detection first; empty-corpus stop; CLI-missing fallback | FR-009 |
| `workflow` | the two-call loop + the three-tier retrieval ladder; dense default; no help-scraping; branch on codes not prose | FR-002 / FR-003 / FR-010 |
| `error-playbook` | one prescribed branch per `ACM-D-*` code | FR-003 |
| `security-posture` | NS-DATA-1 at the prompt layer, incl. error-envelope suggestions | FR-004 |
| `runtime-truth` | on skew, `acm capabilities` is the runtime source of truth | Edge case: version skew |

**Rule**: `blocks/` contains exactly these six `*.md` files (`checkBlockInventory`); a
missing or extra file fails the gate.

### Generated Blocks (5) — `generated/blocks/*.md`, invariant #1

Each has a **single** capability-manifest source field, so drift is structurally
impossible:

| id | Capability Manifest source |
|---|---|
| `quick-reference` | `commands[]` (discovery subset) — name, description, usage |
| `option-tables` | `commands[].options` + discovery-relevant `globalOptions` |
| `examples` | `commands[].examples[0]` (non-empty per spec-004 drift gate) |
| `error-codes` | `errorCodes[]` — code + description |
| `response-types` | `responseTypes` for the projected commands |

**Discovery subset**: `commands.filter(c => jsonSupported.includes(c.name))` — today
`search`, `component`, `capabilities` (R-02).

## Body order

`BODY_BLOCK_ORDER` (shared by every target, architecture §6):

```
corpus-preamble → workflow → quick-reference → option-tables → examples
→ error-codes → error-playbook → response-types → security-posture → runtime-truth
```

`activation` is not in the body — it is the frontmatter `description` (and the heading
value for context-file variants).

## Marker grammar

Every block in a target is wrapped:

```
<!-- acm:block <id> -->
<trimmed content, byte-identical across targets>
<!-- /acm:block <id> -->
```

`extractBlocks(target)` parses these regions back into a `Map<id, content>` for the
fidelity gate (G3). Comments are invisible in markdown and inert in rules files.

## Target

An ecosystem packaging: shared blocks + packaging chrome.

| Field | Type | Notes |
|---|---|---|
| `name` | string | `--target` value; one of the four |
| main file | REPO_ROOT-relative path | what `--target <name>` prints |

| Target `name` | Main file | Chrome |
|---|---|---|
| `claude-skill` | `generated/targets/claude-skill/acm-discovery/SKILL.md` | frontmatter (`name`, `description`=`activation`) + body |
| `skills-package` | `generated/targets/skills-package/acm-discovery/SKILL.md` | **byte-identical** to `claude-skill` |
| `agents-md` | `generated/targets/AGENTS.fragment.md` | one heading + body |
| `rules` | `generated/targets/rules/acm-discovery.md` | do-not-edit banner + body |

## SkillFiles (generator output)

`buildSkillFiles(cap)` → `{ files, targets }`:

| Field | Type | Notes |
|---|---|---|
| `files` | `Array<[relPath, content]>` | the 5 generated block files + 4 target files; the drift/`--write` unit |
| `targets` | `Record<name, relPath>` | `--target` name → its main file path |

## CapabilityManifest (consumed, from spec 004)

Read in-process via `buildCapabilityManifest()` (FR-009 parity). Fields this feature
depends on: `commands[]` (name, description, arguments, options, examples,
responseTypes), `globalOptions[]` (flag, type, choices, default, appliesTo),
`errorCodes[]` (code, description), `responseTypes`, `jsonSupported`. This feature never
mutates it.

## Token budget (measurement model)

Gauge `gauge(text) = ceil(byteLength(text, "utf8") / 4)` (R-08). Constraints:

| Quantity | Limit |
|---|---|
| activation description (frontmatter value) | ≤ 100 tokens (400 bytes) |
| SKILL.md body (markers included) | ≤ 2,000 tokens (8,000 bytes) |

## Validation rules (enforced by gates → [contracts/conformance-gates.md](./contracts/conformance-gates.md))

- Authored blocks reference only real surface elements (grammar sweep) — FR-005.
- `blocks/` inventory is exactly the six declared ids — FR-005.
- Each target's marked regions byte-equal the canonical blocks; the two skill packagings
  are byte-identical; SKILL.md `description` equals `activation` — FR-006 / SC-004.
- `error-playbook` names 100% of `ACM-D-*` codes — SC-006.
- Budgets hold — FR-008 / SC-002.
