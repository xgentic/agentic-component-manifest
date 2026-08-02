# Feature Specification: React support

**Feature Branch**: `007-react-support`

**Created**: 2026-08-02

**Status**: In progress

**Input**: User description: "plan to add support for reactjs, add also a testbed with
examples as we did with angular, create also complex examples".

## Problem

React is already a *nominal* framework. It is in `BUILTIN_FRAMEWORKS`, it has a plugin
([react.ts](../../packages/analyzer/src/frameworks/react.ts)), a witness fixture
(`packages/conformance/fixtures/witness/react/`), CLI and config wiring, and unit tests.
What it does not have is extraction that survives contact with a real component library.

Probed against ordinary React source, the plugin as shipped produces:

| Source pattern | Result |
|---|---|
| `React.forwardRef<H, P>(…)` | declaration entirely missing |
| `memo(forwardRef(…))` nested | declaration entirely missing |
| `const C: React.FC<Props> = …` | declaration found, zero inputs |
| `interface P extends BaseProps` (imported) | base props silently dropped |
| `type P = A & B` | zero inputs |
| `useImperativeHandle(ref, () => ({ open: () => {} }))` | method dropped |
| `class X extends React.Component<P>` | not recognized (R-07 promises it) |

Only a bare `forwardRef`/`memo` identifier over a same-file props interface works. A
library that splits props types across files — which is the normal shape — gets a
manifest that is technically valid and practically empty. An empty manifest is worse
than no manifest: discovery returns nothing and an agent falls back to inventing markup,
which is the exact failure ACM exists to prevent.

Two structural gaps sit alongside it. React is the only shipped framework with **no
stress testbed fixture** — lit, angular, and stencil each have one under
`packages/conformance/fixtures/testbed/` with a byte-pinned golden — and the only one
with **no example workspace**, where Angular has `examples/nx-angular-testbed`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A React library author gets a manifest that describes their library (Priority: P1)

Someone maintaining a React component library runs `acm-analyzer analyze --framework
react`. Their components use `forwardRef`, `memo`, `React.FC`, and props types assembled
from shared bases with `extends`, intersections, and `Omit`. The manifest names every
component and every prop those components actually accept.

**Acceptance**: the `testbed/react` fixture — a DataGrid-class component using all of
those forms — byte-matches its golden, and every row of the React capability inventory in
[testbed-inventory.md](../002-acm-analyzer-cli/contracts/testbed-inventory.md) maps to a
passing machine assertion.

### User Story 2 - The manifest never invents a prop it could not see (Priority: P1)

The same library extends `React.HTMLAttributes<HTMLButtonElement>`, which lives in
`node_modules` and is deliberately out of the analyzer's reach. The manifest does not
guess at its members, and does not silently pretend the base was not there.

**Acceptance**: an unresolvable props type is recorded verbatim under
`x-react.unresolvedProps` on the declaration, and contributes zero inputs. A negative
assertion in the testbed gate proves no input was invented.

### User Story 3 - An agent discovers React components instead of inventing them (Priority: P1)

A developer opens `examples/vite-react-testbed` and asks an agent to build a screen in
`apps/demo`, without naming the Discovery Skill. The agent runs `acm search`, fetches the
component's verbatim spec with `acm component`, and builds only from it.

**Acceptance**: the workspace's `libs/ui` manifest is generated from source, covers both
simple components and complex ones (generic tables, imperative handles, named slots), and
`acm search` / `acm component` return them.

### Edge cases

- **A props type references itself**, directly or through a chain. Resolution terminates;
  the cycle contributes each member once.
- **Two bases declare the same prop.** The most-derived declaration wins, at the first
  occurrence's position — so goldens stay byte-stable regardless of resolution order.
- **A props type is imported from a bare package specifier.** Not resolved. Recorded as
  unresolved rather than followed into `node_modules`, which would break reproducibility.
- **A component has both a `children` prop and a `@slot -` JSDoc tag.** The JSDoc slot
  wins; no duplicate default slot is emitted.
- **A callback prop is named `onSelect`.** It stays an input. React has no separate event
  channel, and synthesizing one would be invention (R-07, unchanged).

## Requirements *(mandatory)*

### Recognition

- **FR-001** An exported function component is recognized whether it is a function
  declaration, an arrow function, or a function expression, and whether it is wrapped in
  `forwardRef`, `memo`, or both nested in either order.
- **FR-002** Wrapper callees are recognized as bare identifiers (`forwardRef`) and as
  member expressions (`React.forwardRef`), so a namespace import works.
- **FR-003** Props come from the first parameter's type annotation, else from a wrapper's
  props type argument, else from a `React.FC<P>` / `FC<P>` / `FunctionComponent<P>` /
  `VFC<P>` annotation on the variable.
- **FR-004** A class component (`extends React.Component<P>` / `PureComponent<P>`) takes
  props from its first type argument; its public methods become `methods[]`.
- **FR-005** A default-exported component takes `default` as its `export` identity facet.

### Props resolution

- **FR-006** Props types resolve across the modules the analyzer has already parsed.
  Resolution is syntactic: no TypeScript type checker, no `node_modules`, no filesystem
  access beyond the discovered module set. A run stays reproducible from its flags alone.
- **FR-007** The resolvable forms are: type literals; local type references; type
  references imported through a **relative** specifier; `interface X extends A, B`;
  intersections; and `Partial<T>`, `Required<T>`, `Omit<T, K>`, `Pick<T, K>` where `K` is
  a string literal or a union of them.
- **FR-008** Member order is deterministic: heritage bases in clause order, then own
  members; intersections left to right. On a duplicate name the most-derived declaration
  wins and keeps the first occurrence's position.
- **FR-009** Resolution terminates on cycles and is depth-bounded.
- **FR-010** A props type that does not resolve contributes **no** members and is recorded
  verbatim under the declaration's `x-react.unresolvedProps`. No core field is ever
  populated with an inferred or invented value (Principle IV).

### Members

- **FR-011** Each resolved prop becomes an input: `?` → optional, absent `?` → `required`,
  JSDoc → `description`, destructuring default → `default` verbatim. A renamed binding
  (`{ variant: v = 'primary' }`) attributes the default to `variant`.
- **FR-012** Callback and `on*` props remain inputs, never events.
- **FR-013** `useImperativeHandle` — bare or `React.`-qualified — contributes `methods[]`
  from both method declarations and property assignments with function initializers. When
  the ref's handle type resolves within the project, parameter and return types are taken
  from it.
- **FR-014** A `children` prop yields both an input and the default slot, unless an
  unnamed slot was already declared via `@slot` JSDoc, which wins.
- **FR-015** `@fires` / `@slot` / `@cssprop` / `@csspart` JSDoc continue to supply events,
  slots, CSS custom properties, and CSS parts, unchanged.

### Fixtures and testbed

- **FR-016** A `testbed/react` stress fixture exists as real, compiling TSX with
  byte-pinned `agentic-component-manifest.json` and `acm.view.yml` goldens, typechecking
  against a checked-in React type stub with no runtime dependency.
- **FR-017** Its capability inventory is a reviewed contract section, and every row maps
  to at least one machine assertion in the SC-008 gate.
- **FR-018** An `examples/vite-react-testbed` workspace exists with a React component
  library carrying both simple and complex components, a near-empty demo app, a generated
  and committed manifest, and the Discovery Skill installed by `acm init`.
- **FR-019** A workspace package linked into `node_modules` is part of the Manifest
  Corpus. Discovery previously admitted only real directories, so every symlinked
  package — which is how npm, pnpm, and yarn all install workspace packages — was
  invisible. Found while building FR-018's testbed; it broke `nx-angular-testbed`
  identically, so the fix is not React-specific.
- **FR-020** `@example` compile-verification loads JSX. The hermetic program set no `jsx`
  option, so the injected `import { X } from './component'` alone failed against any
  `.tsx` module — rejecting *every* example on a React component, `tsx` and `ts` alike,
  and making compile-verified examples unreachable for the framework. The option is
  `Preserve`, which type-checks JSX without requiring a runtime, so API misuse inside an
  example still fails the gate.
- **FR-021** Both example workspaces' components carry `@acmSemantic` and `@example`, so
  the Manifests exercise the Tier-2 fields an agent actually reads. A component the
  controlled vocabulary has no term for carries no classification rather than a
  misleading one.

## Success Criteria *(mandatory)*

- **SC-001** `analyze(testbed/react/src)` byte-matches its golden, and re-analysis is
  byte-identical.
- **SC-002** Every React inventory row has a passing assertion in
  `analyzer-testbed.test.ts`.
- **SC-003** The `witness/react` golden is **unchanged** by this feature — the proof that
  the extraction was deepened without altering behavior that was already correct.
- **SC-004** The full conformance suite stays green and `pnpm drift` reports fresh.
- **SC-005** No plugin-API change: the React plugin still consumes only the public seam in
  `plugin.ts`, so an external plugin could do the same thing.
- **SC-006** In `examples/vite-react-testbed`, regenerating the committed manifest from
  source produces no diff, and `acm search` finds the complex components.
- **SC-007** A symlinked package in `node_modules` is searchable, and a dangling symlink
  is skipped rather than throwing — both asserted in `discovery-gates.test.ts`.

## Out of scope

- **Cross-package resolution.** Props types imported from `node_modules` stay unresolved
  by design (FR-010's honest fallback), because following them would make output depend
  on an install tree rather than on the analyzed source.
- **`propTypes` and other legacy runtime patterns.** Already excluded by spec 002's
  assumptions.
- **Synthesizing events from `on*` props.** R-07's rule stands; changing it would put
  invented names in a Tier-1 field.
- **An Nx React workspace.** The example uses Vite + pnpm workspaces; the Angular testbed
  keeps its Nx layout, and the two are compared on discovery behavior, not on build tool.
