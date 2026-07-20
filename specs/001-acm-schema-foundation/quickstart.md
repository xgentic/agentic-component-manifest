# Quickstart: Validating the ACM Schema Foundation

Runnable end-to-end proof that the foundation works. References:
[data-model.md](./data-model.md), [contracts/](./contracts/), success criteria in
[spec.md](./spec.md).

## Prerequisites

- Node.js ≥ 20, pnpm ≥ 9
- `pnpm install` at repo root

## 1. Everything at once

```sh
pnpm test          # full conformance suite — every constitutional gate (SC-001..007)
```

Expected: all gate suites green — `gate-schema`, `gate-coverage`, `gate-determinism`,
`gate-fixtures`, `gate-drift`.

## 2. Story-by-story validation

### P1 — Validate a manifest (spec User Story 1)

```sh
pnpm acm validate packages/conformance/fixtures/minimal/agentic-component-manifest.json      # exit 0
pnpm acm validate packages/conformance/fixtures/hostile/over-limit.json
# exit 1, diagnostic carries JSON Pointer + rule id (e.g. ACM-X-MAXLEN)
```

### P2 — Author YAML, get canonical JSON (User Story 2)

```sh
pnpm acm compile packages/conformance/fixtures/minimal/acm.src.yml > /tmp/a.json
pnpm acm compile packages/conformance/fixtures/minimal/acm.src.yml > /tmp/b.json
diff /tmp/a.json /tmp/b.json                                          # empty — byte-identical
pnpm acm canonicalize --check packages/conformance/fixtures/minimal/agentic-component-manifest.json  # exit 0
```

Out-of-profile YAML (custom tag / non-string key) exits 2 naming the profile rule.

### P3 — Agent View (User Story 3)

```sh
pnpm acm agent-view packages/conformance/fixtures/witness/react/agentic-component-manifest.json
# byte-identical to fixtures/witness/react/acm.view.yml (golden pair)
```

Token check (SC-005) runs inside `pnpm test` — Agent View ≥15% fewer tokens than the
formatted JSON for every golden fixture.

### P4 — The harness gates changes (User Story 4)

```sh
pnpm acm coverage        # exit 0: all node × class cells witnessed or annotated
pnpm acm drift           # exit 0: generated types.ts / reference.md are fresh
pnpm test:seeded         # seeded non-conformant changes — each MUST be rejected (SC-007)
```

## 3. Expected failure demos (the gates have teeth)

| Mutation | Expected result |
|---|---|
| Add schema field without `acmTier` | meta-schema gate fails, names the field |
| Remove Angular witness for a core node | `acm coverage` exit 4, shows empty cell |
| Hand-reorder keys in a canonical fixture | `canonicalize --check` exit 3 with diff |
| Grow minimal fixture past budget | `gate-fixtures` fails as a reviewable event |
| Inject instruction text into a description | validation passes; reference consumer test asserts it is surfaced as inert data |
