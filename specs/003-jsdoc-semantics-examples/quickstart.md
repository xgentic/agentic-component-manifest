# Quickstart: Doc-Comment Semantics & Examples Extraction

End-to-end validation that the analyzer derives `semantics` and `examples` from doc
comments. Contracts: [doc-tags.md](./contracts/doc-tags.md),
[draft-api.md](./contracts/draft-api.md),
[example-verification.md](./contracts/example-verification.md). Data model:
[data-model.md](./data-model.md).

## Prerequisites

```sh
pnpm install          # repo root; Node >= 20
```

Run the analyzer from the project being described (it discovers relative to the CWD).
Define the same shell helper the analyzer quickstart uses:

```sh
acm-analyzer() { pnpm exec tsx "$(git rev-parse --show-toplevel)/packages/analyzer/src/cli.ts" "$@"; }
```

## Scenario 1 — semantic classification (US1)

Given a component whose doc comment carries `@acmSemantic switch - <notes>`:

```sh
acm-analyzer analyze --outdir /tmp/acm-sem
```

**Expected**: exit 0; `/tmp/acm-sem/agentic-component-manifest.json` carries
`declarations[].semantics = { term: "switch", notes: "…" }`; the manifest is schema-valid
and canonical. A component with no `@acmSemantic` has no `semantics` field.

## Scenario 2 — usage examples, compile-verified (US2)

Given a component with two `@example` blocks — one that compiles against the component and
one that references a non-existent property:

```sh
acm-analyzer analyze --outdir /tmp/acm-ex
```

**Expected**: exit 3 (warnings). `examples[]` contains **only the compiling example**
(source verbatim, `lang`, and `title` if a caption was given, in source order). The broken
example is absent, and stderr shows an `ACM-A-EXCOMPILE` diagnostic naming the file and the
TypeScript error. The manifest is still schema-valid and canonical.

## Scenario 3 — invalid semantic term is dropped, never emitted (US3)

Given a component annotated `@acmSemantic notaterm`:

```sh
acm-analyzer analyze --outdir /tmp/acm-bad
```

**Expected**: exit 3; stderr shows `ACM-A-SEMTERM` naming the file and the invalid term;
the declaration has **no `semantics` field** (the out-of-vocabulary term never reaches the
manifest); the manifest still validates. Same shape for an empty term, a duplicate
`@acmSemantic` (`ACM-A-SEMDUP`, first wins), an empty `@example` (`ACM-A-EXEMPTY`), and an
over-limit note/example (`ACM-A-EXLIMIT`).

## Scenario 4 — determinism (SC-003)

```sh
acm-analyzer analyze --outdir /tmp/acm-a
acm-analyzer analyze --outdir /tmp/acm-b
diff /tmp/acm-a/agentic-component-manifest.json /tmp/acm-b/agentic-component-manifest.json     # no output = byte-identical
```

**Expected**: byte-identical, including the compile-verified `examples[]` (the keep/drop
decision is a pure function of the source — [example-verification.md](./contracts/example-verification.md)).

## Conformance gates (the executable proof)

Run from the repo root:

```sh
pnpm test analyzer     # includes the new doc-metadata golden + seeded-failure gates
pnpm test              # full suite stays green
pnpm drift             # generated artifacts fresh
```

**Expected**: all green. `analyzer-witness.test.ts` reproduces the doc-metadata golden
(component with `@acmSemantic` + a compiling `@example`) byte-for-byte from source;
`analyzer-gates.test.ts` proves an unknown term is dropped, a non-compiling example is
excluded, and re-analysis is byte-identical.

## What "done" looks like

- A component documented with `@acmSemantic <term>` and one or more compiling `@example`
  blocks produces an `agentic-component-manifest.json` byte-identical to the hand-authored golden (SC-004) — i.e.
  the Tier-2 content that previously had to be authored by hand is now derived from source.
- Every malformed annotation degrades to "field absent + warning", never an invalid manifest
  or a failed build (SC-005).
