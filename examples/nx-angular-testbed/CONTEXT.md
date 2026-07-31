# Context — nx-angular-testbed

A minimal Nx monorepo used to test whether an AI coding agent automatically discovers
and uses real components instead of inventing markup, when the project's UI library
publishes an **ACM Manifest** (`agentic-component-manifest.json`).

## Layout

- `libs/ui` (`@testbed/ui`) — an Angular component library, 10 simple components
  (Button, Badge, Alert, Card, TextField, Checkbox, Avatar, Spinner, Tabs, Tooltip).
  Each has inputs, and most have events and/or content-projection slots. Its ACM
  Manifest is generated from source by `@xgentic/acm-analyzer` and committed at
  `libs/ui/agentic-component-manifest.json`.
- `apps/demo` (`demo`) — an intentionally near-empty Angular application shell that
  depends on `@testbed/ui`. It ships with no pre-built UI so that any request to add
  UI forces a real choice: discover a component from `@testbed/ui`, or explicitly
  report that none fits.

## The discovery mechanism

`@xgentic/acm` (the `acm` CLI) assembles a **Manifest Corpus** per invocation from the
current project plus every `node_modules` package that ships an
`agentic-component-manifest.json`. Because `@testbed/ui` is an npm workspace package,
it is symlinked into `node_modules/@testbed/ui`, so its manifest is discovered
automatically — no extra configuration needed.

The **ACM Discovery Skill** (`.claude/skills/acm-discovery/`, installed via `acm init`)
teaches an agent the two-call loop:

1. `npx acm search "<need>" --json` — free-text search over the corpus.
2. Run the chosen result's `followUp` (an `acm component ...` invocation) with
   `--json` — fetch that component's full, verbatim spec (inputs, events, slots).
3. Build only from that spec. Never invent a prop, event, or slot.

`acm` and `acm-analyzer` are **devDependencies**, not global installs — invoke them via
`npx acm ...` / `npx acm-analyzer ...` (or `node_modules/.bin/acm ...`), since a bare
`acm` is not on `PATH`.

See [AGENTS.md](AGENTS.md) for the hard rules this project holds every agent to.
