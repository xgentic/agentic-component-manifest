# ACM Normative Specification

The single behavioral spec (constitution I): normative for everything document shape
cannot express. Every clause carries a stable ID and maps to a conformance check
(NS-TRACE). The JSON Schema (`schema/acm.schema.json`) is normative for shape; jointly
with the conformance suite, these are the source of truth.

## NS-CANON — ACM Canonical JSON profile

- **NS-CANON-1** Encoding and layout: UTF-8, LF newlines, pretty-printed with 2-space
  indentation, exactly one trailing newline. No timestamps or environment-dependent
  values anywhere.
- **NS-CANON-2** Key order: specified fields appear in schema declaration order (first
  occurrence of the property name across the schema's `properties` maps, walked in
  document order). Unknown and `x-*` keys sort after all declared keys, lexicographic by
  code point. Arbitrary-key maps are lexicographic throughout.
- **NS-CANON-3** Scalars: numbers serialize per ECMAScript `Number::toString`
  (RFC 8785 §3.2.2.3; negative zero emits `0`; non-finite values are illegal). Strings
  use minimal JSON escaping. Booleans and `null` are literals.
- **NS-CANON-4** Arrays keep semantic (source) order — never sorted.
- **NS-CANON-5** Canonicalization is a producer obligation, checked by
  regenerate-and-diff (`acm canonicalize --check`, rule `ACM-C-DRIFT`). Consumers only
  validate.

## NS-YAML — Authoring input profile

- **NS-YAML-1** YAML 1.2, core schema only (unquoted `no` is the string `"no"`).
- **NS-YAML-2** Mapping keys must be strings and unique (`ACM-P-KEY`).
- **NS-YAML-3** No custom tags (`ACM-P-YAMLTAG`); the document must parse into the JSON
  data model. Anchors/aliases are legal and expand at parse.
- **NS-YAML-4** Authoring input compiles to canonical JSON (`acm compile`); YAML is
  never distributed and has no canonical form.

## NS-VIEW — Agent View

- **NS-VIEW-1** The Agent View is a one-way, deterministic YAML projection of canonical
  JSON for agent consumption. Never authoritative, never parsed back, never distributed
  as the manifest (ADR 0001). `acm agent-view` refuses non-canonical input (exit 3).
- **NS-VIEW-2** Emitter profile: block style; 2-space indent; scalar strings plain where
  YAML 1.2 core round-trips them losslessly, else double-quoted with JSON escaping; no
  anchors; no flow collections except empty `{}`/`[]`; key order inherited from
  canonical JSON; LF; single trailing newline.
- **NS-VIEW-3** Golden `acm.view.yml` pairs freeze the emitter; divergence is a tool
  bug, not format ambiguity.

## NS-IGNORE — Must-ignore and extension preservation

- **NS-IGNORE-1** Consumers MUST ignore unknown fields. `x-*` extension content is
  preserved opaquely through validate → canonicalize → Agent View.

## NS-LIMIT — Structural limits

- **NS-LIMIT-1** Per-field and per-collection limits live in the schema; the registry
  with values and rationale is `data/limits.md`. Never whole-document caps.
- **NS-LIMIT-2** Nesting depth of the whole document is at most 32 (`ACM-V-DEPTH`);
  enforced by the validator because JSON Schema cannot express recursion depth.
- **NS-LIMIT-3** Limits are boundary-tested from both sides: the maximal fixture
  validates inside them; hostile fixtures exceeding them are rejected.

## NS-VALID — Validator semantics beyond shape

- **NS-VALID-1** Every `exports[].declaration` must resolve to a declaration name in the
  same module (`ACM-V-EXPORT`).
- **NS-VALID-2** Duplicate names within a member collection, duplicate declaration
  names within a module, and duplicate module paths are rejected (`ACM-V-DUP`). Two
  unnamed slots count as duplicates of the default slot.

## NS-DISC — Discovery

- **NS-DISC-1** npm packages advertise the manifest via a top-level `acm` field in
  `package.json` (package-relative path to canonical JSON).
- **NS-DISC-2** Conventional filename and default location: `agentic-component-manifest.json` at package root.
- **NS-DISC-3** Non-npm fallback: `/.well-known/agentic-component-manifest.json` relative to the distribution
  root.
- **NS-DISC-4** Consumer resolution order: `acm` field → `./agentic-component-manifest.json` → well-known.
  First hit wins; sources are never merged. An advertised-but-missing manifest is a
  clean error.
- **NS-DISC-5** A manifest without `schemaVersion` is invalid; capability is resolved
  from the declaration, never guessed.

## NS-DATA — Manifests are untrusted input

- **NS-DATA-1** All manifest text (descriptions, notes, example captions) is data,
  never instructions to a consumer. Reference consumers surface hostile text inertly.

## NS-RULES — Diagnostic rule registry

| Rule id | Meaning |
|---|---|
| `ACM-V-SCHEMA` | document violates the JSON Schema (generic shape error) |
| `ACM-V-DEPTH` | nesting depth exceeds NS-LIMIT-2 |
| `ACM-V-EXPORT` | export does not resolve to a declaration (NS-VALID-1) |
| `ACM-V-DUP` | duplicate name/path within a collection (NS-VALID-2) |
| `ACM-X-MAXLEN` | string exceeds its schema `maxLength` (NS-LIMIT-1) |
| `ACM-X-MAXITEMS` | collection exceeds its schema `maxItems` (NS-LIMIT-1) |
| `ACM-P-YAML` | YAML parse error in authoring input |
| `ACM-P-YAMLTAG` | custom/unresolvable YAML tag (NS-YAML-3) |
| `ACM-P-KEY` | non-string or duplicate mapping key (NS-YAML-2) |
| `ACM-C-DRIFT` | input is not in canonical form (NS-CANON-5) |
| `ACM-M-DESC` / `ACM-M-TIER` / `ACM-M-TYPE` | schema field lacks description / tier / type (constitution I) |
| `ACM-M-APPLIC` | restricted applicability on a non-CEM-inherited node (constitution II) |
| `ACM-G-COVERAGE` | unwitnessed, unannotated node × class cell (constitution II) |

## NS-TRACE — Clause → check traceability

| Clause | Enforced by |
|---|---|
| NS-CANON-1..4 | `packages/conformance/tests/gate-determinism.test.ts` |
| NS-CANON-5 | `acm canonicalize --check`; gate-determinism reorder case |
| NS-YAML-1..4 | `packages/conformance/tests/gate-determinism.test.ts` (compile cases) |
| NS-VIEW-1..3 | `packages/conformance/tests/gate-agent-view.test.ts` |
| NS-IGNORE-1 | `packages/conformance/tests/gate-fixtures.test.ts` (x-* preservation) |
| NS-LIMIT-1..3 | `packages/conformance/tests/gate-fixtures.test.ts` (maximal + hostile) |
| NS-VALID-1..2 | `packages/conformance/tests/gate-fixtures.test.ts` (mutations 6–7) |
| NS-DISC-1..5 | `packages/conformance/tests/gate-fixtures.test.ts` (discovery cases) |
| NS-DATA-1 | `packages/conformance/tests/gate-agent-view.test.ts` (injection inertness) |
| Schema self-rules (I) | `packages/conformance/tests/gate-schema.test.ts` (meta-schema + walker) |
| Coverage matrix (II) | `packages/conformance/tests/gate-coverage.test.ts`; `acm coverage` |
| Seeded gate proofs (IX) | `packages/conformance/tests/gate-seeded.test.ts` |
| Generated-artifact freshness (I) | `acm drift`; gate-drift CI job |
