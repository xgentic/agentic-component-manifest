# Technical Proposal: npm Publishing & Embedding

**Status**: Proposed (planning only — no implementation)
**Date**: 2026-07-22
**Scope**: Turn the existing `acm-monorepo` into published, embeddable npm packages so a
downstream project can install the CLI and analyzer, generate an ACM Manifest from its
own components, and let AI agents discover them.

## 1. Decisions (settled)

| # | Decision | Choice |
|---|---|---|
| D1 | npm names | **`@xgentic/*` scope** (matches `github.com/xgentic`; `@acm` is unavailable). |
| D2 | Skill delivery | **Bundle the Discovery Skill inside the CLI package** + add an `acm init` command that copies it into `.claude/skills/`. |
| D3 | Spec layer | **Publish `@xgentic/acm-spec` (as `@xgentic/acm-spec`) as a runtime dependency**; resolve schema through package resolution, not `REPO_ROOT`. |

## 2. Current state (what already exists — do not rebuild)

- pnpm-workspace monorepo is already in place (`pnpm-workspace.yaml` → `packages/*`).
- Five packages: `@xgentic/acm-spec`, `@acm/conformance`, `@xgentic/acm` (the `acm` CLI),
  `@xgentic/acm-analyzer` (source→manifest, **already** supports angular · lit · react · vanilla
  web components · vue SFC), `@acm/discovery-skill` (the skill, spec 005).
- **Manifest indexing already answers the user's open question** (`discovery.ts`,
  `corpus.ts`): a component's manifest is found per `NS-DISC-1..4` — first hit wins:
  1. `package.json` `"acm"` field → advertised path,
  2. conventional **`agentic-component-manifest.json` at the package/project root**,
  3. `.well-known/agentic-component-manifest.json`.
  The Manifest Corpus for one `acm search` = **project root + every top-level
  `node_modules` package (auto-discovered) + explicit `--manifest` paths**. So: put the
  file at the **project root** by default; a library dependency that ships one is picked
  up automatically; override with `--manifest <path>` or the `acm` package.json field.
  → *No new indexing work is needed; this proposal only makes the analyzer default its
  output to the root location and documents the contract.*

## 3. Blockers to publishing (the real work)

### B1 — Source-only packages (no build) — **primary blocker**
Every package's `exports`/`bin` points at `.ts` source, and `@xgentic/acm-analyzer`'s bin uses a
`#!/usr/bin/env -S npx tsx` shebang. Published packages must ship compiled ESM `.js` +
`.d.ts` and a Node shebang. → Add a build step (**tsup**, esbuild-based, emits ESM + dts)
per publishable package; `bin` targets `dist/cli.js` with `#!/usr/bin/env node`.

### B2 — Hard-coded monorepo root — **portability blocker**
`packages/toolchain/src/validate.ts`:
```
export const REPO_ROOT = path.resolve(here, "../../..");
export const SCHEMA_PATH = path.join(REPO_ROOT, "packages/spec/schema/acm.schema.json");
```
Walks up to the monorepo root and reads spec files by path — works in-repo, **breaks once
installed** in `node_modules`. Also `agent-docs.ts` derives `SKILL_PACKAGE_DIR` the same
way (dev/`generate`-time only — acceptable to leave repo-scoped, but must be gated off the
published runtime path). → Resolve schema/meta-schema through `@xgentic/acm-spec` package
resolution; ship the schema JSON in that package's `files`.

### B3 — `private: true` everywhere; internal names
`spec`, `conformance`, `toolchain`, `analyzer` are all `private`. Names are `@acm/*`.
→ Flip publishable packages to public, rename to `@xgentic/*`, add `publishConfig.access`.

### B4 — CLI has no `bin`
`@xgentic/acm` exposes `exports` but no `bin`, so there is no `acm` binary to `npx`.
→ Add `"bin": { "acm": "dist/cli.js" }`.

### B5 — Skill not bundled with the CLI
The skill lives in its own package; the user wants it shipped *with* the CLI.
→ Include the generated skill target in the CLI package `files` and add `acm init`.

## 4. Target published surface

| Published package | New name | Role for a downstream project | `bin` |
|---|---|---|---|
| toolchain | **`@xgentic/acm`** | The CLI: `search`/`component`/`capabilities`/`validate`/… + `init`. Bundles the skill. | `acm` |
| analyzer | **`@xgentic/acm-analyzer`** | Dev dep: derive `agentic-component-manifest.json` from source. | `acm-analyzer` |
| spec | **`@xgentic/acm-spec`** | Runtime dep of both above: schema + generated types. | — |

**Not published**: `@acm/conformance` (internal test suite) stays `private`.
`@acm/discovery-skill` stays `private` — it is a **build input**: its generated skill
target is copied into `@xgentic/acm` at build time (bundled per D2). Optional later:
publish it standalone for `npx skills`-style installers.

## 5. Downstream embedding story (the end state this enables)

```sh
# 1. Generate a manifest from your components (writes agentic-component-manifest.json at repo root)
npm i -D @xgentic/acm-analyzer
npx acm-analyzer analyze --framework angular

# 2. Install the CLI + the agent skill
npm i -D @xgentic/acm
npx acm init            # copies the Discovery Skill into .claude/skills/

# 3. Agents discover components (skill steers this two-call loop)
npx acm search "date picker" --json
npx acm component acme-date-picker --json
```
A component **library** publishes its own `agentic-component-manifest.json` (via the `acm`
package.json field); any consumer's `acm search` finds it through `node_modules` with zero
config.

## 6. Work plan (phased)

**Phase 0 — Naming & scope**
- Rename `@xgentic/acm-spec|toolchain|analyzer` → `@xgentic/acm-spec|acm|acm-analyzer` across
  `package.json` + all `workspace:*` importers. Keep `@acm/conformance`,
  `@acm/discovery-skill` internal (rename optional).
- Confirm `@xgentic` scope is claimed on npm; add `publishConfig: { access: "public" }`.

**Phase 1 — Portability (B2)**
- New `@xgentic/acm-spec` entry that exports the schema + meta-schema (JSON `import` with
  `with { type: "json" }`, or a resolver that reads from the package dir).
- Replace `REPO_ROOT`-based `SCHEMA_PATH`/`META_SCHEMA_PATH` in toolchain & analyzer with
  spec-package resolution. Fence `SKILL_PACKAGE_DIR`/agent-docs off the runtime path
  (dev-only command).
- `pnpm test` must stay green (invariant: full conformance suite before commit).

**Phase 2 — Build pipeline (B1, B4)**
- Add `tsup` (or tsc) to each publishable package: ESM `dist/` + `.d.ts`, Node shebang on
  bins. Root `build` script fans out in dependency order (spec → toolchain → analyzer).
- Update `exports` → `dist/index.js` (+ `types`), `bin` → `dist/*.js`; add `files`,
  `sideEffects: false`, `engines`.
- Add `prepublishOnly`/`prepack` = build; verify with `npm pack --dry-run` (inspect the
  tarball contents) and a smoke install into a scratch project.

**Phase 3 — Skill bundling + `acm init` (B5, D2)**
- Include `@acm/discovery-skill`'s generated `claude-skill` target in `@xgentic/acm`'s
  `files` (copied at build).
- Implement `acm init` (+ `acm skill install`): copy the bundled skill into
  `.claude/skills/acm-discovery/`, idempotent, `--force` to overwrite. Register in the
  command `REGISTRY` (spec 004 R-01: no undescribed command) with a witness/conformance
  check.
- Skill activation copy should instruct agents to invoke `npx acm search …` (public bin),
  not the in-repo `pnpm acm`.

**Phase 4 — Analyzer default output (§2)**
- Default analyzer `outdir`/output to the conventional root file
  `agentic-component-manifest.json` so generated manifests are discoverable with no config.
- Document the `acm` package.json field for libraries advertising a non-root path.

**Phase 5 — Release plumbing**
- CI publish workflow (`.github/workflows`): on tag, `pnpm build` → `pnpm test` →
  `pnpm publish -r --access public` (Changesets recommended for versioned bumps; the skill
  already versions in lockstep with the CLI).
- README/`llms.txt`: add the install+embed section from §5.

## 7. Risks / watch-items

- **Golden/drift gates** (invariants #1, #2, #6): renaming and moving schema resolution
  must not change emitter/canonicalizer output or generated artifacts — run `pnpm drift`
  and the seeded suite; regenerate only if an intended diff.
- **Skill lockstep** (ADR 0004): bundling the skill into the CLI must preserve the
  capability-manifest drift gate; `acm init` ships the *generated* target, never a fork.
- **Dual bin naming**: `acm` (CLI) vs `acm-analyzer` — keep distinct to avoid `npx`
  ambiguity; the analyzer is not a subcommand of the CLI today.
- **ESM-only consumers**: packages are `type: module`; ship ESM only unless a CJS consumer
  need appears.

## 8. Out of scope

New analyzer frameworks, new discovery domains, schema changes, and publishing
`@acm/discovery-skill` standalone — all deferred.
