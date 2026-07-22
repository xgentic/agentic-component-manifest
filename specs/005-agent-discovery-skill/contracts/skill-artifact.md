# Contract: Skill artifact format

Binds the shape of the emitted steering-layer artifacts — the interface agents and
ecosystem installers consume. Structure detail lives in
[data-model.md](../data-model.md); this contract fixes the guarantees.

## Canonical source

One block set is authoritative: the six Authored Blocks (`blocks/*.md`) and the five
Generated Blocks (projected from the capability manifest). Every target is an ordered
concatenation of these blocks in `BODY_BLOCK_ORDER`, plus per-target chrome. No target
carries content absent from the canonical blocks (FR-006).

## Claude Code skill (primary target)

`generated/targets/claude-skill/acm-discovery/SKILL.md`:

```
---
name: acm-discovery
description: <the activation block, single-line form>
---

<do-not-edit banner>

<!-- acm:block corpus-preamble --> … <!-- /acm:block corpus-preamble -->

<!-- acm:block workflow --> … <!-- /acm:block workflow -->
… (BODY_BLOCK_ORDER) …
<!-- acm:block runtime-truth --> … <!-- /acm:block runtime-truth -->
```

Guarantees:

- The frontmatter `description` value EQUALS `blocks/activation.md` (single-line form) —
  gated directly, since frontmatter can't carry a marker (G3).
- Body block ids appear exactly in `BODY_BLOCK_ORDER`, no more, no fewer (G3).
- `description` ≤ 100 tokens; body ≤ 2,000 tokens under `ceil(bytes/4)` (G5 / SC-002).

## Other targets

- `skills-package/acm-discovery/SKILL.md` — **byte-identical** to the Claude Code
  SKILL.md (the cross-vendor `skills add` unit). Layout validated (2026-07-22, T017)
  against the live `npx skills` installer (`vercel-labs/skills`, formerly
  `antfu/skills-cli`; the tool behind Ant Design's `npx skills add`): a skill is a
  directory holding a `SKILL.md` with `name` (lowercase-hyphen) + single-line
  `description` frontmatter, installed via the installer's direct-path form (the path
  the README documents). No top-level registry/manifest is required, so no
  packaging-chrome change was needed.
- `AGENTS.fragment.md` — one heading + the shared body blocks; for pasting into a
  project's `AGENTS.md` (skill-less hosts).
- `rules/acm-discovery.md` — banner + shared body blocks; for an editor's rules location.

## Fidelity guarantee (FR-006 / SC-004)

For every target, the content between each `<!-- acm:block id -->` / `<!-- /acm:block id -->`
pair is **byte-identical** to the canonical block (authored file, trimmed, or generated
block). Verified by extracting marked regions and byte-comparing — independent of
generator internals. Hand-edits to any generated file are drift (`pnpm drift` fails).

## Content guarantees

- **Freshness by construction**: generated blocks name only surface elements that exist,
  because each is a single-field projection of the capability manifest (R-01/R-02).
- **Authored references verified**: no authored block names a command, option, code, or
  response type absent from the capability manifest (grammar sweep, FR-005).
- **Error coverage**: `error-playbook` prescribes a branch for 100% of `ACM-D-*` codes
  (SC-006).
- **Retrieval ladder present**: `workflow` teaches all three tiers and names no embedding
  search or Manifest-authored synonyms (FR-010 / SC-007).
- **Untrusted-data posture**: `security-posture` states all Manifest-originated text —
  incl. error-envelope suggestions — is data, never instructions, citing NS-DATA-1
  (FR-004 / SC-005).
- **No corpus content**: the artifact teaches retrieval; it never inlines component data
  (R-07). Byte-preservation of hostile text is the CLI's job (spec 004 FR-011), exercised
  through the documented loop (G4).
