# Phase 0 Research: ACM Schema Foundation

All Technical Context unknowns resolved. Decisions below carry the constitution
grilling session's resolutions (constitution v3.0.0, ADRs 0001–0002) into concrete
technology choices. No NEEDS CLARIFICATION markers remain.

## R1 — Implementation language & runtime

- **Decision**: TypeScript 5.x (strict mode), Node.js ≥ 20 LTS, ESM-only.
- **Rationale**: Every target framework and the entire CEM ecosystem live in JS/TS; the
  reference toolchain must be `npx`-runnable by the ecosystem it serves. TS types are
  themselves a generated artifact of the schema (Principle I).
- **Alternatives considered**: Rust (faster, but ecosystem mismatch and no free TS-type
  story); Python (Yamale heritage — already rejected in the grill).

## R2 — JSON Schema validator

- **Decision**: Ajv v8 in draft-2020-12 mode, extended with a custom vocabulary
  registering `acmTier`, `acmApplicability`, `acmCemInherited` as annotation keywords.
- **Rationale**: Ajv is the ecosystem-standard 2020-12 validator, supports custom
  vocabularies/meta-schemas (needed to make Principle I's "typed/described/tiered"
  mechanically rejectable), and compiles fast enough for the <1 s maximal-fixture goal.
- **Alternatives considered**: `@hyperjump/json-schema` (stricter spec conformance,
  weaker ecosystem/perf); `@cfworker/json-schema` (no custom vocabulary support).

## R3 — YAML parser for the authoring profile

- **Decision**: `yaml` (eemeli, v2): `schema: 'core'` (YAML 1.2), `uniqueKeys: true`,
  custom-tag resolution disabled, post-parse rejection of non-string keys and
  non-JSON-data-model values.
- **Rationale**: Only mainstream JS YAML library with real YAML 1.2 core-schema support
  and per-document control, which is exactly the pinned authoring profile
  (constitution V). Kills the Norway problem by construction.
- **Alternatives considered**: `js-yaml` (YAML 1.1 heritage, weaker profile control);
  writing a restricted parser (a spec unto itself — rejected).

## R4 — Canonicalizer implementation

- **Decision**: Hand-rolled emitter (~200 LOC) implementing the ACM Canonical JSON
  profile (ADR 0002): schema-declared key order (driven by the schema's declaration
  order at build time), lexicographic order for map/unknown/`x-*` keys, scalars via
  ECMAScript `Number::toString` (which is exactly RFC 8785 §3.2.2.3's algorithm — JS
  gets this for free), `JSON.stringify` per-string for minimal escaping, 2-space/LF
  layout, single trailing newline.
- **Rationale**: No off-the-shelf library implements a schema-ordered pretty-printed
  profile; the JCS-hard part (number serialization) is native in JS.
- **Alternatives considered**: `canonicalize` npm package (pure JCS — minified
  single-line output, rejected per ADR 0002).

## R5 — Agent View emitter

- **Decision**: Emit YAML from canonical JSON with a fixed hand-rolled emitter profile
  on top of `yaml`'s stringifier: block style always, 2-space indent, plain scalars
  where YAML 1.2 core round-trips them losslessly (else double-quoted), no anchors, no
  flow collections, key order inherited from canonical JSON, LF, trailing newline.
- **Rationale**: Determinism must be pinned by *our* profile, not the library's
  defaults; golden JSON→YAML fixture pairs freeze the emitter's behavior (ADR 0001).
- **Alternatives considered**: `js-yaml` dump (quoting decisions differ across
  versions); shipping no reference emitter (rejected: every tool would diverge).

## R6 — Generated artifacts & drift check

- **Decision**: `json-schema-to-typescript` for `generated/types.ts`; a small custom
  generator for `generated/reference.md` (field reference from schema `description`s);
  CI job regenerates both and fails on `git diff --exit-code`.
- **Rationale**: Regenerate-and-diff is the constitutional review mechanism; both
  artifacts must be provably derived, never hand-edited.
- **Alternatives considered**: `quicktype` (multi-language output not yet needed);
  TypeDoc-style docs (documents code, not schema — wrong direction).

## R7 — Test framework & CI topology

- **Decision**: Vitest for unit + conformance suites; GitHub Actions with an
  ubuntu-latest + macos-latest matrix; CI jobs named after constitution principles
  (`gate-schema`, `gate-coverage`, `gate-determinism`, `gate-fixtures`, `gate-drift`).
- **Rationale**: SC-002 requires cross-platform byte-identity, so two OSes are the
  minimum honest gate; principle-named jobs make Principle IX's mapping legible in
  every PR.
- **Alternatives considered**: node:test (weaker fixture/snapshot ergonomics); adding
  windows-latest (deferred — tolerated, not gated, in v0).

## R8 — Token metric for SC-005 (Agent View ≥15% smaller)

- **Decision**: `gpt-tokenizer` with `o200k_base` as the fixed proxy tokenizer,
  measured in a conformance test over every golden fixture.
- **Rationale**: A pinned public tokenizer makes the criterion reproducible; exact
  per-model counts vary but the YAML-vs-JSON delta is stable across modern BPE
  tokenizers.
- **Alternatives considered**: byte size (poor proxy for tokens); vendor APIs at test
  time (network in CI — violates the offline constraint).

## R9 — Repository layout

- **Decision**: pnpm workspace monorepo: `packages/spec` (normative artifacts),
  `packages/toolchain` (reference implementation), `packages/conformance` (fixtures +
  gate suite).
- **Rationale**: Mirrors producer/consumer conformance classes; fixtures consumed by
  both other packages without cycles; the normative layer can version independently.
- **Alternatives considered**: single package (tangles normative artifacts with tool
  releases); separate repos (kills same-change atomicity that Principle I requires).

## R10 — Provenance/applicability encoding in the schema

- **Decision**: Custom annotation keywords on schema nodes — `acmTier`
  (`"derived" | "authored-verifiable"`), `acmApplicability` (array of paradigm-class
  ids), `acmCemInherited` (boolean) — validated by `acm.meta.schema.json`, which also
  enforces: every property has `type`, non-empty `description`, `acmTier`; and
  `acmApplicability` present ⇒ `acmCemInherited: true`.
- **Rationale**: Annotations must live *in* the schema (single source of truth), and a
  meta-schema makes Principle I/II violations mechanically rejectable rather than
  review-caught.
- **Alternatives considered**: sidecar tier registry file (parallel artifact —
  forbidden drift); JSON Schema `$comment` conventions (not machine-enforceable).

## R11 — Controlled vocabulary source

- **Decision**: `packages/spec/data/vocabulary.json` — a pinned, versioned term list
  compiled from the Open UI component taxonomy plus WAI-ARIA roles/APG pattern names;
  the schema's semantic `term` field is an enum generated from this file.
- **Rationale**: Principle VI demands a controlled vocabulary; pinning a data file
  keeps the enum diffable and its growth a reviewable event.
- **Alternatives considered**: free string + regex (prose in disguise —
  unconstitutional); live fetching of Open UI sources (nondeterministic, online).

## R12 — CEM name adoption

- **Decision**: Adopt node names from the Custom Elements Manifest schema (v2 line)
  verbatim wherever the concept is shared — `modules`, `declarations`, `members`,
  `events`, `slots`, `cssParts`, `cssProperties`, `exports` — generalizing only
  identity and component kind; WC-only nodes carry `acmCemInherited: true` +
  `acmApplicability: ["retained-dom"]`.
- **Rationale**: Principle VIII forbids new names for shared concepts; the grandfather
  clause (constitution II) is encoded exactly at these nodes.
- **Alternatives considered**: clean-room naming (violates VIII); literal JSON superset
  (rejected in constitution v2 already).
