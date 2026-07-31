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
