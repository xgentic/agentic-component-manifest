# Structured type mapping rules

Normative-for-tooling rules the analyzer's `TypeMapping` service executes (Principle VI,
research [R-02](../../../specs/002-acm-analyzer-cli/research.md#r-02--structured-type-tier-documented-syntactic-mapping-rules)).
Every ACM `TypeExpression` carries two layers:

- **`raw`** — the exact source text of the type, sliced verbatim from the module
  (`node.getText()`). Always present when a type is emitted.
- **`structured`** — the best syntactic approximation in the schema's closed
  `TypeNode` grammar, or the declared **`opaque`** fallback when the syntax has no
  structured form or is nested past the depth bound.

**Invariants.** The mapping is *total* — it never throws; the worst case is
`{ kind: "opaque" }` plus verbatim `raw`. Structured and raw are emitted **both or
neither**: a mapped type always has both layers. `raw` is captured at the top of the
type expression, so a nested `opaque` node never loses the overall verbatim text.

Analysis is **syntax-only** (no type checker): mapping reads the written type syntax,
never an inferred or cross-file-resolved type. A reference's `module` comes from the
module's own `import` clause, nothing more.

## Depth bound

Structured recursion is bounded at **depth 4** (the type expression root is depth 0;
each nested member/item/field/parameter/return/key/value is one deeper). A type node
at depth > 4 maps to `{ kind: "opaque" }`; the top-level `raw` still carries its
verbatim text. This makes the negative-space rule (testbed L6/A12) mechanical.

## Rules

| # | TypeScript syntax | `structured` |
|---|-------------------|--------------|
| 1 | keyword `string` / `number` / `boolean` / `void` / `undefined` / `unknown` | `{ kind: "primitive", primitive: <name> }` |
| 2 | `null` keyword or `null` literal type | `{ kind: "primitive", primitive: "null" }` |
| 3 | `any` | `{ kind: "opaque" }` (no honest structured form) |
| 4 | string / numeric / boolean literal type (`'primary'`, `42`, `true`) | `{ kind: "literal", value }` |
| 5 | union `A \| B` | `{ kind: "union", members: [map(A), map(B)] }`, source order |
| 6 | array `T[]` / `readonly T[]` / `Array<T>` / `ReadonlyArray<T>` | `{ kind: "array", items: map(T) }` |
| 7 | `Record<K, V>` | `{ kind: "record", key: map(K), valueType: map(V) }` |
| 8 | type literal `{ a: A; b?: B }` | `{ kind: "object", fields: [{ name, type: map(A) }, { name, type: map(B), optional: true }] }` |
| 9 | function `(a: A, b: B) => R` | `{ kind: "function", parameters: [map(A), map(B)], return: map(R) }` |
| 10 | type reference `Name` / `Name<…>` / `Qualified.Name` | `{ kind: "reference", name, module? }` — `module` is the import specifier when `Name` is imported in this file; type arguments are dropped from `structured` (preserved in `raw`) |
| 11 | parenthesized `(T)` / `readonly T` operator | unwrap to `map(T)` |
| 12 | anything else — intersection `A & B`, tuple `[A, B]`, `keyof`/`typeof`/conditional/mapped, or depth > 4 | `{ kind: "opaque" }` (the closed grammar has no node for it; `raw` carries it) |

Intersections and tuples have **no** node in the closed grammar, so they take the
opaque fallback by rule 12 — a documented, schema-valid approximation, never an
invented `intersection`/`tuple` kind.

## Reference module resolution

For a type reference, the analyzer scans the module's `import` declarations
(`import { Name } from '<spec>'`, default, and namespace imports) and, if the
referenced name is imported, sets `module` to that specifier verbatim. Same-file and
ambient/global types (e.g. `FocusOptions`) carry **no** `module`. No `node_modules`
resolution ever occurs.

The `TypeNode` grammar these rules target is the closed `$defs` set in
[`acm.schema.json`](../../spec/schema/acm.schema.json) (generated field reference:
[`reference.md`](../../spec/generated/reference.md)).

## Rule pinning (Principle VI)

Every rule is pinned two ways — a direct unit assertion and an integration golden — so a
mapping change cannot land without a red test:

- **Per-rule unit pins.** [`type-mapping.test.ts`](../tests/type-mapping.test.ts) asserts
  `structured`/`raw` output directly for primitives + `null` (rules 1–2), literal + union
  (4–5), array/`Array<T>` + `Record` (6–7), object literals with optional flags (8),
  references with import-derived `module` and ambient no-`module` (10), and the opaque
  fallback for intersection/tuple/`keyof` and for nesting past the depth bound (3, 11–12) —
  with `raw` staying the whole verbatim slice each time.
- **Integration goldens.** The rules — including **function** (rule 9) and the
  parenthesized/`readonly` unwrap (rule 11), which are pinned by golden rather than by unit
  test — are exercised inside checked-in canonical manifests the analyzer must reproduce
  byte-for-byte: the analyzer goldens
  ([`fixtures/analyzer/*`](../../conformance/fixtures/analyzer)), the witness projections
  ([`fixtures/witness/{lit,react,angular}`](../../conformance/fixtures/witness)), and the
  Lit/Angular stress testbeds ([`fixtures/testbed/*`](../../conformance/fixtures/testbed)),
  whose inventory rows **L6 / A12** pin the depth-bound → `opaque` negative space
  explicitly (see [testbed-inventory](../../../specs/002-acm-analyzer-cli/contracts/testbed-inventory.md)).
  `function` nodes appear in the [maximal](../../conformance/fixtures/maximal/agentic-component-manifest.json) and
  both testbed goldens.

Both layers run under `pnpm test`; the testbed byte-match is the `gate-analyzer` CI job.
