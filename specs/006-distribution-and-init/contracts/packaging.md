# Contract: what ships

Binds the two shipped packages (spec 006, FR-001..FR-004, FR-010) — their contents,
dependency sets, and the boundary between the shipped surface and the repo-development
one. Built by `scripts/build.mjs`, verified by `scripts/verify-dist.mjs`.

## The two packages

| | `@xgentic/acm` | `@xgentic/acm-analyzer` |
|---|---|---|
| purpose | **consume** Manifests: discovery, validation, and `init` | **produce** a Manifest from component source |
| bin | `acm` → `dist/cli.js` | `acm-analyzer` → `dist/cli.js` |
| exports | `.` → `dist/index.js` | `.` → `dist/plugin.js` (the plugin API) |
| dependencies | `ajv`, `yaml` | `ajv`, `typescript`, `chokidar`, `tinyglobby` |
| assets | `assets/spec/schema/*.json`, `assets/spec/package.json`, `assets/skill/{blocks,generated}/**` | `assets/spec/schema/*.json`, `assets/spec/package.json` |

Both are ESM, `node >= 20`, bundled by esbuild with those dependencies external.

`@xgentic/acm-spec` and `@xgentic/acm-discovery-skill` do not ship as packages; they become `assets/`
inside the packages that read them. `@xgentic/acm-conformance` never ships.

The analyzer **bundles** the toolchain modules it uses rather than depending on
`@xgentic/acm`, so the two tarballs install standalone in either order with no version
skew. Both are built from one source tree in one invocation, so the duplicated reference
validator and canonicalizer cannot drift.

`json-schema-to-typescript` is reachable only from `acm drift`, a repo-development
command that refuses to run outside a checkout — it is a lazy `await import()`, marked
external, and undeclared in the shipped dependency set.

## Asset resolution

One module, `packages/toolchain/src/paths.ts`, owns every asset path, probing the packaged
layout first and the repo layout second:

| export | packaged | repo checkout |
|---|---|---|
| `SPEC_DIR` | `<pkg>/assets/spec` | `<repo>/packages/spec` |
| `SKILL_DIR` | `<pkg>/assets/skill` | `<repo>/packages/discovery-skill` |
| `REPO_ROOT_OR_UNDEFINED` | `undefined` | `<repo>` |

`readToolchainPackageJson()` sources the version and description `acm capabilities`
reports; `readSpecPackageVersion()` sources the manifest `schemaVersion` the analyzer
emits, and is re-exported from `@xgentic/acm`'s public surface so a Producer bundling
the reference emitter resolves it the same way in both layouts.

Adding a new asset read means adding it to `paths.ts` and to `REQUIRED_ASSETS` in
`scripts/build.mjs`, which fails the build if the file is not in the package.

## Repo-development commands

`drift`, `coverage`, and `agent-docs --write`/freshness-check read this repository's
generated artifacts and fixtures. They call `requireRepoLayout(<command>)` and, from an
install, throw `RepoOnlyCommandError` — which `cli.ts` turns into **exit 2** with a
message naming the command as repo-development.

They stay in the registry. `acm capabilities` describes the same surface in both layouts;
a command that cannot run here fails loudly rather than vanishing from the CLI's
self-description.

`acm agent-docs --target <name>` is **not** repo-only — printing a target works anywhere,
and `init` depends on it.

## Examples name consumer paths

Registry `examples` are read by consumers of an installed CLI through
`acm capabilities`. They must name paths that exist in a consuming project, never this
repository's fixtures.

## Verification

`scripts/verify-dist.mjs` (`pnpm dist:verify`) is the only check that exercises what a
consumer gets. It installs both tarballs into a throwaway project **outside** the
repository and asserts:

- `deploy/` holds exactly two tarballs, named `acm-toolchain` and `acm-analyzer`
- `acm capabilities --json` is a valid envelope naming `init`
- `acm init` writes the skill, reports the empty corpus, and points at the analyzer
- the installed skill is byte-identical to `acm agent-docs --target claude-skill`
- re-running is `fresh`; a tampered file is refused at exit 3 without writing; `--force`
  restores it
- a dependency's Manifest is discovered, searched, and read back through the two-call loop
- `acm-analyzer analyze` emits a Manifest the installed `acm validate` accepts
- `acm drift` and `acm coverage` exit 2 as repo-development commands

Scanning the emitted bundle for `packages/…` strings is deliberately **not** a check: the
repo-layout probe and the repo-only commands name those paths on purpose, so a textual
gate would only pressure someone to obscure correct code. The behavioural check is the
real one.
