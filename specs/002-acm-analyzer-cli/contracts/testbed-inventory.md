# Contract: stress-testbed capability inventory (FR-014 / SC-008)

The testbed is one maximally complex, DataGrid-class component per framework, checked
in as **real, compiling source** with a **byte-pinned golden manifest**
(`agentic-component-manifest.json` + `acm.view.yml`). The SC-008 conformance test walks this inventory:
every row must be present in the source AND produce the stated node in the golden,
and analyzing the source must byte-match the golden. A row that cannot be satisfied
is a reviewed inventory change, never a silent drop.

Fixture locations: `packages/conformance/fixtures/testbed/lit/`,
`packages/conformance/fixtures/testbed/stencil/`,
`packages/conformance/fixtures/testbed/angular/`.

## Lit — `AcmeDataGrid` (`acme-data-grid`)

| # | Capability (source construct) | Expected manifest node |
|---|-------------------------------|------------------------|
| L1 | `@customElement('acme-data-grid')` | identity: `tagName`, `paradigmClass: retained-dom`, module + export facets |
| L2 | ≥ 10 `@property()` reactive properties | `inputs[]`, source order |
| L3 | literal-union-typed property (`'single' \| 'multi' \| 'none'`) | input `type.structured.kind: union` of literals + verbatim `raw` |
| L4 | generic-bearing reference type (`GridColumn<T>[]`-style) | structured per mapping rules; array-of-reference |
| L5 | function-typed property (row-class callback) | structured function mapping or documented opaque fallback + `raw` |
| L6 | deeply-structured object type beyond depth bound | grammar's **opaque fallback** + verbatim `raw` (the negative-space rule proven) |
| L7 | `@property({ reflect: true })` | input `reflects: true` |
| L8 | `@property({ converter: … , attribute: '…' })` | attribute-name mapping captured; converter presence does not corrupt type tiers |
| L9 | property with initializer | input `default` verbatim |
| L10 | JSDoc on every public member | `description` verbatim; one member deliberately undocumented → `description` **absent** |
| L11 | ≥ 4 typed `CustomEvent` dispatches + `@fires` JSDoc | `events[]` with typed `payload` |
| L12 | default slot + ≥ 3 named slots (`@slot` JSDoc) | `slots[]`: one unnamed + named entries |
| L13 | ≥ 3 public methods incl. one async with parameters/defaults | `methods[]` with parameter + return types |
| L14 | private/`#`-prefixed/`@state` members present in source | **absent** from manifest (negative assertion) |
| L15 | ≥ 4 CSS custom properties (`@cssprop` with syntax + default) | `cssProperties[]` |
| L16 | ≥ 3 CSS parts (`@csspart`) | `cssParts[]` |
| L17 | `static formAssociated = true` | form-associated surfaced per schema's WC nodes |

## Angular — `AcmeDataGridComponent` (`acme-data-grid`)

| # | Capability (source construct) | Expected manifest node |
|---|-------------------------------|------------------------|
| A1 | standalone `@Component({ selector: 'acme-data-grid', … })` | identity: `selector`, `paradigmClass: signals-di`, module + export facets; **no `tagName`** (negative assertion) |
| A2 | decorated `@Input()` properties incl. one aliased (`@Input('alias')`) and one with `transform` | `inputs[]` under public (aliased) names |
| A3 | signal inputs: `input<T>(default)` and `input.required<T>()` | `inputs[]`; required/optional distinction per schema |
| A4 | ≥ 2 `model()` two-way pairs | input with `twoWay: true` — the two-way pair encoded on the input, not a synthetic change output (reviewed refinement 2026-07-19: matches the authoritative `witness/angular` golden per FR-013, and avoids inventing `<name>Change` event names — Principle IV) |
| A5 | decorated `@Output() EventEmitter<T>` and signal `output<T>()` | `events[]` with typed payloads |
| A6 | multi-selector content projection: ≥ 3 `<ng-content select="…">` + default `<ng-content>` | `slots[]`: named-by-selector + default |
| A7 | host-level CSS custom properties (documented `--acme-*`) + `@HostBinding` | `cssProperties[]` |
| A8 | injected configuration (`inject(TOKEN)` / constructor DI) in source | **absent** from manifest (negative assertion — DI is not API surface) |
| A9 | ≥ 3 public methods incl. async | `methods[]` |
| A10 | `protected`/`private` members and internal signals in source | **absent** from manifest (negative assertion) |
| A11 | JSDoc on every public member; one member deliberately undocumented | `description` verbatim / absent respectively |
| A12 | literal-union, generic-reference, function-typed, and beyond-depth inputs (mirror of L3–L6) | same four structured-tier behaviors incl. opaque fallback |

## Stencil — `AcmeDataGrid` (`acme-data-grid`)

| # | Capability (source construct) | Expected manifest node |
|---|-------------------------------|------------------------|
| S1 | `@Component({ tag: 'acme-data-grid', shadow, formAssociated })` | identity: `tagName`, `paradigmClass: retained-dom`, module + export facets |
| S2 | ≥ 10 `@Prop()` properties | `inputs[]`, source order |
| S3 | literal-union-typed prop (`'single' \| 'multi' \| 'none'`) | input `type.structured.kind: union` of literals + verbatim `raw` |
| S4 | generic-bearing reference type (`GridColumn<RowData>[]`) | structured array-of-reference |
| S5 | function-typed prop (row-class callback) | structured function mapping or documented opaque fallback + `raw` |
| S6 | deeply-structured object type beyond depth bound | grammar's **opaque fallback** + verbatim `raw` (negative-space rule) |
| S7 | `@Prop({ reflect: true })` | input `reflects: true` |
| S8 | `@Prop({ attribute: 'data-label' })` | explicit attribute alias captured as `x-attribute`; type tiers intact |
| S9 | `@Prop({ mutable: true })` | mutability surfaced as `x-stencil: { mutable: true }` (extension node — not a core field, Principle IV) |
| S10 | prop with initializer | input `default` verbatim |
| S11 | JSDoc on every public member; one member deliberately undocumented | `description` verbatim; undocumented → `description` **absent** |
| S12 | ≥ 4 `@Event() EventEmitter<T>` incl. one `{ eventName }` alias | `events[]` with typed `payload`; aliased public name |
| S13 | default slot + ≥ 3 named slots (`@slot` JSDoc) | `slots[]`: one unnamed + named entries |
| S14 | ≥ 3 `@Method() async` incl. one with parameters/defaults | `methods[]` with parameter + `Promise<…>` return types |
| S15 | `@State()`/`@Element()`/`@Watch()`/`@Listen()` members **and** a plain public method with no `@Method()` | **absent** from manifest (negative assertion — methods are opt-in via `@Method()`) |
| S16 | ≥ 4 CSS custom properties (`@cssprop`) + ≥ 3 CSS parts (`@csspart`) | `cssProperties[]` / `cssParts[]` |
| S17 | `@Component({ formAssociated: true })` | form-associated surfaced as the `x-wc` node |
| S18 | camelCase serializable props (`selectionMode`, `pageSize`) vs single-word (`dense`) vs complex (`columns`) | implicit dash-cased `x-attribute` (`selection-mode`, `page-size`) derived per Stencil's rule; **absent** when the attribute name equals the property name or the type is property-only (parity with the CEM analyzer — see [stencil-cem-comparison](../../../docs/research/stencil-cem-comparison.md)) |

## Shared gate assertions

1. **Byte-match**: `analyze(testbed/<fw>/src) ≡ testbed/<fw>/agentic-component-manifest.json` byte-for-byte;
   `acm.view.yml` matches the Agent View emitter output for the golden.
2. **Compiles**: each source typechecks under the repo's TypeScript (spec assumption
   "real, compiling source"); the Angular and Stencil sources typecheck against dev-time
   framework type stubs checked in with the fixture (`types/angular-core.d.ts`,
   `types/stencil-core.d.ts`) — no runtime framework dependency.
3. **Inventory totality**: SC-008 test iterates every row above; each row maps to at
   least one machine assertion (presence, shape, or negative).
4. **Determinism**: analyzing each testbed twice yields identical bytes (feeds
   SC-002's two-platform CI matrix).
