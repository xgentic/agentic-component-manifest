# @xgentic/acm-analyzer

The ACM reference analyzer. It statically scans component source and emits
[ACM Canonical JSON](../spec/normative-spec.md) — a framework-free `agentic-component-manifest.json` describing
each component's inputs, events, slots, methods, and CSS hooks. It is the _deriving_ path
in the [ACM architecture](../../README.md#how-it-works): source (L1) → manifest (L2).

Analysis is **syntax-only** (no type checker, no `node_modules` resolution) and
**deterministic**: the same sources always produce byte-identical output, on any platform
(SC-002). Every field the analyzer writes to a core node is a verbatim slice of the source
(Tier 1); anything an analyzer or plugin infers goes under a namespaced `x-*` key, never a
core field.

## Install & run

The analyzer discovers sources **relative to the current working directory** and writes
`<outdir>/agentic-component-manifest.json`. Run it from the root of the project you are describing:

```sh
npm install --save-dev @xgentic/acm-analyzer
npx acm-analyzer analyze [flags]
```

From a checkout of this monorepo, invoke the CLI through `tsx` instead, keeping the
target project as the working directory:

```sh
cd packages/conformance/fixtures/analyzer/vanilla
pnpm exec tsx "$(git rev-parse --show-toplevel)/packages/analyzer/src/cli.ts" analyze
# → writes ./agentic-component-manifest.json (exit 0)
```

### Then search it

There is **no index step**. `@xgentic/acm` assembles its Manifest Corpus from the
current directory on every invocation, so writing `agentic-component-manifest.json` at
your project root is the whole of "indexing":

```sh
acm-analyzer analyze --framework stencil        # produce
acm component                                   # list every component found
acm search account                              # rank matches
acm component PfAccountField --dense            # one component, verbatim, token-frugal
```

See the [toolchain README](../toolchain/README.md#the-manifest-corpus-there-is-no-index-step)
for how the corpus is assembled, how to point it at another directory, and how a
dependency's Manifest joins it.

## CLI

```
acm-analyzer analyze [--config <path>] [--globs <glob>...] [--exclude <glob>...]
                     [--outdir <dir>] [--framework <name>...] [--watch] [--dev] [--quiet]
```

| Flag          | Arg   | Meaning                                                                                                                                   |
| ------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `--config`    | path  | explicit settings file (missing file at an explicit path → exit 2)                                                                        |
| `--globs`     | glob… | include patterns; **replaces** the settings-file value, never merged                                                                      |
| `--exclude`   | glob… | exclude patterns; **replaces** the settings-file value                                                                                    |
| `--outdir`    | dir   | output directory; manifest is always `<outdir>/agentic-component-manifest.json`; created if absent                                        |
| `--framework` | name… | `vanilla` \| `lit` \| `stencil` \| `angular` \| `react`; repeatable and comma-separated; omit for vanilla. Unknown → exit 2 with the list |
| `--watch`     | —     | re-analyze on change; the process survives per-cycle failures                                                                             |
| `--dev`       | —     | verbose run trace to stderr; mutually exclusive with `--quiet` (→ exit 2)                                                                 |
| `--quiet`     | —     | suppress progress; errors still print                                                                                                     |

Precedence for every option is **CLI flag > settings file > built-in default**. Progress
and diagnostics go to **stderr**; stdout is reserved. Full contract:
[contracts/cli.md](../../specs/002-acm-analyzer-cli/contracts/cli.md).

### Exit codes

| Code | Meaning                                                                                     | Manifest written? |
| ---- | ------------------------------------------------------------------------------------------- | ----------------- |
| `0`  | success, no diagnostics                                                                     | yes               |
| `3`  | completed with warnings                                                                     | yes               |
| `1`  | failure — no valid manifest (validation/limit failure, all files unparseable, zero matches) | **no**            |
| `2`  | usage or configuration error                                                                | **no**            |

An analysis that would produce an invalid manifest is **aborted before any write** — the
last good `agentic-component-manifest.json` is never truncated or half-written.

## Frameworks

| `--framework`            | Paradigm       | Identity facets            |
| ------------------------ | -------------- | -------------------------- |
| `vanilla` _(or omitted)_ | `retained-dom` | `tagName` + module/export  |
| `lit`                    | `retained-dom` | `tagName` + module/export  |
| `stencil`                | `retained-dom` | `tagName` + module/export  |
| `angular`                | `signals-di`   | `selector` + module/export |
| `react`                  | `vdom`         | module/export              |

Vue is **not shipped in v1** (a documented gap, not a silent one) — the plugin seam below
covers it on demand. See the [type-mapping rules](docs/type-mapping.md) for how TypeScript
type syntax becomes the schema's structured `TypeNode` grammar.

### React

Recognized component forms — all of them exported, since module + export is React's only
identity:

| Form                                                          | Props come from                                      |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `function Button(props: ButtonProps)`                         | the parameter annotation                             |
| `const Button = (props: ButtonProps) => …`                    | the parameter annotation                             |
| `const Button: FC<ButtonProps> = …`                           | the `FC` / `VFC` / `FunctionComponent` type argument |
| `forwardRef<Handle, Props>(…)`, `memo(…)`, and the two nested | the wrapper's second type argument                   |
| `React.forwardRef` / `React.memo` (namespace import)          | same as above                                        |
| `class Button extends React.Component<ButtonProps>`           | the base's first type argument                       |

`export default function Shell(…)` takes `default` as its `export` identity facet.

**Props resolution is cross-module but syntactic.** There is no TypeScript checker and no
`node_modules` lookup, so a run is reproducible from its flags and its source alone. The
analyzer follows `extends` clauses, intersections, and `Partial` / `Required` / `Omit` /
`Pick` through the modules it already parsed, reached by **relative** import specifiers.
Member order is fixed: heritage bases in clause order, then own members; intersections
left to right; on a duplicate name the most-derived declaration wins at the first
occurrence's position.

A props type it cannot follow — anything from a bare package specifier, such as
`React.HTMLAttributes<HTMLButtonElement>` — contributes **no** inputs and is recorded
verbatim instead:

```jsonc
"x-react": { "unresolvedProps": ["React.HTMLAttributes<HTMLButtonElement>"] }
```

That is deliberate. Following it would make the output depend on an install tree, and
would bury the props a library actually defines under a hundred inherited DOM attributes.

Other React specifics:

- **Callback props stay inputs.** `onSelect` is a prop, not an event; React has no
  separate event channel, and synthesizing one would put an invented name in a Tier-1
  field. `events[]` comes from `@fires` JSDoc only.
- **`children` yields an input and the default slot** — it is both a prop and the content
  channel — unless a `@slot` tag already declared an unnamed slot, which wins.
- **Imperative methods** come from `useImperativeHandle`, reading both `open() {}` and
  `open: () => {}` members. When the ref's handle type resolves in the project, parameter
  and return types are taken from it, since arrow-function handles rarely annotate them.

### Mixed-framework repositories

`--framework` is repeatable, so a repository that ships more than one paradigm is **one
run**, not one run per framework. These are equivalent:

```sh
acm-analyzer analyze --framework stencil --framework react
acm-analyzer analyze --framework stencil,react
```

Plugins run in the order written, and that order is the tie-break: when two of them
recognize the same declaration — Angular and Stencil both key off `@Component` — the
first claim wins, and the dropped contribution is reported as an `ACM-A-DUPENTRY` warning
naming both plugins. Nothing is ever merged across frameworks; a declaration belongs to
exactly one paradigm class.

### Why did I get an empty manifest?

Run with `--dev`. The trace walks the pipeline in the order things can go wrong:

```text
acm-analyzer: cwd=/repo
acm-analyzer: frameworks=stencil outdir=. globs=["src/**/*.tsx"] exclude=[] plugins=0 (from defaults + flags)
acm-analyzer: discovered 42 file(s) matching ["src/**/*.tsx"] (no excludes)
acm-analyzer:   src/components/form/account-field/account-field.tsx
acm-analyzer:   … 17 more
acm-analyzer: parsed 42 file(s), skipped 0
acm-analyzer: plugins: stencil
acm-analyzer: framework imports detected: stencil ("@stencil/core", 41 file(s))
acm-analyzer:   stencil: 41 declaration(s)
acm-analyzer: summary: 42 file(s) scanned · 41 module(s) with declarations · 41 declaration(s)
```

Three diagnostics cover the empty-result cases without `--dev`:

| Code              | When                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ACM-A-NOFILES`   | the globs matched nothing — names the patterns, the directory, and `--globs`                                           |
| `ACM-A-EMPTY`     | files were scanned but nothing was extracted — names the count and framework                                           |
| `ACM-A-FRAMEWORK` | nothing was extracted **and** the sources import a framework you did not select — names it and the flag to re-run with |

`stencil` reads `@Component({ tag })` classes: `@Prop()` → inputs (`reflect`/`attribute`/
`mutable`), `@Event() EventEmitter<T>` → typed events (`eventName` alias), and `@Method()` →
methods. Unlike Lit/Angular, methods are **opt-in**: a public method with no `@Method()` is
internal and excluded; `@State`/`@Watch`/`@Listen`/`@Element` are ignored.

## Doc-comment tags

The analyzer reads component documentation from your source JSDoc/TSDoc comments. All
description text is captured **verbatim** (Tier 1 — a byte-for-byte slice of the source,
never synthesized; enrich by improving the comment, not the manifest). These block tags are
recognized on a component declaration; tag names are case-insensitive, and in each the `-`
separates the leading token(s) from an optional trailing description.

| Tag                         | Syntax                                                        | Maps to                                                     |
| --------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| _(leading text)_            | the free text above a declaration or member                   | `description` (verbatim)                                    |
| `@fires` / `@event`         | `@fires name {PayloadType} - description`                     | an `events[]` entry (`{PayloadType}` → structured payload)  |
| `@slot`                     | `@slot name - description` (omit `name` for the default slot) | a `slots[]` entry                                           |
| `@cssprop` / `@cssproperty` | `@cssprop {<syntax>} [--name=default] - description`          | a `cssProperties[]` entry                                   |
| `@csspart`                  | `@csspart name - description`                                 | a `cssParts[]` entry                                        |
| `@acmSemantic`              | `@acmSemantic <term> - <notes>`                               | `semantics` (Tier 2; `term` from the controlled vocabulary) |
| `@example`                  | standard `@example` block (fenced code)                       | an `examples[]` entry (Tier 2; **compile-verified**)        |

`{…}` carries a type/syntax, `[…]` a CSS custom-property name and default. These mirror the
[Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) tag
vocabulary (Principle VIII — shared concepts keep their names). A member's own leading doc
comment becomes that input's or method's `description`.

````ts
/**
 * A themable on/off toggle.
 * @acmSemantic switch - Reflects an on/off state; the label names the action.
 * @fires change {ToggleChangeEvent} - Fired when the state changes.
 * @slot - The toggle label content.
 * @cssprop {<color>} [--acme-toggle-fill=#0a7] - Active track fill.
 * @csspart thumb - The sliding thumb element.
 * @example Basic usage
 * ```ts
 * const t = new AcmeToggle();
 * t.checked = true;
 * ```
 */
export class AcmeToggle extends HTMLElement {
  /** Whether the toggle is on. */
  checked = false;
}
````

`@acmSemantic` and `@example` produce the Tier-2 `semantics` / `examples` fields. The `term`
is validated against the controlled vocabulary; each `@example` is **type-checked against the
component** and excluded (with a diagnostic) if it does not compile — so a manifest never
ships a broken usage example. A malformed annotation degrades to "field absent + warning",
never a failed build. Full guide: [docs/semantics-examples.md](docs/semantics-examples.md).

## Settings file

Auto-discovered as `acm-analyzer.config.{js,mjs}` at the cwd, or passed via `--config`.
The default export is the config object; it is your own trusted code (analyzed _sources_
are never executed). Unknown keys, a non-object export, or an unknown framework name are
fatal (exit 2) — never a silent fallback. Full contract:
[contracts/config-file.md](../../specs/002-acm-analyzer-cli/contracts/config-file.md).

```js
// acm-analyzer.config.js
import { myPlugin } from "./tools/my-plugin.js";

export default {
  globs: ["src/**/*.ts"],
  exclude: ["**/*.test.ts"],
  outdir: "dist",
  frameworks: ["stencil", "react"], // one name or a list; omit → vanilla
  plugins: [myPlugin()], // run after the framework plugins, in array order
};
```

`framework` (singular) is accepted as an alias and takes the same one-or-many value;
setting both keys is a fatal error. A `--framework` flag **replaces** the file's selection
rather than adding to it, like every other list option.

## Plugins

A framework is just a plugin. Everything the built-in frameworks do goes through the public
`@xgentic/acm-analyzer` entry point (`import type { AnalyzerPlugin } from "@xgentic/acm-analyzer"`) — the
core carries zero framework knowledge (Principle: the Prime Directive). A plugin implements
`name` plus at least one hook, invoked in pipeline order:

| Hook          | When                                                            |
| ------------- | --------------------------------------------------------------- |
| `preprocess`  | container formats (e.g. `.vue`) → a plain script + offset remap |
| `collect`     | per top-level node: create entries + their members              |
| `analyze`     | per node, after collect: cross-member work                      |
| `moduleLink`  | per module, after all nodes                                     |
| `packageLink` | once, over the whole draft: enrichment across entries           |

Core fields accept only Tier-1 span-derived values; unnamespaced unknown keys are rejected
at the draft API. Arbitrary inferred data is welcome under a namespaced `x-*` key and
survives validation untouched. A contribution that invalidates the manifest aborts the emit
with a diagnostic **attributed to the offending plugin**, and no file is written. Contract:
[contracts/plugin-api.md](../../specs/002-acm-analyzer-cli/contracts/plugin-api.md).

## Migrating from the CEM analyzer (SC-006)

ACM's `analyze` subcommand mirrors the [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
analyzer. Most options carry over by name; framework selection collapses the CEM flag zoo
into one generic `--framework`:

| CEM analyzer                                                           | ACM analyzer                                                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `globs` / `exclude` / `outdir` / `dev` / `quiet` / `watch` / `plugins` | same name, same meaning                                                       |
| `--litelement`                                                         | `--framework lit` (or `framework: 'lit'`)                                     |
| `--stencil`                                                            | `--framework stencil` (or `framework: 'stencil'`)                             |
| `--fast` / `--catalyst`                                                | not shipped in v1 (plugin seam available; documented gap, not silent)         |
| `overrideModuleCreation`                                               | not in v1 — the `preprocess` hook covers container formats; revisit on demand |

The important difference: ACM's output is **canonical and framework-free**. The same schema
and the same `agentic-component-manifest.json` describe a Lit, Stencil, Angular, React, or vanilla component, and
the file is byte-stable across reruns and platforms.

## Conformance

The analyzer's behavior is pinned by the executable conformance suite, run on both Linux and
macOS in CI:

- `analyzer-witness.test.ts` — reproduces every checked-in witness/analyzer golden byte-for-byte from source (FR-013).
- `analyzer-testbed.test.ts` — walks every [testbed-inventory](../../specs/002-acm-analyzer-cli/contracts/testbed-inventory.md) row on the Lit/Stencil/Angular stress components (FR-014).
- `analyzer-gates.test.ts` — seeded failures: invalid plugin output, invented members, and canonical drift are each caught (Principle IX).
- `tests/bench/perf.test.ts` — 100-component analysis < 30 s, watch single-file change < 5 s (SC-007).

```sh
pnpm test analyzer      # the four suites above + the analyzer unit tests
pnpm test               # the full ACM suite (all gates + drift)
```

See the feature [quickstart](../../specs/002-acm-analyzer-cli/quickstart.md) for
end-to-end scenarios.
