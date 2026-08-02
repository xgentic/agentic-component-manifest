# vite-react-testbed

A Vite + pnpm workspace testbed for the [ACM Discovery Skill](../../packages/discovery-skill):
does an AI coding agent automatically discover and use real components from `@testbed/ui`,
instead of inventing markup, when asked to build UI in `apps/demo`?

The React counterpart of [`nx-angular-testbed`](../nx-angular-testbed). Its component
library carries both simple components and complex ones (`DataTable`, `Combobox`,
`Dialog`, `Form`) — the cases where guessing from training data is most tempting and most
wrong.

See [CONTEXT.md](CONTEXT.md) for the layout and discovery mechanism, and
[AGENTS.md](AGENTS.md) for the rules every agent working here is held to.

## Setup

```sh
pnpm install
```

> **Use this repository's CLIs, not the registry ones.** The published
> `@xgentic/acm@0.1.0` and `@xgentic/acm-analyzer@0.1.0` predate two fixes this workspace
> depends on: the analyzer's entry guard (the installed `acm-analyzer` exits 0 having done
> nothing) and corpus discovery of symlinked workspace packages (`acm search` finds an
> empty corpus). Both are fixed in this repo and unreleased. Until the next publish, drive
> the workspace with the checkout:
>
> ```sh
> alias acm='npx tsx ../../packages/toolchain/src/cli.ts'
> alias acm-analyzer='npx tsx ../../packages/analyzer/src/cli.ts analyze'
> ```
>
> The devDependencies are declared as a real consumer would declare them, so once those
> fixes ship the commands below work unmodified.

## Commands

```sh
pnpm --filter @testbed/ui build           # build the component library
pnpm --filter @testbed/ui test            # run its unit tests (Manifest ⇄ source parity)
pnpm --filter @testbed/ui acm:generate    # regenerate libs/ui/agentic-component-manifest.json
pnpm --filter demo build                  # build the demo app
pnpm typecheck                            # typecheck the whole workspace
pnpm acm search "data table" --json       # try the discovery loop directly
pnpm acm component DataTable --json
```

## What the library contains

| Component | Shape |
|---|---|
| Button, Badge, Alert, Card, TextField, Checkbox, Avatar, Spinner, Tabs, Tooltip | simple props, some with slots and CSS custom properties |
| `DataTable` | generic typed columns, pagination, selection, imperative handle, projected toolbar |
| `Combobox` | async option loading, imperative handle, `Omit`-derived props |
| `Dialog` | focus trapping, typed dismissal reasons, imperative handle |
| `Form` | validation, submission, imperative handle |

Every props type is assembled from shared bases in `libs/ui/src/lib/props.ts`, which is
what makes the Manifest a real test of the analyzer's cross-module resolution rather than
a single-file toy.

## Integration examples

Every component carries two Tier-2 fields that exist purely to make an agent's job
easier. Both are authored in the source doc comment and derived by the analyzer — never
hand-written into the Manifest.

### `@acmSemantic` — what the component *is*

A term from ACM's controlled vocabulary (~45 Open-UI / WAI-ARIA-anchored values), plus
free-text notes:

```ts
/**
 * A sortable, selectable, paginated table for tabular data.
 * @acmSemantic grid - Two-dimensional tabular data with selectable, activatable rows.
 */
```

This is what lets discovery match intent rather than wording. `acm search "grid"` returns
`DataTable` even though neither its name nor its description contains the word — the
classification carries it. Search ranks name, Identity Facets, and semantic terms above
prose mentions.

`Form` deliberately carries **no** `@acmSemantic`: the vocabulary has no term for a field
group, and an absent classification is honest where a wrong one would mislead.

### `@example` — usage that is guaranteed to compile

Standard JSDoc `@example` blocks, one manifest entry each, in source order:

```tsx
/**
 * @example Multi-select with pagination
 * ```tsx
 * const paged = (
 *   <DataTable
 *     columns={[]}
 *     rows={[]}
 *     selectionMode="multi"
 *     pageSize={50}
 *     onSelectionChange={(ids) => console.log(ids.length)}
 *   />
 * );
 * ```
 */
```

Before an example reaches the Manifest it is **type-checked against the component** in a
hermetic sandbox. An example that misuses the API is dropped with an `ACM-A-EXCOMPILE`
warning naming the error, so a shipped Manifest never contains usage that does not work.
That happened while writing these: an early `TextField` example referenced
`TextFieldHandle`, which the sandbox does not import, and the gate rejected it.

Two consequences worth knowing:

- The sandbox injects `import { Component } from './component'` for you and resolves
  **relative** imports between analyzed modules only. An example cannot import from
  `@testbed/ui` or `react`, so keep each one self-contained.
- Imperative handles are documented by `methods[]` rather than by example code, since
  constructing a typed ref would need imports the sandbox cannot resolve.

### What an agent actually receives

```sh
pnpm acm search "grid" --json         # → DataTable, matched on its semantic term
pnpm acm component DataTable --json   # → inputs, methods, slots, semantics, examples
```

The second call returns all 18 props with descriptions and types, the four imperative
methods with signatures, the slots, the CSS custom properties and parts, the semantic
classification, and the three compile-verified examples above.
