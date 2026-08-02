# Context — vite-react-testbed

A minimal Vite + pnpm workspace used to test whether an AI coding agent automatically
discovers and uses real components instead of inventing markup, when the project's UI
library publishes an **ACM Manifest** (`agentic-component-manifest.json`).

It is the React counterpart of [`nx-angular-testbed`](../nx-angular-testbed). The build
tools differ on purpose — discovery depends on the Manifest, the installed skill, and the
empty demo app, not on the bundler.

## Layout

- `libs/ui` (`@testbed/ui`) — a React component library of 14 components. Its ACM
  Manifest is generated from source by `@xgentic/acm-analyzer` and committed at
  `libs/ui/agentic-component-manifest.json`.
  - **Ten simple components** — Button, Badge, Alert, Card, TextField, Checkbox, Avatar,
    Spinner, Tabs, Tooltip. The same set as the Angular testbed, so discovery behaviour
    can be compared across the two.
  - **Four complex components** — `DataTable` (generic typed columns, pagination,
    selection, an imperative handle, projected toolbar), `Combobox` (async option
    loading, an imperative handle), `Dialog` (focus trapping, dismissal reasons), and
    `Form` (validation, submission, an imperative handle). These are what a real
    component library looks like, and what an agent is most likely to get wrong from
    training data alone.
- `apps/demo` (`demo`) — an intentionally near-empty React application shell that depends
  on `@testbed/ui`. It ships with no pre-built UI so that any request to add UI forces a
  real choice: discover a component from `@testbed/ui`, or explicitly report that none
  fits.

## How props reach the Manifest

Every component's props type is assembled from shared bases in
[`libs/ui/src/lib/props.ts`](libs/ui/src/lib/props.ts) — `SurfaceBase extends Spacing`,
`FieldBase extends SurfaceBase`, plus intersected mixins such as `PaginationProps`. The
analyzer resolves those across modules, so `DataTable`'s Manifest entry lists all 18 props
it actually accepts, not just the ones written in `data-table.tsx`.

Types the analyzer cannot reach — anything imported from a package rather than a relative
path — are never guessed at. They are recorded verbatim under `x-react.unresolvedProps`
and contribute no inputs.

## The discovery mechanism

`@xgentic/acm` (the `acm` CLI) assembles a **Manifest Corpus** per invocation from the
current project plus every `node_modules` package that ships an
`agentic-component-manifest.json`. Because `@testbed/ui` is a pnpm workspace package, it
is linked into `node_modules/@testbed/ui`, so its Manifest is discovered automatically —
no extra configuration needed.

The **ACM Discovery Skill** (`.claude/skills/acm-discovery/`, installed via `acm init`)
teaches an agent the two-call loop:

1. `pnpm acm search "<need>" --json` — free-text search over the corpus.
2. Run the chosen result's `followUp` (an `acm component ...` invocation) with `--json` —
   fetch that component's full, verbatim spec (inputs, events, slots, methods).
3. Build only from that spec. Never invent a prop, event, or slot.

`acm` and `acm-analyzer` are **devDependencies**, not global installs — invoke them via
`pnpm acm ...` / `pnpm acm-analyzer ...` (or `node_modules/.bin/acm ...`), since a bare
`acm` is not on `PATH`.

See [AGENTS.md](AGENTS.md) for the hard rules this project holds every agent to.
