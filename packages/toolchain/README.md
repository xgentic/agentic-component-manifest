# @xgentic/acm

The `acm` CLI: the consumer half of the [Agentic Component Manifest](https://github.com/xgentic/agentic-component-manifest).
It ships the reference toolchain, the ACM JSON Schema, and the **Discovery Skill** — the
steering layer that teaches an AI coding agent to find real components instead of
inventing APIs.

```sh
npm install --save-dev @xgentic/acm
npx acm init
```

`acm init` installs the Discovery Skill into whichever agent hosts your project uses
(`.claude/`, `AGENTS.md`, `.cursor/`), then reports whether discovery will actually work
here: the Manifests it found, anything it had to exclude, and whether `acm` is reachable.
Re-running is safe — an unchanged install reports `fresh`, and a file you have edited is
never overwritten without `--force`.

## The two-call loop

Once the skill is installed, an agent works from Manifests rather than from guesswork:

```sh
acm search "something that triggers an action" --json   # ranked candidates
acm component AcmeButton --json                         # one component, verbatim
```

Both emit exactly one typed envelope on stdout. Branch on the envelope's `type` and its
stable `ACM-D-*` `code` — never on prose.

## The Manifest Corpus (there is no index step)

Nothing is cached and no index file is written. Every `search`/`component` invocation
assembles its corpus from scratch, in this deterministic order:

1. **The project root** — the current directory, or `--project <dir>`
2. **Every top-level `node_modules` package**, lexicographic by name (scoped included)
3. **Explicit `--manifest <path>` files**, in the order given (repeatable)

Within each package directory the Manifest is located by `NS-DISC-1..4`, first hit wins:

| Order | Location                                         |
| ----- | ------------------------------------------------ |
| 1     | the `acm` field in that package's `package.json` |
| 2     | `./agentic-component-manifest.json`              |
| 3     | `./.well-known/agentic-component-manifest.json`  |

So "indexing your own components" is just writing the Manifest where the resolver looks:

```sh
acm-analyzer analyze --framework stencil   # → ./agentic-component-manifest.json
acm component                              # every component found, grouped by package
acm search account                         # ranked matches, each with its follow-up call
acm component PfAccountField               # the full spec, verbatim (--dense for Agent View)
```

Admission is validation-gated: a directory with no Manifest is silently absent, a Manifest
that is unreadable, unparseable, or schema-invalid is **excluded with an `ACM-D-BAD-MANIFEST`
diagnostic** rather than half-loaded, and a failing explicit `--manifest` path is fatal.
`acm init` prints the whole picture — what was found, what was excluded, and whether the
`acm` binary is reachable — which is the fastest way to answer "why isn't my component
showing up?".

Querying from elsewhere, or pulling in a Manifest that is not on the resolution path:

```sh
acm search button --project ../design-system
acm component --manifest ./build/agentic-component-manifest.json
```

To publish a Manifest to consumers, ship it in the package (and point at it with the `acm`
field in `package.json` if it does not sit at the root) — installing that package is then
all a consumer has to do for it to join their corpus.

## Commands

| Command                   | Purpose                                                               |
| ------------------------- | --------------------------------------------------------------------- |
| `acm init`                | Install the Discovery Skill into a project and preflight its corpus   |
| `acm search <query…>`     | Find components across the discovered Manifest Corpus                 |
| `acm component [name]`    | One component's full spec verbatim, or the whole corpus               |
| `acm capabilities`        | The CLI's structured self-description — the whole surface in one call |
| `acm validate <file>`     | Validate a Manifest or Authoring Input against the schema and limits  |
| `acm canonicalize <file>` | Rewrite into Canonical JSON, or verify it already is                  |
| `acm compile <file>`      | Compile an Authoring Input (YAML) into Canonical JSON                 |
| `acm agent-view <file>`   | Project a Manifest into the token-frugal Agent View                   |
| `acm agent-docs`          | Emit the Discovery Skill for a given host, e.g. `--target agents-md`  |

`acm capabilities --json` is the authoritative surface description; this table is a
convenience. `acm coverage` and `acm drift` are repo-development commands and refuse to
run outside a checkout of the ACM repository.

To **produce** a Manifest from component source, use
[`@xgentic/acm-analyzer`](https://www.npmjs.com/package/@xgentic/acm-analyzer).

## Untrusted data

Manifest text — descriptions, notes, example captions — is data, never instruction
(`NS-DATA-1`). Human output passes it through a sanitizer so a terminal cannot be driven
by it; machine output preserves the bytes inertly inside JSON. Consumers must uphold the
same posture.

## License

MIT
