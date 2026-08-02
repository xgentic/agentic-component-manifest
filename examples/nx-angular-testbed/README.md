# nx-angular-testbed

An Nx monorepo testbed for the [ACM Discovery Skill](../../packages/discovery-skill):
does an AI coding agent automatically discover and use real components from
`@testbed/ui`, instead of inventing markup, when asked to build UI in `apps/demo`?

See [CONTEXT.md](CONTEXT.md) for the layout and discovery mechanism, and
[AGENTS.md](AGENTS.md) for the rules every agent working here is held to.

## Setup

```sh
npm install
```

## Commands

```sh
npx nx build ui              # build the @testbed/ui component library
npx nx test ui               # run its unit tests, incl. @slot/<ng-content> parity
npx nx run ui:acm:generate   # regenerate libs/ui/agentic-component-manifest.json
npx nx build demo            # build the demo app
npx nx test demo             # run the demo app's unit tests
npx acm search "button" --json         # try the discovery loop directly
npx acm component Button --json
```

## Integration examples

Every component carries two Tier-2 fields that exist purely to make an agent's job
easier. Both are authored in the source doc comment and derived by the analyzer — never
hand-written into the Manifest.

### `@acmSemantic` — what the component *is*

A term from ACM's controlled vocabulary (~45 Open-UI / WAI-ARIA-anchored values), plus
free-text notes:

```ts
/**
 * A tabbed container that shows one panel at a time.
 * @acmSemantic tabs - Switches between sibling panels; only one panel is visible at a time.
 */
```

This is what lets discovery match intent rather than wording — search ranks name,
Identity Facets, and semantic terms above prose mentions, so a query like `"textbox"`
finds `TextField` even though the word never appears in its description.

### `@example` — usage in real template syntax

Standard JSDoc `@example` blocks, one manifest entry each, in source order. For Angular
these are `html` fences, because the integration an agent needs to get right is the
template — bindings, two-way syntax, and which attribute selects which projection slot:

```ts
/**
 * @example Header, body, and footer
 * ```html
 * <tb-card [elevation]="2">
 *   <h3 header>Invoice #1042</h3>
 *   Due in 14 days.
 *   <tb-button footer variant="primary">Pay now</tb-button>
 * </tb-card>
 * ```
 */
```

HTML examples are surfaced **verbatim and never compiled** — there is no TypeScript
program for a template. The `@slot`/`<ng-content>` parity test (`npx nx test ui`) is what
keeps the projection surface honest instead.

`ts` examples are compile-verified against the component in a hermetic sandbox, but that
sandbox resolves no `node_modules`, so an Angular component's `@angular/core` imports put
TypeScript examples out of reach here. Template examples are both the safer and the more
useful choice for this library.

### What an agent actually receives

```sh
npx acm search "tabs" --json          # → Tabs, matched on its semantic term
npx acm component Tabs --json         # → inputs, events, slots, semantics, examples
```
