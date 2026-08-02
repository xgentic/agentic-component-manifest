# Implementation Plan: React support

**Spec**: [spec.md](spec.md) · **Research**: [research.md](research.md) ·
**Contract**: the React section of
[testbed-inventory.md](../002-acm-analyzer-cli/contracts/testbed-inventory.md)

## Decisions

**D1 — Deepen the existing plugin; do not rewrite it.** The React plugin's shape is
right: recognize a component, resolve its props, map members, read CEM JSDoc tags. What
is missing is coverage of the forms real libraries use. Every change below extends an
existing function rather than replacing the file.

**D2 — Cross-module resolution, syntactic only.** Per [R-07-A](research.md). This is the
one behavioral rule that needed a spec rather than a patch, because it supersedes a
recorded decision in spec 002.

**D3 — No plugin-API change.** Per [R-19](research.md), the cross-module index lives in
the plugin's closure and is populated by the existing `collect` hook. `plugin.ts` is
untouched, which keeps spec 002's SC-005 (no privileged internal seam) true by
construction.

**D4 — Unresolved props are recorded, not guessed.** `x-react.unresolvedProps` is an
extension node reached through `EntryDraft.set()`. Core `inputs[]` never receives an
inferred member. This is what makes D2 safe: widening resolution cannot silently widen
what the manifest asserts, because everything outside the resolvable set is named.

**D5 — The `witness/react` golden must not move.** It uses a bare `forwardRef` over a
same-file props interface — the one form that already worked. Holding it byte-stable is
the sharpest available regression signal, so it is a success criterion (SC-003) rather
than an afterthought.

**D6 — The React inventory extends spec 002's contract file rather than forking it.**
`analyzer-testbed.test.ts` cites `contracts/testbed-inventory.md` as *the* walked
inventory for all frameworks. A second file would split the contract from its gate.

## Phases

### Phase 1 — Recognition

`componentOf` / `unwrapWrapper` in
[react.ts](../../packages/analyzer/src/frameworks/react.ts): member-expression wrapper
callees, nested wrappers with innermost type arguments, `FC`-family variable annotations,
class components via `shared.ts`'s existing `isPublicMember` / `methodDraft`, and
`export: "default"` for default exports. (FR-001 … FR-005)

### Phase 2 — Props resolution

A `collect` hook indexing each module's interfaces, type aliases, and import bindings; a
resolver over that index handling heritage, intersections, and the four utility types,
with the ordering rule, cycle set, and depth bound; and the `x-react.unresolvedProps`
fallback. (FR-006 … FR-010)

### Phase 3 — Members

Renamed-binding defaults, `React.`-qualified and property-assignment imperative handles
with signatures recovered from a resolved handle type, and the `children` input + default
slot rule. (FR-011 … FR-015)

### Phase 4 — Fixtures and gates

`fixtures/analyzer/react/` (small, one module per recognition form) joins the witness
`CASES`; `fixtures/testbed/react/` (`AcmeDataGrid`, real compiling TSX against a checked-in
React type stub) joins `TESTBEDS` with `REACT_ROWS` covering every inventory row.
(FR-016, FR-017)

### Phase 5 — Example workspace

`examples/vite-react-testbed`: `libs/ui` with the Angular testbed's ten simple components
plus complex ones, a near-empty `apps/demo`, a generated and committed manifest, and the
Discovery Skill installed verbatim by `acm init`. (FR-018)

### Phase 6 — Docs

The analyzer README's supported-pattern table, the root README, `llms.txt`, and
`.prettierignore` for `examples/`.

## Risks

- **Golden churn.** Phase 2 widens what a props type resolves to, so any fixture whose
  props type was previously unresolvable gains inputs. Only `witness/react` is at risk and
  it is same-file, so the expectation is zero diff; if a golden does move it is a reviewed
  diff, never an incidental one (invariant #6).
- **Member ordering.** FR-008 exists because byte-pinned goldens make ordering a public
  contract. It is asserted directly rather than left to emerge from traversal order.
- **Scope creep into the checker.** `Omit`/`Pick`/`Partial`/`Required` are the boundary.
  Anything beyond them (conditional types, mapped types, generics instantiated across
  modules) is unresolved-and-recorded, not half-inferred.
