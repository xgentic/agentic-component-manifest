# Technical Architecture: Steering-Layer Generator (`acm agent-docs`)

**Status**: Bound (design review 2026-07-21; spec 005 planning inherits these
bindings)
**Date**: 2026-07-21
**Decisions**: [ADR 0003](../adr/0003-agent-consumption-layer.md) (layered surface),
[ADR 0004](../adr/0004-skill-generated-from-capability-manifest.md) (generated
mechanics, authored judgment)
**Context**: [Agent discovery architecture](../proposals/agent-discovery-architecture.md)
(system level), [spec 004](../../specs/004-component-discovery-cli/spec.md) (machine
contract), [spec 005](../../specs/005-agent-discovery-skill/spec.md) (steering layer)

## 1. Scope

This document binds the technical design of the steering-layer tool: the
`acm agent-docs` generator command and the `@acm/discovery-skill` product package it
writes into. The discovery engine, CLI commands, Typed Envelopes, and Capability
Manifest are spec 004's territory ([contracts](../../specs/004-component-discovery-cli/contracts/))
and are consumed here, never redefined.

## 2. Position

```
  command registry (spec 004 R-01, machine truth)
        │ projection (acm capabilities)
        ▼
  Capability Manifest ── runtime consumer: agents (spec 004 US4)
        │
        │ build-time consumer: acm agent-docs (in-process, FR-009 API)
        ▼
  ┌───────────────────────────────────────────────────────────┐
  │ @acm/discovery-skill                                      │
  │  blocks/            authored source (hand-edited prose)   │
  │  generated/blocks/  Generated Blocks (invariant #1)       │
  │  generated/targets/ per-ecosystem packagings              │
  └───────────────────────────────────────────────────────────┘
        │ steers
        ▼
  AI agent — Two-Call Loop: acm search → acm component (--json)
```

## 3. Package layout

```
packages/discovery-skill/
├── package.json                  # @acm/discovery-skill — version locksteps with @acm/toolchain
├── blocks/                       # Authored Blocks — source-controlled prose, hand-edited
│   ├── activation.md             #   when discovery applies (becomes skill frontmatter description)
│   ├── corpus-preamble.md        #   corpus detection, empty-corpus stop, CLI-missing fallback
│   ├── workflow.md               #   the Two-Call Loop
│   ├── error-playbook.md         #   prescribed branch per `ACM-D-*` code
│   ├── security-posture.md       #   NS-DATA-1 at the prompt layer
│   └── runtime-truth.md          #   on skew, `acm capabilities` is the source of truth
└── generated/                    # invariant #1 artifacts — committed, drift-checked, never hand-edited
    ├── blocks/
    │   ├── quick-reference.md    #   discovery commands with one-line purpose each
    │   ├── option-tables.md      #   options, types, choices, defaults
    │   ├── examples.md           #   one example invocation per discovery command
    │   ├── error-codes.md        #   `ACM-D-*` table, one-line meaning each
    │   └── response-types.md     #   envelope discriminators per command
    └── targets/
        ├── claude-skill/acm-discovery/SKILL.md
        ├── skills-package/…      #   cross-vendor `skills add` layout
        ├── AGENTS.fragment.md    #   context-file variant for skill-less hosts
        └── rules/…               #   editor rules files, same blocks
```

## 4. Block model

Every steering-layer output is an ordered concatenation of blocks from exactly two
sets. Block ids are stable identifiers.

**Generated Blocks** — projected from the Capability Manifest; each has a single
source field, so drift is structurally impossible:

| Block id | Capability Manifest source |
|---|---|
| `quick-reference` | `commands[]` (subset rule §5) — name, description, arguments |
| `option-tables` | `commands[].options` + discovery-relevant `globalOptions` |
| `examples` | `commands[].examples` (non-empty per spec 004's drift gate) |
| `error-codes` | `errorCodes[]` — code + description |
| `response-types` | `responseTypes` map for the projected commands |

**Authored Blocks** — judgment no manifest carries (ADR 0004): `activation`,
`corpus-preamble`, `workflow`, `error-playbook`, `security-posture`,
`runtime-truth`. Hand-edited, gate-verified (§7 G2, G6).

**Marker grammar.** Targets embed every block between generated HTML comments:

```
<!-- acm:block <block-id> -->
…block content, byte-identical across targets…
<!-- /acm:block <block-id> -->
```

HTML comments render invisibly in markdown targets and are inert in plaintext rules
files. The one exception is `activation` in `SKILL.md`, which lands as the
frontmatter `description` value (frontmatter cannot carry comments); the fidelity
gate compares that field's value against `blocks/activation.md` directly.

## 5. Generation pipeline

1. **Read** the Capability Manifest by calling the spec-004 programmatic API
   in-process (FR-009 parity) — never by scraping CLI output.
2. **Select** the discovery subset via the Capability Manifest's `jsonSupported`
   list — today exactly `search`, `component`, `capabilities`. Envelope support is
   the property the Two-Call Loop depends on, and the list is machine truth: no new
   registry surface, no hand-maintained command list. (`agent-docs` itself is
   `json: false` and therefore never describes itself in the skill.)
3. **Render** the five Generated Blocks.
4. **Merge** with the six Authored Blocks per target layout (§6) and wrap each block
   in markers.
5. **Emit** all targets. Output is deterministic: byte-identical for a given
   toolchain version, ordering fully specified, no timestamps (mirrors spec 004
   FR-012 discipline).

Because generation is corpus-agnostic (§8), the command is safe as a public CLI
surface: `acm agent-docs --target <t>` prints a target (e.g. the `AGENTS.md`
fragment for a skill-less host) and is byte-reproducible anywhere; in this repo,
`pnpm generate` (drift `--write`) regenerates `generated/**`, and `pnpm drift`
verifies freshness.

## 6. Targets

| Target | Packaging chrome around the shared blocks |
|---|---|
| Claude Code skill (primary) | `SKILL.md`: frontmatter `name` + `description` (= `activation`), body order: `corpus-preamble`, `workflow`, `quick-reference`, `option-tables`, `examples`, `error-codes`, `error-playbook`, `response-types`, `security-posture`, `runtime-truth` |
| Cross-vendor skills package | The emerging `skills add` layout (Ant Design precedent); wraps the same skill directory — layout verified against the installer tooling at implementation time |
| `AGENTS.md` fragment | Single file, one heading, same body blocks — for pasting into a project's `AGENTS.md` |
| Editor rules files | Same body blocks with the host's comment chrome |

Adding an ecosystem is a new target layout, never new content (ADR 0004).

## 7. Conformance gates

| # | Property | Mechanism | Spec 005 |
|---|---|---|---|
| G1 | Mechanical content matches CLI surface | By construction (single-source projection); whole-file `pnpm drift` catches staleness and hand-edits | — |
| G2 | Authored Blocks name only real surface | Grammar sweep over ALL authored text, backticked or not: `acm <word>` invocations, `--flag` options, `ACM-D-*` codes, dot-namespaced response types — each verified against the Capability Manifest; backticked bare surface names verified too; bare-word response types must be backticked by convention | FR-005 / SC-003 (seeded fabrication must fail) |
| G3 | Packagings match canonical source | Extract marked regions from every target, byte-compare to canonical block files — independent of generator internals; drift remains the primary gate | FR-006 / SC-004 |
| G4 | Two-Call Loop works as documented | Conformance test drives the documented loop against the fixture corpus including hostile fixtures; asserts envelope types and the NS-DATA-1 instruction's presence | FR-007 / SC-005 |
| G5 | Token budgets hold | Repo-standard gauge: `ceil(UTF-8 bytes / 4)` tokens. `activation` ≤ 400 bytes (≈ 100 tokens); `SKILL.md` body ≤ 8,000 bytes (≈ 2,000 tokens), markers included (conservative). Dependency-free, vendor-neutral — the skill targets multiple hosts, so no single vendor's tokenizer is "correct"; also keeps the frontmatter under Claude Code's 1024-char description limit | FR-008 / SC-002 |
| G6 | Every error path has a prescribed branch | Cross-check `error-playbook` coverage against the Capability Manifest's `errorCodes[]` — all six current codes, and any future addition fails the gate until the playbook covers it | SC-006 |

## 8. Security posture

Corpus-agnostic generation is a **design rule, not a default**: the generator runs
at ACM build time, where no consumer Manifest Corpus exists, and never emits
per-project component indexes — the corpus is what `acm search` is for. This makes
the guarantee that hostile Manifest text cannot ride into resident context via
generation *structural* rather than behavioral. The NS-DATA-1 chain is then:
engine byte-preserves hostile text in machine output (spec 004 FR-011) → skill's
`security-posture` block extends the rule to the prompt layer (spec 005 FR-004) →
generator never touches corpus content at all.

## 9. Decision log (design review, 2026-07-21)

| # | Decision | Binding | Rationale |
|---|---|---|---|
| D1 | Discovery-subset rule | The Capability Manifest's `jsonSupported` list | Machine truth already; envelope support is exactly what the loop needs; no new surface |
| D2 | Steering-layer home | Dedicated `@acm/discovery-skill` workspace package | Product artifact separated from the tool; clean `skills add` unit |
| D3 | Version coupling | Lockstep with `@acm/toolchain`; every toolchain release publishes both | "Which CLI does this skill describe" answers itself; no compat matrix |
| D4 | Packaging fidelity | Block markers + whole-file drift; SC-004 check extracts marked regions | Verifies the property without trusting generator internals |
| D5 | Authored-reference detection | Grammar sweep over all text + backtick vocabulary check | Catches the unmarked sloppy reference; false positives rare and cheap to reword |
| D6 | Corpus scope | Corpus-agnostic by design rule (§8) | Repo-side generation has no corpus; consumer-side indexing is a different product and security surface |
| D7 | Token gauge | `ceil(UTF-8 bytes / 4)`, budgets 400 / 8,000 bytes | Deterministic, dependency-free, vendor-neutral; precision buys nothing for a bloat guardrail |
| D8 | Generator name and surface | `acm agent-docs`, a public registry command, `json: false` | Corpus-agnostic determinism makes public exposure safe and useful for context-file variants; spec 005 planning may still rename |

## 10. Left to spec 005 planning

- Final authored prose for the six Authored Blocks (content, not structure).
- Verification of the cross-vendor `skills add` layout against the installer
  tooling current at implementation time.
- Confirmation (or renaming) of `acm agent-docs` per D8.
