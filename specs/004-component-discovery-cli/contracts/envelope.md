# Contract: typed envelopes, response types, error codes

The machine-output contract shared verbatim by `acm … --json` and the programmatic
API ([api.md](./api.md)). Everything in this file is **public contract** under the
repo's standing `ACM-*` stability rule (AGENTS.md): discriminators and codes are
never renamed or reused; evolution is additive only.

## Envelope grammar

Exactly one envelope per `--json` invocation, on stdout, UTF-8, terminated by a
single newline.

Success:

```json
{ "type": "<ResponseType>", "data": { … } }
```

Error:

```json
{ "error": "<human-readable message>", "code": "<ErrorCode>", "suggestions": [ … ] }
```

- `type` / `code` are the branching keys. The `error` message wording changes
  freely and is **not** contract.
- `suggestions` is present only when the CLI has candidates to offer
  (unknown-name near misses; ambiguity candidates). Each suggestion:
  `{ "name", "reason", "source"?, "followUp"? }`.
- Envelope structure is never affected by manifest content: manifest text appears
  only inside `data` string values, byte-preserved via JSON string escaping
  (NS-DATA-1; [research R-07](../research.md#r-07--hostile-text-neutralization)).
- Consumers MUST ignore unknown envelope fields (additive evolution, mirroring the
  format's must-ignore rule).

## Response types

| Discriminator | Command | `data` payload |
|---------------|---------|----------------|
| `search` | `acm search` | `{ query, total, followUps?, results: [{ name, source, description, domain, followUp, score?, matches? }] }` — `score`/`matches` present at `--detail full`; `followUps` (runnable next commands) present only when `total === 0`, the deterministic retrieval-miss signal; `results` ordered score desc → name asc (code point) → package asc; length ≤ limit |
| `component.list` | `acm component` | `{ total, packages: [{ package, components: [ … ] }] }` — component fields per active detail level (`brief`: name; `compact`: + `tagName?` + description; `full`: + entry). `--dense` renders one line per entry (name · tag · package · one-liner): the token-frugal retrieval floor an agent scans when search misses |
| `component.detail` | `acm component <name>` | `{ name, source: { package, path }, entry }` — `entry` is the Manifest entry **verbatim**, unknown/`x-*` fields preserved (must-ignore); `path` project-root-relative |
| `capabilities` | `acm capabilities` | CapabilityManifest ([capability-manifest.md](./capability-manifest.md)) |

`score` values are informative, not contract — they may shift with golden-reviewed
ranking re-tunes. `matches[].tier` names come from the fixed MatchTier vocabulary
([data-model.md](../data-model.md#matchtier-ordinal-highest-first--contract)) and
are contract.

## Error codes

| Code | Condition | Exit | `suggestions` |
|------|-----------|------|---------------|
| `ACM-D-EMPTY-CORPUS` | corpus assembly admitted zero Manifests | 1 | — |
| `ACM-D-UNKNOWN-COMPONENT` | name resolves to zero components | 1 | up to 3 closest names, `reason: "similar name"` |
| `ACM-D-AMBIGUOUS-COMPONENT` | name resolves to > 1 component | 1 | every candidate with `source` and a `followUp` qualified at whichever scope resolves it (`--from`, plus `--module` for intra-package duplicates) |
| `ACM-D-BAD-MANIFEST` | explicit `--manifest` path failed admission (missing/unparseable/invalid/over-limit) | 1 | — |
| `ACM-D-USAGE` | unknown command/option, unsupported enum value, malformed number | 2 | — |
| `ACM-D-UNKNOWN` | any failure with no more specific code | 1 | — |

Every error envelope carries a code — `ACM-D-UNKNOWN` is the guaranteed fallback,
never an absent field. New codes may be added; existing codes never change meaning.

## Semantics fixed by this contract

- Empty search result set (`total: 0`) is a **success** envelope, exit 0.
- Corpus-file skip diagnostics go to stderr and do not alter the envelope or exit
  status ([research R-09](../research.md#r-09--exit-codes-and-stream-discipline)).
- The same operation through the programmatic API returns the identical success
  envelope object / throws the identical `code` + `suggestions`
  ([api.md](./api.md)) — parity is gated per operation in the Conformance Suite.
- **Legacy `--json` is a different flag.** The pre-existing commands (`validate`,
  `compile`, `agent-view`, `coverage`) accept `--json` meaning "render diagnostics
  as JSON on **stderr**" — they emit no envelope, and this contract does not apply
  to them. The capability manifest marks them `json: false` (no envelope support)
  while still describing their `--json` option with that meaning, so agents cannot
  conflate the two semantics.
