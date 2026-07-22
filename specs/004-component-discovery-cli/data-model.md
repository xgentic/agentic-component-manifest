# Data Model: Component Discovery CLI

Entities behind the discovery surface. None of these are Manifest schema changes —
they are tool-side structures (Constitution I scope, [research R-10](./research.md#r-10--normative-status-no-schema-or-normative-spec-change)).
Serialized shapes are bound by [contracts/envelope.md](./contracts/envelope.md) and
[contracts/capability-manifest.md](./contracts/capability-manifest.md).

## Command registry

### CommandSpec

One entry per `acm` command; the single source the parser, dispatcher, and
capability manifest are derived from ([research R-01](./research.md#r-01--command-definition-declarative-registry-not-a-cli-framework)).

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | unique across the registry |
| `description` | string | non-empty (drift gate) |
| `arguments` | ArgumentSpec[] | positional order; at most one variadic, last |
| `options` | OptionSpec[] | flags unique per command (incl. inherited globals) |
| `jsonSupported` | boolean | `true` for all discovery commands |
| `responseTypes` | ResponseType[] | non-empty iff `jsonSupported` (drift gate) |
| `examples` | string[] | at least one (drift gate) |
| `handler` | function | binding only — never serialized into the capability manifest |

### ArgumentSpec

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | — |
| `required` | boolean | — |
| `variadic` | boolean | variadic implies last position |
| `description` | string | non-empty |

### OptionSpec

| Field | Type | Rules |
|-------|------|-------|
| `flag` | string | e.g. `--limit <n>`; unique per command |
| `type` | `boolean` \| `string` \| `number` \| `enum` | — |
| `choices` | string[] | present iff `type === "enum"` |
| `default` | scalar | optional; must satisfy `type`/`choices` |
| `repeatable` | boolean | e.g. `--manifest` |
| `description` | string | non-empty (drift gate) |

## Corpus

### Corpus

The universe of one invocation. Assembled fresh per run
([research R-03](./research.md#r-03--corpus-assembly-and-admission)); immutable once
assembled; deterministic entry order (project root → packages lexicographic →
explicit paths in argv order).

| Field | Type | Notes |
|-------|------|-------|
| `entries` | CorpusEntry[] | admitted manifests only |
| `diagnostics` | CorpusDiagnostic[] | skipped candidates; stderr, never stdout |

Assembly pipeline (the only state transition in the feature):

```
candidate source → resolve (NS-DISC-4) → parse → validateManifest (NS-LIMIT)
   ├─ no manifest found (non-explicit source)……… silently absent
   ├─ advertised-but-missing / parse / invalid …… CorpusDiagnostic, excluded
   ├─ explicit --manifest path fails ………………………… error ACM-D-BAD-MANIFEST (run aborts)
   └─ valid ………………………………………………………………………………………… CorpusEntry
```

An empty `entries` list after assembly is `ACM-D-EMPTY-CORPUS` for every command
that queries the corpus.

### CorpusSource

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `project-root` \| `installed-package` \| `explicit-path` | — |
| `package` | string | package name; absent for `explicit-path` |
| `resolution` | `acm-field` \| `conventional` \| `well-known` \| `explicit` | NS-DISC resolution branch that hit |

### CorpusEntry

| Field | Type | Notes |
|-------|------|-------|
| `source` | CorpusSource | — |
| `path` | string | project-root-relative (determinism: never absolute) |
| `manifest` | object | the validated document, held verbatim (unknown/`x-*` fields preserved — must-ignore) |
| `components` | ComponentRef[] | index extracted mechanically from the manifest |

### CorpusDiagnostic

Reuses the toolchain `Diagnostic` shape (`ruleId`, `pointer`, `message`) plus the
candidate `path`; rendered via the existing `renderDiagnostics`.

### ComponentRef

The searchable index record for one component entry.

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | component name as recorded in the Manifest |
| `source` | CorpusSource | owning package |
| `facets` | object | populated Identity Facets only: `tagName?`, `module?` + `export?`, `selector?` |
| `semantics` | string[] | controlled-vocabulary terms, if classified |
| `description` | string | verbatim first line for list/search rendering |
| `entryPointer` | JSON Pointer | locator of the full entry inside `manifest` |

Resolution key: (`source.package`, `name`), case-insensitive on `name`. Several
refs sharing a name — across or within packages — make a bare-name detail request
ambiguous (`ACM-D-AMBIGUOUS-COMPONENT`); `--from <package>` narrows to one package,
and `--module <path>` narrows by the module identity facet for duplicates inside
one package — ambiguity follow-ups always carry whichever scope actually resolves
([research R-05](./research.md#r-05--name-resolution-disambiguation-and-suggestions)).

## Search

### SearchQuery

| Field | Type | Rules |
|-------|------|-------|
| `raw` | string | as typed; always treated literally |
| `tokens` | string[] | whitespace-split, NFC-normalized, lower-cased |
| `type` | domain | v1: `component` (the only accepted value); unknown → `ACM-D-USAGE` |
| `limit` | integer ≥ 1 | default 20 |
| `detail` | DetailLevel | default `compact` for search |

### MatchTier (ordinal, highest first — contract)

`name-exact` > `facet-exact` > `name-prefix` > `name-substring` > `name-fuzzy` >
`semantic-exact` > `facet-substring` > `prose-substring`
([research R-04](./research.md#r-04--search-ranking-and-fuzzy-matching)). Numeric
weights are implementation, pinned by golden fixtures.

### SearchResult

| Field | Type | Notes |
|-------|------|-------|
| `ref` | ComponentRef | — |
| `score` | integer | sum of best tier per matching token; informative, not a stability contract |
| `matches` | {token, tier}[] | the match reason(s); surfaced at `--detail full` |
| `followUp` | string | runnable invocation, e.g. `acm component Button --from @acme/lit-buttons` (qualified iff the bare name is ambiguous in this corpus) |

### SearchResultSet

| Field | Type | Notes |
|-------|------|-------|
| `query` | string | `raw` |
| `total` | integer | matches before capping |
| `results` | SearchResult[] | ≤ `limit`; ordered score desc, then name asc (code point), then package asc |

Zero matches is a valid, successful result set (`total: 0`).

## Output

### DetailLevel

Ordered `brief` < `compact` < `full`. Defaults: `component` list → `brief`;
`search` → `compact`; single-item views → `full`. `--dense` is an orthogonal
rendering axis, not a fourth level
([research R-06](./research.md#r-06--detail-levels-and-dense-mode)).

### Envelope

Success: `{ type: ResponseType, data }`. Error:
`{ error: string, code: ErrorCode, suggestions?: Suggestion[] }`. Exactly one
envelope per `--json` invocation on stdout; grammar and payload shapes per response
type are bound in [contracts/envelope.md](./contracts/envelope.md).

### Suggestion

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | candidate component name |
| `reason` | string | e.g. `similar name`; for ambiguity: the disambiguating source |
| `source` | string | package name (ambiguity candidates) |
| `followUp` | string | exact invocation resolving to this candidate |

### ErrorCode (public contract — never renamed or reused)

| Code | Meaning | Exit |
|------|---------|------|
| `ACM-D-EMPTY-CORPUS` | no admitted Manifest in the assembled corpus | 1 |
| `ACM-D-UNKNOWN-COMPONENT` | name resolves to zero components | 1 |
| `ACM-D-AMBIGUOUS-COMPONENT` | name resolves to more than one component | 1 |
| `ACM-D-BAD-MANIFEST` | explicitly passed manifest path failed admission | 1 |
| `ACM-D-USAGE` | unknown command/option/enum value or malformed option value | 2 |
| `ACM-D-UNKNOWN` | fallback — no more specific code applies | 1 |

### ResponseType (public contract — never renamed or reused)

| Discriminator | Emitted by | Payload |
|---------------|-----------|---------|
| `search` | `acm search` | SearchResultSet |
| `component.list` | `acm component` (no name) | package-grouped component listing at the active DetailLevel |
| `component.detail` | `acm component <name>` | `{ name, source, entry }` — `entry` verbatim from the Manifest |
| `capabilities` | `acm capabilities` | CapabilityManifest |

### CapabilityManifest

Pure projection of the registry (`handler` excluded), plus tool identity and the
two public registries
([contracts/capability-manifest.md](./contracts/capability-manifest.md)):
`apiVersion` (integer, starts at 1), `name`, `version`, `description`,
`globalOptions: OptionSpec[]`, `commands: CommandSpec[]` (serializable fields),
`responseTypes: Record<command, ResponseType[]>`, `errorCodes: {code, description}[]`.

## Programmatic surface

### AcmDiscoveryError

Thrown by the API where the CLI emits an error envelope; fields `message`, `code`,
`suggestions?` — identical values to the envelope
([contracts/api.md](./contracts/api.md)). CLI handlers are thin wrappers over the
API functions, so success data and error fields cannot diverge between surfaces
([research R-08](./research.md#r-08--programmatic-api-and-parity-strategy)).
