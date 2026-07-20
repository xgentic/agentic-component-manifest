# ACM Field Reference

Generated from `acm.schema.json` — do not edit by hand. Regenerate with `pnpm generate`.

## (document root)

Universal, framework-agnostic manifest describing UI components in mechanical terms plus agent-oriented metadata. Property declaration order in this schema defines canonical JSON key order (Normative Spec NS-CANON-2).

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `schemaVersion` | string | derived | The ACM schema version this manifest conforms to (semver). Consumers resolve capability from this declaration, never from guesswork. |
| `modules` | array<module> | derived | The JavaScript modules of the package that declare components. |

## module

One source module and the component declarations it contains.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `path` | string | derived | Package-relative path of the source module. |
| `declarations` | array<componentDeclaration> | derived | Component declarations contained in this module. |
| `exports` | array<moduleExport> | derived | Bindings from exported names to declarations in this module. |

## moduleExport

An export binding of a module.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `name` | string | derived | The exported name; "default" for default exports. |
| `declaration` | string | derived | Name of the declaration this export binds to; must resolve within the document. |

## componentDeclaration

Exactly one component implementation artifact in one framework. Never a merged cross-framework surface.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `name` | string | derived | Declaration name, unique within its module. |
| `identity` | → identity | derived | How this implementation is addressed, via universal identity facets. |
| `description` | string | derived | Verbatim source doc-comment text (Markdown). Absent when the source has no documentation; never authored directly into the manifest. |
| `inputs` | array<input> | derived | Inputs (props/attributes) accepted by the component. |
| `events` | array<event> | derived | Events emitted by the component, in mechanical (framework-free) naming. |
| `slots` | array<slot> | derived | Content projection points: slots, children, and scoped slots / render props. |
| `methods` | array<method> | derived | Public methods callable on the component instance or its imperative handle. |
| `cssProperties` | array<cssProperty> | derived | CSS custom properties the component consumes for styling. |
| `cssParts` | array<cssPart> | derived | CSS shadow parts exposed via ::part(). CEM-inherited; applies to retained-DOM components only. *(CEM-inherited; applies: retained-dom)* |
| `semantics` | → semanticClassification | authored-verifiable | Controlled-vocabulary semantic classification of the component. |
| `examples` | array<example> | authored-verifiable | Usage examples. Optional; each must compile in the producer's CI to remain core content. |

## identity

Universal identity: one shape whose facets cover all paradigm classes; an entry fills the facets that apply.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `paradigmClass` | enum(4) | derived | The paradigm class this implementation belongs to; drives the coverage matrix. |
| `tagName` | string | derived | Custom element tag name facet (retained-DOM). CEM-inherited. *(CEM-inherited; applies: retained-dom)* |
| `module` | string | derived | Module specifier facet; paired with export (both or neither). |
| `export` | string | derived | Export name facet; paired with module (both or neither). |
| `selector` | string | derived | Angular-style selector facet (CSS selector grammar). |

## input

One input (prop/attribute) of the component.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `name` | string | derived | Mechanical input name as declared in source. |
| `description` | string | derived | Verbatim source doc-comment text for this input. |
| `type` | → typeExpression | derived | Layered type of the input value. |
| `default` | string | derived | Default value as a verbatim source expression. |
| `required` | boolean | derived | Whether the input must be provided. |
| `reflects` | boolean | derived | Whether the property reflects to an attribute. CEM-inherited; retained-DOM only. *(CEM-inherited; applies: retained-dom)* |
| `twoWay` | boolean | derived | Whether the input supports two-way binding (universal abstraction of Angular [( )] / Vue v-model). |

## event

One event emitted by the component.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `name` | string | derived | Mechanical event name without framework prefixes ("press", not "onPress"). |
| `description` | string | derived | Verbatim source doc-comment text for this event. |
| `payload` | → typeExpression | derived | Layered type of the event payload. |

## slot

One content projection point. Name absent means the default slot / children.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `name` | string | derived | Slot name; absent for the default slot. |
| `description` | string | derived | Verbatim source doc-comment text for this slot. |
| `scopedPayload` | → typeExpression | derived | Layered type of data flowing into projected content (scoped slot / render prop). |

## method

One public method of the component.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `name` | string | derived | Method name as declared in source. |
| `description` | string | derived | Verbatim source doc-comment text for this method. |
| `parameters` | array<object> | derived | Ordered method parameters. |
| `return` | → typeExpression | derived | Layered return type. |

## cssProperty

One CSS custom property the component consumes.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `name` | string | derived | Custom property name including the -- prefix. |
| `description` | string | derived | Verbatim source doc-comment text for this custom property. |
| `syntax` | string | derived | CSS syntax string (per CSS Properties and Values). |
| `default` | string | derived | Default CSS value as verbatim source text. |

## cssPart

One CSS shadow part exposed via ::part(). CEM-inherited node.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `name` | string | derived | Part name. |
| `description` | string | derived | Verbatim source doc-comment text for this part. |

## typeExpression

Layered type: a structured machine tier plus the verbatim raw source type text. Both present or the node is absent entirely.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `structured` | → typeNode | derived | Structured machine-tier type expression; "opaque" kind is the declared fallback when structuring fails. |
| `raw` | string | derived | Verbatim source type text (e.g., the original TypeScript type). |

## typeNode

One node of the closed structured type grammar, discriminated by kind.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `kind` | enum(9) | derived | Discriminator of the type node. |
| `primitive` | enum(7) | derived | Primitive name (kind: primitive). |
| `value` | string|number|boolean|null | derived | Literal value (kind: literal). |
| `members` | array<typeNode> | derived | Union members (kind: union). |
| `items` | → typeNode | derived | Element type (kind: array). |
| `key` | → typeNode | derived | Key type (kind: record). |
| `valueType` | → typeNode | derived | Value type (kind: record). |
| `fields` | array<object> | derived | Named fields (kind: object). |
| `parameters` | array<typeNode> | derived | Function parameters (kind: function). |
| `return` | → typeNode | derived | Function return type (kind: function). |
| `name` | string | derived | Referenced type name (kind: reference). |
| `module` | string | derived | Module the referenced type comes from (kind: reference). |

## semanticClassification

Semantic classification from the controlled vocabulary; notes may accompany, never replace, a term.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `term` | enum(45) | authored-verifiable | Controlled-vocabulary term (Open UI taxonomy / WAI-ARIA anchored; pinned in packages/spec/data/vocabulary.json). |
| `notes` | string | authored-verifiable | Constrained freeform notes accompanying the term; never a replacement for it. |

## example

One usage example; must compile in the producer's CI to remain core content.

| Field | Type | Tier | Description |
| --- | --- | --- | --- |
| `title` | string | authored-verifiable | Short example title. |
| `lang` | enum(3) | authored-verifiable | Example source language. |
| `source` | string | authored-verifiable | Example source code. |
