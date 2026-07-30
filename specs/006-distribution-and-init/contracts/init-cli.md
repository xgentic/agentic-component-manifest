# Contract: `acm init` command

The project-wiring command (spec 006, FR-005..FR-009). A **public** registry command,
`jsonSupported: false`, that writes the Discovery Skill into a consuming project and
reports whether discovery will work there. This contract binds its CLI surface; behavior
is gated in `packages/conformance/tests/init-gates.test.ts`.

## Registry declaration

| Property | Value |
|---|---|
| name | `init` |
| `jsonSupported` | `false` — never emits a typed envelope; not in the discovery subset |
| `responseTypes` | `[]` |
| options | `--target <name>` (enum, repeatable), `--dir <path>`, `--force`, `--dry-run`, `--json` |
| examples | `acm init`, `acm init --target agents-md --dry-run` |

`jsonSupported: false` is load-bearing, not incidental. `discoveryCommands()` in
`agent-docs.ts` filters the skill's quick-reference and option tables by `jsonSupported`;
declaring `init` a discovery command would inject a setup command into the agent-facing
skill body and move its gated token budget. Its `--json` is therefore a command-local
flag emitting a plain install report — the same precedent `validate` and `compile` set
for non-envelope `--json`.

`--target`'s enum MUST equal `INIT_TARGETS` (gated, G-I1).

## Synopsis

```
acm init [--target claude-skill|agents-md|rules]… [--dir <path>] [--force] [--dry-run] [--json]
```

## Targets and destinations

| Target | Destination (project-relative) |
|---|---|
| `claude-skill` | `.claude/skills/acm-discovery/SKILL.md` |
| `agents-md` | a managed region in `AGENTS.md` |
| `rules` | `.cursor/rules/acm-discovery.md` |

`skills-package` is deliberately **not** an `init` target: it is a source directory an
external installer (`npx skills`) is pointed at, not a destination inside a project. It
remains an `agent-docs` target, so the gate binding `agent-docs`'s enum to
`Object.keys(buildSkillFiles().targets)` is unaffected.

## Host detection

With no `--target`, hosts are detected and **every** match is installed, in this fixed
order: `.claude/` → `claude-skill`; `AGENTS.md` → `agents-md`; `.cursor/` → `rules`. No
match installs `claude-skill`, creating the directory.

## Fidelity

What `init` writes is **byte-identical** to `acm agent-docs --target <name>` (G-I2). There
is no second rendering path. For `agents-md` the fragment is byte-identical and wrapped in
its region markers.

This is what keeps the spec-005 block-fidelity gate meaningful: if `init` rendered its own
variant, the gate over `packages/discovery-skill/generated/**` would no longer describe
what agents actually read. It is also why nothing project-specific — corpus data, package
names, an invocation prefix — is ever interpolated. Generation stays corpus-agnostic
(ADR 0004) so hostile Manifest text cannot ride into an agent's resident context.

## The AGENTS.md managed region

```
<!-- acm:skill start -->
…the AGENTS.fragment.md body…
<!-- acm:skill end -->
```

- Region present → replaced in place. Content before and after is preserved byte-for-byte.
- Region absent, file non-empty → appended after a blank line.
- File absent or empty → created holding just the region.
- A difference *outside* the region is never a conflict; it is simply not ours, so
  `agents-md` never reports `blocked`.

## Idempotency and the overwrite refusal

| State | Action | Exit |
|---|---|---|
| destination absent | `created` | 0 |
| destination byte-identical | `fresh` | 0 |
| destination differs, no `--force` | `blocked`, **nothing written** | 3 |
| destination differs, `--force` | `updated` | 0 |
| any state, `--dry-run` | reported, **nothing written** | 0 |

Exit 3 is returned if *any* target was blocked. `--dir` selects the project (default:
cwd). An unknown `--target` value is exit 2.

## Corpus preflight

After installing, `init` assembles the project's Manifest Corpus (`assembleCorpus`) and
reports:

- Manifest count, total component count, and per-source `{ name, components }` where
  `name` is the package name if known, else the manifest's project-relative path
- excluded Manifests as `{ ruleId, path }` — rule id and path only
- an empty corpus as a workable state: exit 0, with a pointer to `acm-analyzer analyze`
- whether `acm` resolves from the project (`node_modules/.bin/acm` or `PATH`)

**NS-DATA-1**: the preflight touches Manifest text but reports none of it. No description,
note, or example caption enters the report on either surface (G-I6), and human output
passes every project-derived string through the shared `sanitize()` — a package directory
name is no more trusted than Manifest prose.

## Gates

`packages/conformance/tests/init-gates.test.ts`:

- **G-I1** the registry's `--target` enum equals `INIT_TARGETS`; every target has a
  relative destination; an unknown target is exit 2
- **G-I2** installed bytes equal the `agent-docs` target's bytes; no corpus content
  reaches the installed skill
- **G-I3** `fresh` / `blocked` (exit 3, nothing written) / `--force` / `--dry-run`
- **G-I4** the managed region replaces itself and preserves its neighbours
- **G-I5** host detection is deterministic and total
- **G-I6** the preflight carries counts, identifiers, and rule ids only
- **G-I7** `init` stays out of the discovery subset
