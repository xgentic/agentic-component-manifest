# Research: React support

## R-07-A — Cross-module props resolution (supersedes R-07's same-file clause)

- **Decision**: React props types resolve across **the modules the analyzer has already
  discovered and parsed**, not just the declaring file. Resolution is syntactic — an
  index built during the `collect` phase, plus relative-specifier matching against the
  known module-path set. No TypeScript type checker, no `node_modules`, no filesystem
  access beyond what discovery already did. Type references that leave that set
  (bare package specifiers, unresolvable names) contribute nothing and are recorded
  verbatim under `x-react.unresolvedProps`.

- **Rationale**: R-07 chose "same-file only" and R-01 chose "no checker" for the same
  reason — a run must be reproducible from its flags and its source, with no dependency
  on an install tree or on type-resolution order. Cross-module *syntactic* resolution
  keeps both properties: the module set is fixed by the globs before any plugin runs, and
  resolution is a pure function of parsed ASTs. What R-07 actually rejected was
  *checker-based* resolution, and that rejection stands.

  The empirical case is decisive. Splitting props types across files is not an exotic
  React idiom, it is the normal one — a `BaseProps` in one module, `extends` in another,
  `Omit` to drop a field. Under same-file-only, such a library analyzes to a manifest
  that is schema-valid and semantically empty, which makes discovery return nothing and
  pushes an agent back to inventing markup.

- **Determinism obligations** this decision creates, all of them testable:
  - member order fixed by FR-008 (bases in clause order, then own; intersections left to
    right; most-derived wins at the first occurrence's position);
  - cycle termination and a depth bound (FR-009);
  - unresolvable types contribute **no** members, ever (FR-010).

- **Alternatives considered**:
  - *Keep same-file only.* Rejected: it is the status quo whose failure motivated this
    feature.
  - *Use the TypeScript checker.* Rejected, unchanged from R-01/R-07: output would depend
    on `node_modules` and on `tsconfig` resolution, and the analyzer would inherit the
    checker's inference rules rather than the ones this spec pins.
  - *Follow bare specifiers into `node_modules`.* Rejected: same reproducibility problem
    in a smaller package, and it would put `React.HTMLAttributes`'s hundred-odd DOM
    attributes into every button's `inputs[]`, drowning the props the library actually
    defines.
  - *react-docgen.* Rejected, unchanged from R-07: divergent AST layer, and its inference
    rules are not ours to pin.

## R-19 — Where cross-module state lives

- **Decision**: the index lives in the React plugin's own closure, populated by the
  existing `collect(module, ctx)` hook. No plugin-API change.

- **Rationale**: `collect` runs over *every* module before *any* `analyze` runs
  ([analyzer.ts](../../packages/analyzer/src/analyzer.ts) — the collect loop precedes the
  analyze loop), so by the time a declaration is analyzed the index is complete. This is
  the same shape [vanilla.ts](../../packages/analyzer/src/frameworks/vanilla.ts) already
  uses for its `customElements.define` map. Keeping the state plugin-local preserves
  SC-005 of spec 002: built-ins and external plugins see the same seam, and an external
  plugin could implement identical resolution.

- **Alternatives considered**: adding a cross-module view to `SessionContext` (rejected:
  a core API widened for one plugin's convenience, when the existing lifecycle already
  provides the ordering guarantee).

## R-20 — `children`

- **Decision**: a `children` prop yields **both** an input and the default slot, unless an
  unnamed slot was already declared via `@slot` JSDoc, in which case the JSDoc wins and no
  duplicate is emitted.

- **Rationale**: both statements are mechanically true. `children` *is* a prop — dropping
  it from `inputs[]` would hide a real part of the call signature. It is also the content
  channel, and the whole point of `slots[]` is to tell an agent where content goes; an
  agent reading only `inputs[]` would not know that `<Card>text</Card>` is legal. The
  JSDoc-wins rule keeps authored descriptions authoritative and makes the output
  single-valued.

- **Alternatives considered**: input only (rejected: loses the content channel, and makes
  React the only framework whose default slot is invisible); slot only (rejected: hides a
  prop that exists, and would drop its type).

## R-21 — Example workspace stack

- **Decision**: `examples/vite-react-testbed` uses Vite + pnpm workspaces.
  `examples/nx-angular-testbed` keeps Nx.

- **Rationale**: the testbeds exist to measure one thing — whether an agent discovers
  components instead of inventing them. That behavior is a function of the manifest, the
  installed skill, and the near-empty demo app, none of which depend on the build tool.
  Vite + pnpm is materially cheaper to install and to read, and differing stacks is
  incidentally useful: it shows the discovery loop is not coupled to Nx.

- **Alternatives considered**: mirroring Nx for maximum parity (rejected: a second 30k-line
  lockfile and an Nx graph to maintain, buying comparability on a dimension that is not
  being compared).
