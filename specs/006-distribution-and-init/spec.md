# Feature Specification: Two shipped packages, and `acm init`

**Feature Branch**: `006-distribution-and-init`

**Created**: 2026-07-30

**Status**: Implemented

**Input**: User description: "now i have the packages in deploy, there are too many of
them basically i have two use cases: 1. i need the analyzer to convert the components to
the manifest 2. package with the acm cli + discovery skill used by the agent to find the
components. i dont need 4-5 packages" — plus: "add acm cli init that installs the
discovery skill and knows how to use it in the project".

## Problem

`deploy/` held five tarballs, one per workspace package. That mirrors how the repository
is *authored*, not what a consumer installs. Two of the five (`@xgentic/acm-spec`,
`@xgentic/acm-discovery-skill`) are data other packages need rather than things anyone installs
directly, and one (`@xgentic/acm-conformance`) is the test suite, which must never ship.

Worse, none of the five actually worked when installed. Three coupled defects:

1. **Repo-shaped paths.** `REPO_ROOT` was `path.resolve(here, "../../..")` and 17 sites
   resolved `packages/spec/schema/…`, `packages/discovery-skill/…`, and
   `packages/conformance/fixtures/witness` through it. The analyzer read
   `../../spec/package.json`. None of those paths exist in an installed package.
2. **Undeclared dependencies.** `@xgentic/acm` declared none while importing `ajv`,
   `yaml`, and `json-schema-to-typescript`; `@xgentic/acm-analyzer` declared `@vue/compiler-sfc`,
   which nothing imports.
3. **A dead entry guard.** `packages/analyzer/src/cli.ts` compared `process.argv[1]` to
   `import.meta.url` to decide whether it was the entry point. Invoked through npm's
   `node_modules/.bin` symlink those never match, so the installed `acm-analyzer` exited
   0 having done nothing at all.

Separately, a consumer who installs the CLI still had to hand-copy the Discovery Skill
into the right place for their agent host, and had no way to find out whether discovery
would work in their project before asking an agent to rely on it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A consumer installs two packages, not five (Priority: P1)

Someone building a component library installs `@xgentic/acm-analyzer` to derive a Manifest from
their source, and someone consuming component libraries installs `@xgentic/acm` to
search them. Neither has to know that the schema, the normative spec, the skill blocks,
and the conformance fixtures are separate directories upstream.

**Acceptance**: `pnpm dist:pack` produces exactly two tarballs. Each installs standalone,
in either order, into a project outside this repository, and both CLIs work there.

### User Story 2 - One command wires an agent up (Priority: P1)

A developer adds `@xgentic/acm` to a project and runs `acm init`. The Discovery Skill
lands wherever their agent host reads it — `.claude/skills/`, a managed region in
`AGENTS.md`, `.cursor/rules/` — without them knowing which file goes where. Re-running is
safe. A file they have edited is never silently overwritten.

**Acceptance**: `acm init` on a project with no host installs the Claude Code skill; on a
project with several, it installs each. A second run reports `fresh` and changes nothing.
A hand-edited file is refused with exit 3 and is left untouched; `--force` overwrites.

### User Story 3 - The command says whether discovery will work here (Priority: P1)

`acm init` finishes by reporting the project's Manifest Corpus: how many Manifests, from
which packages, with how many components; which Manifests were excluded and under which
rule id; and whether `acm` is reachable at all. On an empty corpus it says so plainly and
points at the analyzer, rather than leaving the developer to discover the emptiness later
through an agent's confused output.

**Acceptance**: run against a corpus, the report names the source packages and per-source
component counts. Run against an empty project, it reports `no ACM Manifests found` and
names `acm-analyzer analyze`. In both cases exit 0 — an empty corpus is a workable state,
not a failure.

### Edge cases

- **`AGENTS.md` already has content.** The skill goes into a marked region; everything
  outside it is preserved byte-for-byte, and a second run replaces the region rather than
  appending a second copy.
- **A hostile Manifest is in the corpus.** Its prose never reaches the installed skill
  file, and never reaches the preflight report. Human output carries no raw C0/C1 byte.
- **A repo-development command is run from an install.** `acm drift` and `acm coverage`
  read this repository's generated artifacts and fixtures. They exit 2 with a message
  saying so, rather than failing on a missing path.

## Requirements *(mandatory)*

- **FR-001** Exactly two packages ship: `@xgentic/acm` (the `acm` CLI, the JSON Schema,
  the Discovery Skill) and `@xgentic/acm-analyzer` (the `acm-analyzer` CLI).
- **FR-002** Each shipped package is self-contained: no workspace dependencies, and a
  declared dependency set that is exactly what npm must fetch.
- **FR-003** Every asset the shipped code reads resolves through one module that probes
  the packaged layout then the repo layout. No shipped code path assumes a checkout.
- **FR-004** Commands that genuinely require a checkout fail with exit 2 and a message
  naming them as repo-development commands. They remain described in the capability
  manifest, so the CLI's self-description does not vary by layout.
- **FR-005** `acm init` installs the Discovery Skill for the project's detected agent
  hosts, or for hosts named explicitly with a repeatable `--target`.
- **FR-006** What `init` writes is byte-identical to `acm agent-docs --target <name>`. No
  corpus data and no project-specific text is interpolated into a generated file.
- **FR-007** `init` is idempotent: unchanged → `fresh`, exit 0; changed → `blocked`,
  exit 3, nothing written; `--force` → `updated`; `--dry-run` writes nothing.
- **FR-008** `init` reports the project's corpus using counts, package identifiers,
  filesystem paths, and `ACM-*` rule ids only — never Manifest prose (NS-DATA-1).
- **FR-009** `init` is described in the capability manifest but is **not** in the
  discovery subset (`jsonSupported: false`), so the agent-facing skill body is unaffected
  by its existence.
- **FR-010** A verification path installs the built tarballs outside the repository and
  drives both CLIs there.

## Success Criteria *(mandatory)*

- **SC-001** `ls deploy/*.tgz` returns exactly two files.
- **SC-002** `pnpm dist:verify` passes: both CLIs work from a throwaway project outside
  the repo, including `init`, the two-call discovery loop, and `analyze → validate`.
- **SC-003** The full conformance suite stays green, and the Discovery Skill's generated
  artifacts are unchanged by this feature (`pnpm drift` → `fresh`).
- **SC-004** The capability golden gains `init` and nothing else changes shape.

## Out of scope

- Merging the five source directories. `packages/spec/…` paths are referenced by the
  conformance suite, the drift generator, the AGENTS.md invariants, and every
  `specs/*/contracts/*.md`; the packaging change delivers what was asked without that
  churn.
- Renaming the published packages. `@xgentic/acm` is already the install target named
  in the skill's own gated `corpus-preamble` block.
- Publishing to a registry. `dist:pack` produces tarballs; adding `publishConfig` is a
  later decision.
- Parameterizing the skill's invocation prefix per project (`pnpm acm`, `npx acm`). That
  would make the installed skill differ from the gated target bytes; `init` reports
  whether `acm` resolves instead.
