# Implementation Plan: Two shipped packages, and `acm init`

**Spec**: [spec.md](spec.md) · **Contracts**: [init-cli.md](contracts/init-cli.md),
[packaging.md](contracts/packaging.md)

## Decisions

**D1 — Ship two, keep five source directories.** `packages/spec/…` paths are referenced by
the conformance suite, the drift generator, the AGENTS.md invariants, and every
`specs/*/contracts/*.md`. Physically merging directories is a large refactor that buys
nothing the request asked for; the request was about what lands in `deploy/`. Only what
ships changes.

**D2 — Keep the published names.** `@xgentic/acm` is already the install target named in
the skill's own gated `corpus-preamble` block ("add the `@xgentic/acm` dev dependency")
and in the skill README's lockstep note. Renaming would churn both for no gain.

**D3 — The analyzer bundles the toolchain rather than depending on it.** Two tarballs that
install standalone in any order, with no version skew to manage. Built from one source
tree in one invocation, so the duplicated validator and canonicalizer cannot drift.

**D4 — `init` is `jsonSupported: false`.** `discoveryCommands()` filters the skill's
generated blocks by `jsonSupported`. Declaring `init` a discovery command would inject a
setup command into the agent-facing skill body and move its gated token budget. It gets a
command-local `--json` instead, on the precedent of `validate` and `compile`.

**D5 — `init` writes the `agent-docs` bytes verbatim.** No second rendering path, and
nothing project-specific interpolated. This is what keeps the spec-005 block-fidelity gate
meaningful, and what keeps generation corpus-agnostic (ADR 0004). The consequence — the
skill always says bare `acm` — is handled by *reporting* whether `acm` resolves rather
than by rewriting the skill per project.

**D6 — Repo-only commands stay in the registry.** `acm capabilities` must describe the
same surface in both layouts. A command that needs a checkout fails with exit 2 rather
than disappearing from the CLI's self-description.

## Phases

### Phase 1 — Relocatable asset resolution

New `packages/toolchain/src/paths.ts` probing packaged-then-repo layout. Rewire
`validate.ts` (schema paths, still re-exporting `REPO_ROOT` so the conformance suite does
not churn), `agent-docs.ts` (`SKILL_PACKAGE_DIR`), `capability.ts` (version/description),
`drift.ts` and `coverage.ts` (`requireRepoLayout` guards, lazy
`json-schema-to-typescript`), `cli.ts` (`RepoOnlyCommandError` → exit 2), and the
analyzer's `emit.ts` (spec version through the toolchain's public surface).

### Phase 2 — `acm init`

`packages/toolchain/src/init.ts` — targets, destinations, host detection, the managed
`AGENTS.md` region, the idempotency ladder, the corpus preflight. `renderInit` joins the
other human renderers in `render.ts`, where `sanitize()` lives. Registry entry, CLI
handler, regenerated capability golden, and `init-gates.test.ts`.

### Phase 3 — Build and pack

`scripts/build.mjs` (esbuild bundle + asset copy + generated manifests + `--pack`) and
`scripts/verify-dist.mjs` (install outside the repo, drive both CLIs). Declare the
toolchain's real dependencies, drop the analyzer's unused `@vue/compiler-sfc`, make
`@xgentic/acm-discovery-skill` private, and ignore `deploy/` and `*.tgz`.

## Defects found and fixed en route

- **The installed analyzer did nothing.** `cli.ts` gated `main()` on
  `process.argv[1] === fileURLToPath(import.meta.url)`. Through npm's `node_modules/.bin`
  symlink those never match, so `acm-analyzer analyze` exited 0 having produced no
  manifest and no output. Now compared through `realpathSync`.
- **`acm capabilities` documented a path consumers do not have.** The `validate` example
  named `packages/conformance/fixtures/minimal/…`. Examples are read by consumers of an
  installed CLI; it now names `agentic-component-manifest.json`.
- **Undeclared runtime dependencies.** `@xgentic/acm` declared none while importing
  `ajv` and `yaml`.
- **A double shebang.** esbuild hoists the entry's shebang; adding a banner produced a
  second one on line 2, which node rejects outright. `normalizeShebang` rewrites line 1
  to `#!/usr/bin/env node` (the analyzer's source shebang pointed at `tsx`).

## Verification

`pnpm test` · `pnpm test:seeded` · `pnpm drift` · `pnpm lint` · `pnpm format` ·
`pnpm dist:pack` (exactly two tarballs) · `pnpm dist:verify` (both CLIs, outside the repo).
