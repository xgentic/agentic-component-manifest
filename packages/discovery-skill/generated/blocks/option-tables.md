## Options

Shared options (the `appliesTo` commands):

| Option | Applies to | Type | Default | Meaning |
| --- | --- | --- | --- | --- |
| `--json` | search, component, capabilities | boolean | — | machine output: exactly one typed envelope on stdout, diagnostics on stderr |
| `--detail <level>` | search, component | brief \| compact \| full | — | detail level for list views (defaults: search results compact, component list brief, single-item views full) |
| `--dense` | search, component | boolean | — | token-frugal rendering: Agent View projection for component detail, one line per entry for list and search views |
| `--project <dir>` | search, component | string | — | target project whose Manifest Corpus is assembled (default: current directory) |
| `--manifest <path>` | search, component | string | — | explicit manifest file added to the corpus; a failing explicit path is fatal (ACM-D-BAD-MANIFEST) |

### `acm search`

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `--type <domain>` | component | — | restrict results to one domain (v1 corpus contains only components) |
| `--limit <n>` | number | `20` | maximum number of results; the total match count is always reported |

### `acm component`

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `--from <package>` | string | — | scope name resolution to one source package (cross-package disambiguator) |
| `--module <path>` | string | — | scope name resolution by module Identity Facet (intra-package disambiguator; combinable with --from) |
