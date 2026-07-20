# Implementation Plan: ACM Schema Foundation

**Branch**: `001-acm-schema-foundation` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-acm-schema-foundation/spec.md`

## Summary

Deliver ACM's normative layer and its executable constitution: the one JSON Schema
(draft 2020-12) with provenance/applicability annotations enforced by a meta-schema, the
single Normative Spec document (canonical profile, YAML authoring profile, Agent View
emitter rules, must-ignore, structural limits, discovery), the reference toolchain
(validator, canonicalizer, authoring compiler, Agent View emitter, coverage-matrix
generator, drift check), the full fixture set (minimal, maximal, 4 witness, 5
adversarial, hostile), and CI gates wiring every constitutional principle to a failable
check. Implementation: TypeScript/Node ESM pnpm monorepo; Ajv with a custom ACM schema
vocabulary; hand-rolled canonicalizer implementing the ACM Canonical JSON profile
(ADR 0002); one-way YAML Agent View emitter (ADR 0001).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js ≥ 20 LTS, ESM-only

**Primary Dependencies**: `ajv` (JSON Schema 2020-12 + custom vocabulary for
`acmTier`/`acmApplicability`/`acmCemInherited`), `yaml` (eemeli v2 — YAML 1.2 core
schema, strict parsing), `json-schema-to-typescript` (generated types),
`gpt-tokenizer` (token metric for SC-005, o200k_base as proxy tokenizer)

**Storage**: files only (schema, fixtures, generated artifacts) — no database

**Testing**: Vitest; GitHub Actions matrix (ubuntu-latest + macos-latest) so the
byte-identity criterion (SC-002) is proven cross-platform

**Target Platform**: Node.js library + CLI, cross-platform (macOS/Linux; Windows
tolerated but not gated in v0)

**Project Type**: library + CLI monorepo (3 pnpm workspace packages)

**Performance Goals**: full conformance suite < 60 s in CI; maximal-fixture validation
< 1 s; canonicalization of the maximal fixture < 100 ms

**Constraints**: zero output nondeterminism (no timestamps, randomness, or
environment-dependent values in any generated artifact); no network access at tool
runtime; all tools runnable offline

**Scale/Scope**: ~40 core schema nodes; 13 fixtures (1 minimal, 1 maximal, 4 witness,
5 adversarial, ≥2 hostile); ~120 pinned vocabulary terms; 6 CLI commands

## Constitution Check

*GATE: evaluated against constitution v3.0.0 before Phase 0; re-evaluated after Phase 1.*

| # | Principle | How this plan satisfies it | Status |
|---|-----------|---------------------------|--------|
| I | Schema + conformance suite are the source of truth | One schema (`acm.schema.json`); a meta-schema (`acm.meta.schema.json`) mechanically rejects any field lacking `type`, `description`, or `acmTier`; types/docs generated with a CI drift check; Normative Spec ships with a clause→check traceability listing | PASS |
| II | Framework agnosticism / Triangulation | 4 witness fixtures (Lit, React, Vue, Angular); coverage-matrix tool blocks unwitnessed, unannotated node×class cells; `acmApplicability` valid only where `acmCemInherited: true` (meta-schema rule) | PASS |
| III | Minimal core, namespaced extensions | `x-*`/`customData` at every node level; minimal-fixture byte budget pinned in CI config; budget change requires a diff | PASS |
| IV | Static, AST-level, provenance-tiered | Every schema field carries `acmTier`; descriptions Tier 1 (verbatim doc-comment rule stated in Normative Spec + checked on witness fixtures); examples optional | PASS |
| V | Determinism and canonical form | Canonicalizer implements ACM Canonical JSON (ADR 0002); Agent View emitter (ADR 0001) with golden pairs; YAML 1.2 core-schema authoring compiler; regenerate-and-diff gate on both platforms | PASS |
| VI | Machine-first, agent-ready | Layered `TypeExpression` (structured grammar + raw text, both-or-neither, declared `opaque` fallback); semantics constrained to pinned vocabulary data (Open UI + ARIA) | PASS |
| VII | Additive evolution | `schemaVersion` self-declaration required; must-ignore covered by an unknown-field fixture; version 0.x pre-release rules stated in Normative Spec | PASS |
| VIII | CEM descent | Node names adopted from CEM v2 where concepts are shared (modules, declarations, members, events, slots, cssParts); WC-specific inherited nodes flagged `acmCemInherited`; converter gates reserved (activate with the converter feature) | PASS |
| IX | Every principle enforceable | Each row of this table maps to a named CI job in `ci.yml`; seeded non-conformant changes (SC-007) prove the gates fire | PASS |
| X | Manifests are untrusted input | Structural limits expressed in-schema (`maxLength`, `maxItems`, `maxProperties`); nesting depth is a Normative Spec clause enforced by the validator (JSON Schema cannot express recursion depth — consistent with the two-layer stack); hostile fixtures on both sides of every limit | PASS |

**Gate result**: no violations; Complexity Tracking intentionally empty.

**Post-Phase-1 re-check (after data-model + contracts)**: no new violations introduced;
the layered TypeExpression grammar and discovery contract remain within Principles VI
and the Distribution section. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/001-acm-schema-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── schema-contract.md
│   ├── toolchain-cli.md
│   └── discovery-contract.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
packages/
├── spec/                          # the normative layer (what ACM *is*)
│   ├── schema/
│   │   ├── acm.schema.json        # THE schema (draft 2020-12)
│   │   └── acm.meta.schema.json   # meta-schema: typed/described/tiered enforcement
│   ├── normative-spec.md          # THE behavioral spec (single document)
│   ├── data/
│   │   ├── vocabulary.json        # pinned Open UI + WAI-ARIA terms
│   │   └── limits.md              # structural-limit registry (mirrored into schema)
│   └── generated/
│       ├── types.ts               # generated from schema (drift-checked)
│       └── reference.md           # generated field reference (drift-checked)
├── toolchain/                     # the reference implementation
│   ├── src/
│   │   ├── validate.ts            # schema + limits + depth validation
│   │   ├── canonicalize.ts        # ACM Canonical JSON profile emitter
│   │   ├── compile.ts             # YAML authoring input → canonical JSON
│   │   ├── agent-view.ts          # canonical JSON → deterministic YAML projection
│   │   ├── coverage.ts            # node × paradigm-class matrix generator
│   │   ├── drift.ts               # generated-artifact staleness check
│   │   └── cli.ts                 # `acm <command>` entry point
│   └── tests/                     # unit tests
└── conformance/                   # the executable constitution
    ├── fixtures/
    │   ├── minimal/               # size-budgeted trivial component
    │   ├── maximal/               # DataGrid-class, inside all limits
    │   ├── witness/{lit,react,vue,angular}/
    │   ├── adversarial/{headless,scoped-slot,polymorphic,controlled,form-associated}/
    │   └── hostile/               # injection text; over-limit structures
    └── tests/                     # conformance suite (the CI gates)

.github/workflows/ci.yml           # gate jobs named after constitution principles
```

**Structure Decision**: pnpm monorepo with three packages separating the normative
layer (`spec`), the reference implementation (`toolchain`), and the executable
constitution (`conformance`). This mirrors the constitution's producer/consumer
conformance classes, lets fixtures be consumed by both test layers without circular
dependencies, and keeps "what ACM is" versioned independently from "what the tools do."
A single-package layout was rejected in research.md R9.

## Complexity Tracking

No constitutional violations to justify — table intentionally empty.
