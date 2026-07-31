# Tasks: Two shipped packages, and `acm init`

All complete. Recorded after implementation, so this is a record of what landed rather
than a forward plan — see [plan.md](plan.md) for the decisions behind it.

## Phase 1 — Relocatable asset resolution

- [x] **T001** `packages/toolchain/src/paths.ts`: probe packaged layout then repo layout;
      `SPEC_DIR`, `SKILL_DIR`, `REPO_ROOT_OR_UNDEFINED`, `readToolchainPackageJson()`,
      `readSpecPackageVersion()`, `requireRepoLayout()`, `RepoOnlyCommandError`
- [x] **T002** `validate.ts` resolves schema paths off `SPEC_DIR`, still re-exporting
      `REPO_ROOT` so the conformance suite and its helpers do not churn
- [x] **T003** `agent-docs.ts` resolves `SKILL_PACKAGE_DIR` off `SKILL_DIR`
- [x] **T004** `capability.ts` reads the shipped `package.json`, not a repo path
- [x] **T005** `drift.ts` + `coverage.ts` guard with `requireRepoLayout`;
      `json-schema-to-typescript` becomes a lazy `await import()`
- [x] **T006** `cli.ts` maps `RepoOnlyCommandError` to exit 2; `agent-docs`'s
      write/freshness path guards, while `--target` keeps working anywhere
- [x] **T007** analyzer `emit.ts` sources the schema version through
      `readSpecPackageVersion()` from `@acm/toolchain`'s public surface

## Phase 2 — `acm init`

- [x] **T008** `packages/toolchain/src/init.ts`: targets, destinations, host detection,
      `applyRegion` for the managed `AGENTS.md` region, the idempotency ladder, the
      corpus preflight, `exitStatusForInit`
- [x] **T009** `renderInit` in `render.ts`, alongside the other human renderers and the
      shared `sanitize()`
- [x] **T010** registry entry (`jsonSupported: false`, five options) and the CLI handler
- [x] **T011** regenerate `fixtures/discovery/capability.golden.json`
- [x] **T012** `packages/conformance/tests/init-gates.test.ts` — G-I1..G-I7, 22 tests

## Phase 3 — Build and pack

- [x] **T013** `scripts/build.mjs`: esbuild bundles, asset copy, generated manifests,
      `normalizeShebang`, `REQUIRED_ASSETS` guard, `--pack`
- [x] **T014** `scripts/verify-dist.mjs`: install both tarballs outside the repo and
      drive both CLIs
- [x] **T015** declare `ajv`/`yaml` on `@acm/toolchain`; drop the unused
      `@vue/compiler-sfc` from `@acm/analyzer`; make `@acm/discovery-skill` private
- [x] **T016** root scripts `build` / `dist:pack` / `dist:verify`; esbuild devDependency;
      `allowBuilds: esbuild: true`; ignore `dist/`, `deploy/`, `*.tgz`
- [x] **T017** eslint: ignore `dist/`, give `scripts/**/*.mjs` Node globals

## Phase 4 — Defects found en route

- [x] **T018** analyzer entry guard compared `process.argv[1]` to `import.meta.url`;
      through npm's `.bin` symlink those never match, so the installed CLI silently did
      nothing. Now compared through `realpathSync`
- [x] **T019** the `validate` registry example named a repo fixture path no consumer has
- [x] **T020** esbuild hoists the entry shebang; a banner produced a second one on line 2,
      which node rejects

## Phase 5 — Documentation

- [x] **T021** `packages/toolchain/README.md` (the shipped package had none)
- [x] **T022** AGENTS.md: two-vs-five framing, new commands, invariants 9 and 10
- [x] **T023** discovery-skill README: `acm init` replaces the hand-copy install table
- [x] **T024** spec 006 — spec, plan, `init-cli.md`, `packaging.md`; indexed in `llms.txt`

## Verification

`pnpm test` (334) · `pnpm test:seeded` (10) · `pnpm drift` → fresh · `pnpm lint` ·
`pnpm dist:pack` → exactly two tarballs · `pnpm dist:verify` → all checks passed.
