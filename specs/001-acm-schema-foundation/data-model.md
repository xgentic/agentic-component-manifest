# Data Model: ACM Schema Foundation

Entities of the manifest document shape. Provenance tiers per constitution IV;
CEM-inherited names per constitution VIII (research R12). State transitions: N/A — the
manifest is a static description; nothing here has a lifecycle.

## Document skeleton

### ManifestDocument
| Field | Type | Tier | Rules |
|---|---|---|---|
| `schemaVersion` | string (semver) | 1 | REQUIRED; self-declaration (Principle VII) |
| `modules` | Module[] | 1 | REQUIRED; may be empty |
| `x-*` | opaque | 3 | allowed at every node level (all entities below; not repeated) |

### Module *(CEM-inherited name)*
| Field | Type | Tier | Rules |
|---|---|---|---|
| `path` | string | 1 | REQUIRED; package-relative source path |
| `declarations` | ComponentDeclaration[] | 1 | components declared in this module |
| `exports` | ModuleExport[] | 1 | export name ↔ declaration binding |

### ModuleExport
| Field | Type | Tier | Rules |
|---|---|---|---|
| `name` | string | 1 | REQUIRED; `default` allowed |
| `declaration` | reference (declaration name) | 1 | REQUIRED; must resolve within document |

## Component

### ComponentDeclaration
One entry = exactly one implementation artifact in one framework (constitution II).

| Field | Type | Tier | Rules |
|---|---|---|---|
| `name` | string | 1 | REQUIRED; unique within module |
| `identity` | Identity | 1 | REQUIRED |
| `description` | string (Markdown) | 1 | verbatim source doc comment; absent if unsourced |
| `inputs` | Input[] | 1 | props/attributes, universal |
| `events` | Event[] | 1 | |
| `slots` | Slot[] | 1 | slots/children |
| `methods` | Method[] | 1 | public methods only |
| `cssProperties` | CssProperty[] | 1 | CSS custom properties (universal) |
| `cssParts` | CssPart[] | 1 | `acmCemInherited`, `acmApplicability: ["retained-dom"]` |
| `semantics` | SemanticClassification | 2 | optional |
| `examples` | Example[] | 2 | optional (zero-example manifests conformant) |

### Identity
At least one facet REQUIRED; facets never merged across frameworks.

| Field | Type | Tier | Rules |
|---|---|---|---|
| `tagName` | string | 1 | retained-DOM facet; custom-element name grammar |
| `module` | string | 1 | paired with `export`; both-or-neither |
| `export` | string | 1 | VDOM/compiler facet |
| `selector` | string | 1 | Angular facet; CSS selector grammar |
| `paradigmClass` | enum: `retained-dom` \| `vdom` \| `compiler-sfc` \| `signals-di` | 1 | REQUIRED; drives coverage matrix |

## API surface members

### Input *(generalizes CEM attribute/field)*
| Field | Type | Tier | Rules |
|---|---|---|---|
| `name` | string | 1 | REQUIRED |
| `type` | TypeExpression | 1 | present where source typing exists |
| `default` | string (source expression, verbatim) | 1 | optional |
| `required` | boolean | 1 | default false |
| `reflects` | boolean | 1 | attribute reflection; `acmCemInherited`, retained-DOM only |
| `twoWay` | boolean | 1 | universal two-way-binding capability (Angular `[( )]`, Vue `v-model` abstraction) |
| `description` | string | 1 | verbatim doc comment |

### Event
| Field | Type | Tier | Rules |
|---|---|---|---|
| `name` | string | 1 | REQUIRED; mechanical name, no framework prefix (`click`, not `onClick`) |
| `payload` | TypeExpression | 1 | optional |
| `description` | string | 1 | |

### Slot *(covers slots, children, scoped slots / render props)*
| Field | Type | Tier | Rules |
|---|---|---|---|
| `name` | string | 1 | absent = default slot/children |
| `scopedPayload` | TypeExpression | 1 | data flowing INTO projected content (adversarial: scoped-slot/render-prop) |
| `description` | string | 1 | |

### Method
| Field | Type | Tier | Rules |
|---|---|---|---|
| `name` | string | 1 | REQUIRED |
| `parameters` | { name, type: TypeExpression }[] | 1 | |
| `return` | TypeExpression | 1 | |
| `description` | string | 1 | |

### CssProperty / CssPart
| Field | Type | Tier | Rules |
|---|---|---|---|
| `name` | string | 1 | REQUIRED (`--token` grammar for properties) |
| `syntax` | string | 1 | CSS syntax string, optional (CssProperty only) |
| `description` | string | 1 | |

## Type layer

### TypeExpression *(constitution VI layered model)*
Both-or-neither: absent entirely where source is untyped.

| Field | Type | Tier | Rules |
|---|---|---|---|
| `structured` | TypeNode | 1 | REQUIRED when present; must validate against grammar |
| `raw` | string | 1 | REQUIRED when present; verbatim source type text |

### TypeNode grammar (closed union; `kind` discriminates)
`primitive` (string/number/boolean/null/unknown) · `literal` (value) · `union`
(members[]) · `array` (items) · `record` (key, value) · `object` (named props) ·
`function` (params, return) · `reference` (name, module?) · `opaque` (declared
fallback — the ONLY escape when structuring fails; `raw` still required).

## Agentic layer

### SemanticClassification
| Field | Type | Tier | Rules |
|---|---|---|---|
| `term` | enum from `vocabulary.json` | 2 | REQUIRED within this object; controlled vocabulary only |
| `notes` | string | 2* | MAY accompany, never replace, a term; size-limited |

*`notes` is the one deliberate softness: it rides Tier 2 as an annotation on a checked
term, capped by structural limits. Unaccompanied prose semantics remain forbidden.

### Example
| Field | Type | Tier | Rules |
|---|---|---|---|
| `title` | string | 2 | optional |
| `lang` | enum (`ts`, `tsx`, `html`, `vue`, `svelte`) | 2 | REQUIRED |
| `source` | string | 2 | REQUIRED; must compile in producer CI to remain core |

## Schema-level annotations (meta-schema enforced, research R10)

| Keyword | Values | Rule |
|---|---|---|
| `acmTier` | `derived` \| `authored-verifiable` | REQUIRED on every specified field |
| `acmApplicability` | paradigm-class ids[] | present ⇒ `acmCemInherited: true` |
| `acmCemInherited` | boolean | marks CEM-grandfathered WC-specific nodes |

## Cross-entity validation rules

1. Every `ModuleExport.declaration` resolves to a `ComponentDeclaration.name` in the
   same document (FR-004).
2. `Identity`: ≥1 facet; `module`/`export` both-or-neither; `paradigmClass` REQUIRED.
3. `TypeExpression`: `structured` and `raw` both-or-neither (edge case: untyped JS).
4. Unknown `x-*` members: preserved through validate → canonicalize → Agent View.
5. Structural limits (from Normative Spec): every string field carries `maxLength`;
   every array `maxItems`; nesting depth enforced by validator (not expressible in
   JSON Schema — Normative Spec clause).
6. Duplicate member names within a collection: rejected.
