# Tasks: React support

Dependency-ordered. Phases 1–3 are all in
[packages/analyzer/src/frameworks/react.ts](../../packages/analyzer/src/frameworks/react.ts)
unless noted.

## Phase 1 — Recognition

- [x] **T001** `unwrapWrapper`: accept member-expression callees (`React.forwardRef`,
      `React.memo`) by matching the property name; recurse through nested wrappers,
      keeping the innermost function and innermost non-empty `typeArguments`
- [x] **T002** `componentOf`: read a `React.FC<P>` / `FC<P>` / `FunctionComponent<P>` /
      `VFC<P>` variable annotation as the props source when the parameter carries none
- [x] **T003** `componentOf`: recognize class components extending
      `Component<P>` / `PureComponent<P>`; public methods via `shared.ts`'s
      `isPublicMember` + `methodDraft`
- [x] **T004** identity: `export: "default"` for a default-exported component

## Phase 2 — Props resolution

- [x] **T005** `collect(module, ctx)` hook building the plugin-local index: interfaces and
      type aliases keyed `${module.path}#${name}`, plus per-module import bindings
- [x] **T006** relative-specifier resolution against the known module-path set
      (`.ts`/`.tsx`/`.d.ts`, `index.*`); bare specifiers resolve to nothing
- [x] **T007** `propsMembers` → a resolver handling type literals, local and imported
      references, `extends` heritage, and intersections, with the FR-008 ordering and
      collision rule
- [x] **T008** utility types: `Partial`, `Required`, `Omit`, `Pick` (literal / literal-union `K`)
- [x] **T009** cycle set on `${path}#${name}` and a resolution depth bound
- [x] **T010** `x-react.unresolvedProps` via `EntryDraft.set()` for every props type that
      does not resolve; assert no member is contributed

## Phase 3 — Members

- [x] **T011** `destructuringDefaults`: key on `el.propertyName ?? el.name`
- [x] **T012** `imperativeMethods`: accept `React.useImperativeHandle`; accept property
      assignments with function/arrow initializers
- [x] **T013** recover imperative-method parameter and return types from the handle type
      when it resolves in the project index
- [x] **T014** `children` → input **and** default slot, unless an unnamed `@slot` exists

## Phase 4 — Fixtures and gates

- [x] **T015** `packages/conformance/fixtures/analyzer/react/` — source + package.json
      covering each recognition form, cross-file `extends`, intersection, `Omit`/`Partial`,
      class component, default export, unresolved fallback
- [x] **T016** generate its byte-pinned golden; add
      `{ dir: "analyzer/react", framework: "react" }` to `CASES` in
      `packages/conformance/tests/analyzer-witness.test.ts`
- [x] **T017** `packages/conformance/fixtures/testbed/react/` — `AcmeDataGrid` as real
      compiling TSX, `types/react.d.ts` stub, `tsconfig.json`
- [x] **T018** generate `agentic-component-manifest.json` + `acm.view.yml` goldens
- [x] **T019** React section in
      [contracts/testbed-inventory.md](../002-acm-analyzer-cli/contracts/testbed-inventory.md)
      (rows R1–R13)
- [x] **T020** `REACT_ROWS` + `{ fw: "react", dir: "testbed/react" }` in
      `packages/conformance/tests/analyzer-testbed.test.ts`
- [x] **T021** confirm `witness/react`'s golden is unchanged (SC-003)

## Phase 5 — Example workspace

- [x] **T022** `examples/vite-react-testbed` root: `pnpm-workspace.yaml`, `package.json`,
      `tsconfig`, Vite + Vitest config, `.gitignore`, `.prettierrc`
- [x] **T023** `libs/ui` simple components — Button, Badge, Alert, Card, TextField,
      Checkbox, Avatar, Spinner, Tabs, Tooltip (parity with the Angular testbed)
- [x] **T024** `libs/ui` complex components — generic `DataTable` (typed columns,
      imperative handle, ≥ 4 events, named slots), generic `Combobox`, `Dialog`,
      compound `Form`; props types split across modules with `extends` / `Omit`
- [x] **T025** `apps/demo` — near-empty Vite React shell depending on `@testbed/ui`
- [x] **T026** generate and commit `libs/ui/agentic-component-manifest.json`; wire the
      `acm:generate` script
- [x] **T027** `acm init` the Discovery Skill; verify bytes equal `acm agent-docs`
- [x] **T028** `README.md` / `AGENTS.md` / `CONTEXT.md` for the workspace

## Phase 5b — Corpus discovery of workspace packages (FR-019)

Found while wiring T027: `acm search` reported an empty corpus in the new testbed, and in
`nx-angular-testbed` too. `readdir` reports a symlink by its own type, so
`dirent.isDirectory()` skipped every workspace-linked package.

- [x] **T027a** `isPackageDir()` in `packages/toolchain/src/corpus.ts`: admit a symlink
      whose target is a directory; a dangling link resolves to false rather than throwing
- [x] **T027b** two regression gates in
      `packages/conformance/tests/discovery-gates.test.ts` — a symlinked package is
      discovered, a dangling symlink is skipped. Both verified to fail without T027a.

## Phase 5c — Tier-2 doc metadata in the testbeds (FR-020, FR-021)

- [x] **T027c** `jsx: ts.JsxEmit.Preserve` in `packages/analyzer/src/examples-verify.ts`
- [x] **T027d** two gates in `analyzer-gates.test.ts` via a new `analyzeTsx` helper: a
      `.tsx` component keeps both its `tsx` and `ts` examples; a JSX example that misuses
      the props is still rejected with `ACM-A-EXCOMPILE`
- [x] **T027e** `@acmSemantic` + `@example` on all 14 `vite-react-testbed` components
      (21 compile-verified examples; `Form` carries no term by design)
- [x] **T027f** `@acmSemantic` + `@example` (html fences) on all 10 `nx-angular-testbed`
      components; both Manifests regenerated
- [x] **T027g** "Integration examples" section in both testbed READMEs

## Phase 6 — Docs

- [x] **T029** `packages/analyzer/README.md` — supported React patterns + resolution rules
- [x] **T030** root `README.md`, `llms.txt`
- [x] **T031** `examples/` added to root `.prettierignore`

## Verification

- [x] **T032** `pnpm test`, `pnpm test:seeded`, `pnpm lint`, `pnpm drift`
- [x] **T033** `tsc --noEmit` over `fixtures/testbed/react`
- [x] **T034** in the example workspace: install, regenerate the manifest (no diff),
      build, and drive `acm search` → `acm component`
