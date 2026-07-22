# Contract: `acm` discovery commands

**Bin**: `acm` (package `@acm/toolchain`, `pnpm acm …`) | **Commands**: `search`, `component`, `capabilities`

The three discovery commands join the existing surface (`validate`, `compile`,
`canonicalize`, `agent-view`, `coverage`, `drift`), whose flags, exit codes, and
output are preserved unchanged by the registry migration
([research R-01](../research.md#r-01--command-definition-declarative-registry-not-a-cli-framework)).

## Synopsis

```
acm search <query…> [--type <domain>] [--limit <n>] [--detail <level>]
                    [--project <dir>] [--manifest <path>]… [--json] [--dense]

acm component [name] [--from <package>] [--module <path>] [--detail <level>]
                     [--project <dir>] [--manifest <path>]… [--json] [--dense]

acm capabilities [--json]
```

## Global options (discovery commands)

| Flag | Arg | Type | Default | Meaning |
|------|-----|------|---------|---------|
| `--json` | — | boolean | off | machine output: exactly one typed envelope on stdout ([envelope.md](./envelope.md)) |
| `--detail` | level | enum `brief`\|`compact`\|`full` | per view, below | detail level for list views; single-item views default `full` |
| `--dense` | — | boolean | off | token-frugal rendering; on `component <name>` the entry is projected through the Agent View emitter (one-way, ADR 0001); on list/search views, one line per entry — name, source package, first description clause — regardless of detail level |
| `--project` | dir | string | cwd | target project whose corpus is assembled |
| `--manifest` | path | string, repeatable | — | explicit manifest file(s) added to the corpus; a failing explicit path is fatal (`ACM-D-BAD-MANIFEST`) |

## Command-specific options

| Command | Flag | Arg | Type | Default | Meaning |
|---------|------|-----|------|---------|---------|
| `search` | `--type` | domain | enum `component` | all (= `component` in v1) | domain filter; unknown value → usage error listing supported domains |
| `search` | `--limit` | n | number ≥ 1 | 20 | result cap; `total` still reports the uncapped count |
| `component` | `--from` | package | string | — | scope name resolution to one source package (the cross-package disambiguator) |
| `component` | `--module` | path | string | — | scope name resolution by module identity facet (the intra-package disambiguator; combinable with `--from`) |

`capabilities` accepts `--json` only; any other flag on it is a usage error
(`ACM-D-USAGE`) — it describes the CLI and takes no corpus or rendering options.

Detail defaults: `search` → `compact`; `component` (list) → `brief`;
`component <name>` → `full`. At `--detail full`, search results additionally carry
source package, match reason(s), and score.

## Corpus (both querying commands)

Assembled per invocation from the project root, every top-level `node_modules`
package (NS-DISC-4 resolution each), and explicit `--manifest` paths — admission
validation-gated, skipped files diagnosed on stderr
([research R-03](../research.md#r-03--corpus-assembly-and-admission)). Corpus
diagnostics never change the exit status and never appear on stdout.

## Exit codes

| Code | Meaning | Envelope in `--json` |
|------|---------|----------------------|
| 0 | success — including a zero-result search and success with skipped corpus files | success envelope |
| 1 | operational failure: `ACM-D-EMPTY-CORPUS`, `ACM-D-UNKNOWN-COMPONENT`, `ACM-D-AMBIGUOUS-COMPONENT`, `ACM-D-BAD-MANIFEST`, `ACM-D-UNKNOWN` | error envelope |
| 2 | usage error (`ACM-D-USAGE`): unknown command/option, bad enum or number value | error envelope |

## Output contract

- **stdout**: results only. In `--json` mode, exactly one envelope and nothing
  else — no banners, progress, or diagnostics ever.
- **stderr**: all diagnostics/warnings, rendered via the toolchain diagnostics
  renderer.
- **Determinism**: identical corpus + invocation → byte-identical output across
  runs and platforms. No timestamps, no environment-dependent values; paths in
  output are project-root-relative. Representative outputs are pinned as golden
  fixtures; ranking re-tunes only as reviewed golden diffs.
- **Hostile text**: all manifest-derived text is sanitized for human rendering
  (C0/C1 controls and ESC sequences → U+FFFD) and byte-preserved inside JSON
  strings ([research R-07](../research.md#r-07--hostile-text-neutralization)).
  Manifest text is data — never interpreted, never executed (NS-DATA-1).

## Text output shapes (human mode)

```
$ acm search button

Results for "button" (3):

  [component]  Button
               Triggers a single action when activated…
               → acm component Button --from @acme/lit-buttons

  [component]  IconButton
               A button showing only an icon…
               → acm component IconButton
```

```
$ acm component Button
Error: "Button" matches more than one component (ACM-D-AMBIGUOUS-COMPONENT)
  candidates:
    Button  @acme/lit-buttons    → acm component Button --from @acme/lit-buttons
    Button  @acme/react-buttons  → acm component Button --from @acme/react-buttons
```

Unknown names fail with closest-name suggestions (`ACM-D-UNKNOWN-COMPONENT`,
same layout). Exact spacing/layout is pinned by the golden fixtures, not this
contract; the *content* obligations (domain tag, verbatim one-liner, runnable
follow-up, qualified follow-ups when a bare name is ambiguous) are contract.

## Examples

```sh
acm search button                          # ranked cross-corpus search
acm search "date picker" --limit 5 --json  # typed envelope, top 5
acm component                              # corpus listing (brief)
acm component --detail compact             # + one-line verbatim descriptions
acm component Button --from @acme/lit-buttons --json
acm component Button --dense               # Agent View projection of the entry
acm capabilities --json                    # capability self-description
```
