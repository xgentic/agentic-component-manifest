# Contract: The ACM Schema

The schema IS the primary external contract (constitution I). Consumers program against
it; producers emit documents valid under it.

- **Artifact**: `packages/spec/schema/acm.schema.json`, JSON Schema draft 2020-12,
  `$id: https://acm.dev/schemas/v0/acm.schema.json` (placeholder host; pinned before
  first release).
- **Document shape**: see [data-model.md](../data-model.md). Top level:
  `schemaVersion` + `modules[]` + `x-*`.
- **Custom annotation keywords** (`acmTier`, `acmApplicability`, `acmCemInherited`):
  annotation-only — validators MUST NOT change validation outcomes based on them;
  they are enforced on the *schema itself* by `acm.meta.schema.json`.
- **Meta-schema guarantees** (CI-gated): every specified field has `type`, non-empty
  `description`, `acmTier`; `acmApplicability` only alongside `acmCemInherited: true`.
- **Must-ignore**: consumers MUST ignore unknown fields; `x-*` preserved opaquely.
- **Versioning**: additive-only within a major (constitution VII); the schema's own
  version is the manifest `schemaVersion` value space. v0.x: breaking changes allowed
  with minor bumps, flagged in a CHANGELOG (pre-1.0 exception, stated in Normative
  Spec).
- **Validation semantics beyond shape** (Normative Spec clauses, validator-enforced):
  nesting depth limit; export-reference resolution; duplicate-name rejection;
  both-or-neither TypeExpression rule.
