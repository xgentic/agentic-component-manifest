/* Generated from packages/spec/schema/acm.schema.json — do not edit by hand.
 * Regenerate with `pnpm generate`; staleness fails CI (gate-drift). */

/**
 * How this implementation is addressed, via universal identity facets.
 */
export type Identity = {
  [k: string]: unknown;
} & {
  /**
   * The paradigm class this implementation belongs to; drives the coverage matrix.
   */
  paradigmClass: "retained-dom" | "vdom" | "compiler-sfc" | "signals-di";
  /**
   * Custom element tag name facet (retained-DOM). CEM-inherited.
   */
  tagName?: string;
  /**
   * Module specifier facet; paired with export (both or neither).
   */
  module?: string;
  /**
   * Export name facet; paired with module (both or neither).
   */
  export?: string;
  /**
   * Angular-style selector facet (CSS selector grammar).
   */
  selector?: string;
  /**
   * This interface was referenced by `undefined`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
};

/**
 * Universal, framework-agnostic manifest describing UI components in mechanical terms plus agent-oriented metadata. Property declaration order in this schema defines canonical JSON key order (Normative Spec NS-CANON-2).
 */
export interface AgenticComponentManifest {
  /**
   * The ACM schema version this manifest conforms to (semver). Consumers resolve capability from this declaration, never from guesswork.
   */
  schemaVersion: string;
  /**
   * The JavaScript modules of the package that declare components.
   *
   * @maxItems 256
   */
  modules: Module[];
  /**
   * This interface was referenced by `AgenticComponentManifest`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One source module and the component declarations it contains.
 */
export interface Module {
  /**
   * Package-relative path of the source module.
   */
  path: string;
  /**
   * Component declarations contained in this module.
   *
   * @maxItems 256
   */
  declarations?: ComponentDeclaration[];
  /**
   * Bindings from exported names to declarations in this module.
   *
   * @maxItems 512
   */
  exports?: ModuleExport[];
  /**
   * This interface was referenced by `Module`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Exactly one component implementation artifact in one framework. Never a merged cross-framework surface.
 */
export interface ComponentDeclaration {
  /**
   * Declaration name, unique within its module.
   */
  name: string;
  identity: Identity;
  /**
   * Verbatim source doc-comment text (Markdown). Absent when the source has no documentation; never authored directly into the manifest.
   */
  description?: string;
  /**
   * Inputs (props/attributes) accepted by the component.
   *
   * @maxItems 256
   */
  inputs?: Input[];
  /**
   * Events emitted by the component, in mechanical (framework-free) naming.
   *
   * @maxItems 256
   */
  events?: Event[];
  /**
   * Content projection points: slots, children, and scoped slots / render props.
   *
   * @maxItems 256
   */
  slots?: Slot[];
  /**
   * Public methods callable on the component instance or its imperative handle.
   *
   * @maxItems 256
   */
  methods?: Method[];
  /**
   * CSS custom properties the component consumes for styling.
   *
   * @maxItems 256
   */
  cssProperties?: CssProperty[];
  /**
   * CSS shadow parts exposed via ::part(). CEM-inherited; applies to retained-DOM components only.
   *
   * @maxItems 256
   */
  cssParts?: CssPart[];
  semantics?: SemanticClassification;
  /**
   * Usage examples. Optional; each must compile in the producer's CI to remain core content.
   *
   * @maxItems 32
   */
  examples?: Example[];
  /**
   * This interface was referenced by `ComponentDeclaration`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One input (prop/attribute) of the component.
 */
export interface Input {
  /**
   * Mechanical input name as declared in source.
   */
  name: string;
  /**
   * Verbatim source doc-comment text for this input.
   */
  description?: string;
  type?: TypeExpression;
  /**
   * Default value as a verbatim source expression.
   */
  default?: string;
  /**
   * Whether the input must be provided.
   */
  required?: boolean;
  /**
   * Whether the property reflects to an attribute. CEM-inherited; retained-DOM only.
   */
  reflects?: boolean;
  /**
   * Whether the input supports two-way binding (universal abstraction of Angular [( )] / Vue v-model).
   */
  twoWay?: boolean;
  /**
   * This interface was referenced by `Input`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Layered type of the input value.
 */
export interface TypeExpression {
  structured: TypeNode;
  /**
   * Verbatim source type text (e.g., the original TypeScript type).
   */
  raw: string;
  /**
   * This interface was referenced by `TypeExpression`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Structured machine-tier type expression; "opaque" kind is the declared fallback when structuring fails.
 */
export interface TypeNode {
  /**
   * Discriminator of the type node.
   */
  kind: "primitive" | "literal" | "union" | "array" | "record" | "object" | "function" | "reference" | "opaque";
  /**
   * Primitive name (kind: primitive).
   */
  primitive?: "string" | "number" | "boolean" | "null" | "undefined" | "void" | "unknown";
  /**
   * Literal value (kind: literal).
   */
  value?: string | number | boolean | null;
  /**
   * Union members (kind: union).
   *
   * @maxItems 64
   */
  members?: TypeNode1[];
  items?: TypeNode2;
  key?: TypeNode3;
  valueType?: TypeNode4;
  /**
   * Named fields (kind: object).
   *
   * @maxItems 64
   */
  fields?: {
    /**
     * Field name.
     */
    name: string;
    type: TypeNode5;
    /**
     * Whether the field is optional.
     */
    optional?: boolean;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
  }[];
  /**
   * Function parameters (kind: function).
   *
   * @maxItems 64
   */
  parameters?: TypeNode1[];
  return?: TypeNode6;
  /**
   * Referenced type name (kind: reference).
   */
  name?: string;
  /**
   * Module the referenced type comes from (kind: reference).
   */
  module?: string;
  /**
   * This interface was referenced by `TypeNode6`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode5`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One node of the closed structured type grammar, discriminated by kind.
 */
export interface TypeNode1 {
  /**
   * Discriminator of the type node.
   */
  kind: "primitive" | "literal" | "union" | "array" | "record" | "object" | "function" | "reference" | "opaque";
  /**
   * Primitive name (kind: primitive).
   */
  primitive?: "string" | "number" | "boolean" | "null" | "undefined" | "void" | "unknown";
  /**
   * Literal value (kind: literal).
   */
  value?: string | number | boolean | null;
  /**
   * Union members (kind: union).
   *
   * @maxItems 64
   */
  members?: TypeNode1[];
  items?: TypeNode2;
  key?: TypeNode3;
  valueType?: TypeNode4;
  /**
   * Named fields (kind: object).
   *
   * @maxItems 64
   */
  fields?: {
    /**
     * Field name.
     */
    name: string;
    type: TypeNode5;
    /**
     * Whether the field is optional.
     */
    optional?: boolean;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
  }[];
  /**
   * Function parameters (kind: function).
   *
   * @maxItems 64
   */
  parameters?: TypeNode1[];
  return?: TypeNode6;
  /**
   * Referenced type name (kind: reference).
   */
  name?: string;
  /**
   * Module the referenced type comes from (kind: reference).
   */
  module?: string;
  /**
   * This interface was referenced by `TypeNode6`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode5`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Element type (kind: array).
 */
export interface TypeNode2 {
  /**
   * Discriminator of the type node.
   */
  kind: "primitive" | "literal" | "union" | "array" | "record" | "object" | "function" | "reference" | "opaque";
  /**
   * Primitive name (kind: primitive).
   */
  primitive?: "string" | "number" | "boolean" | "null" | "undefined" | "void" | "unknown";
  /**
   * Literal value (kind: literal).
   */
  value?: string | number | boolean | null;
  /**
   * Union members (kind: union).
   *
   * @maxItems 64
   */
  members?: TypeNode1[];
  items?: TypeNode2;
  key?: TypeNode3;
  valueType?: TypeNode4;
  /**
   * Named fields (kind: object).
   *
   * @maxItems 64
   */
  fields?: {
    /**
     * Field name.
     */
    name: string;
    type: TypeNode5;
    /**
     * Whether the field is optional.
     */
    optional?: boolean;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
  }[];
  /**
   * Function parameters (kind: function).
   *
   * @maxItems 64
   */
  parameters?: TypeNode1[];
  return?: TypeNode6;
  /**
   * Referenced type name (kind: reference).
   */
  name?: string;
  /**
   * Module the referenced type comes from (kind: reference).
   */
  module?: string;
  /**
   * This interface was referenced by `TypeNode6`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode5`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Key type (kind: record).
 */
export interface TypeNode3 {
  /**
   * Discriminator of the type node.
   */
  kind: "primitive" | "literal" | "union" | "array" | "record" | "object" | "function" | "reference" | "opaque";
  /**
   * Primitive name (kind: primitive).
   */
  primitive?: "string" | "number" | "boolean" | "null" | "undefined" | "void" | "unknown";
  /**
   * Literal value (kind: literal).
   */
  value?: string | number | boolean | null;
  /**
   * Union members (kind: union).
   *
   * @maxItems 64
   */
  members?: TypeNode1[];
  items?: TypeNode2;
  key?: TypeNode3;
  valueType?: TypeNode4;
  /**
   * Named fields (kind: object).
   *
   * @maxItems 64
   */
  fields?: {
    /**
     * Field name.
     */
    name: string;
    type: TypeNode5;
    /**
     * Whether the field is optional.
     */
    optional?: boolean;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
  }[];
  /**
   * Function parameters (kind: function).
   *
   * @maxItems 64
   */
  parameters?: TypeNode1[];
  return?: TypeNode6;
  /**
   * Referenced type name (kind: reference).
   */
  name?: string;
  /**
   * Module the referenced type comes from (kind: reference).
   */
  module?: string;
  /**
   * This interface was referenced by `TypeNode6`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode5`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Value type (kind: record).
 */
export interface TypeNode4 {
  /**
   * Discriminator of the type node.
   */
  kind: "primitive" | "literal" | "union" | "array" | "record" | "object" | "function" | "reference" | "opaque";
  /**
   * Primitive name (kind: primitive).
   */
  primitive?: "string" | "number" | "boolean" | "null" | "undefined" | "void" | "unknown";
  /**
   * Literal value (kind: literal).
   */
  value?: string | number | boolean | null;
  /**
   * Union members (kind: union).
   *
   * @maxItems 64
   */
  members?: TypeNode1[];
  items?: TypeNode2;
  key?: TypeNode3;
  valueType?: TypeNode4;
  /**
   * Named fields (kind: object).
   *
   * @maxItems 64
   */
  fields?: {
    /**
     * Field name.
     */
    name: string;
    type: TypeNode5;
    /**
     * Whether the field is optional.
     */
    optional?: boolean;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
  }[];
  /**
   * Function parameters (kind: function).
   *
   * @maxItems 64
   */
  parameters?: TypeNode1[];
  return?: TypeNode6;
  /**
   * Referenced type name (kind: reference).
   */
  name?: string;
  /**
   * Module the referenced type comes from (kind: reference).
   */
  module?: string;
  /**
   * This interface was referenced by `TypeNode6`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode5`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Field type.
 */
export interface TypeNode5 {
  /**
   * Discriminator of the type node.
   */
  kind: "primitive" | "literal" | "union" | "array" | "record" | "object" | "function" | "reference" | "opaque";
  /**
   * Primitive name (kind: primitive).
   */
  primitive?: "string" | "number" | "boolean" | "null" | "undefined" | "void" | "unknown";
  /**
   * Literal value (kind: literal).
   */
  value?: string | number | boolean | null;
  /**
   * Union members (kind: union).
   *
   * @maxItems 64
   */
  members?: TypeNode1[];
  items?: TypeNode2;
  key?: TypeNode3;
  valueType?: TypeNode4;
  /**
   * Named fields (kind: object).
   *
   * @maxItems 64
   */
  fields?: {
    /**
     * Field name.
     */
    name: string;
    type: TypeNode5;
    /**
     * Whether the field is optional.
     */
    optional?: boolean;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
  }[];
  /**
   * Function parameters (kind: function).
   *
   * @maxItems 64
   */
  parameters?: TypeNode1[];
  return?: TypeNode6;
  /**
   * Referenced type name (kind: reference).
   */
  name?: string;
  /**
   * Module the referenced type comes from (kind: reference).
   */
  module?: string;
  /**
   * This interface was referenced by `TypeNode6`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode5`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One node of the closed structured type grammar, discriminated by kind.
 */
export interface TypeNode6 {
  /**
   * Discriminator of the type node.
   */
  kind: "primitive" | "literal" | "union" | "array" | "record" | "object" | "function" | "reference" | "opaque";
  /**
   * Primitive name (kind: primitive).
   */
  primitive?: "string" | "number" | "boolean" | "null" | "undefined" | "void" | "unknown";
  /**
   * Literal value (kind: literal).
   */
  value?: string | number | boolean | null;
  /**
   * Union members (kind: union).
   *
   * @maxItems 64
   */
  members?: TypeNode1[];
  items?: TypeNode2;
  key?: TypeNode3;
  valueType?: TypeNode4;
  /**
   * Named fields (kind: object).
   *
   * @maxItems 64
   */
  fields?: {
    /**
     * Field name.
     */
    name: string;
    type: TypeNode5;
    /**
     * Whether the field is optional.
     */
    optional?: boolean;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
  }[];
  /**
   * Function parameters (kind: function).
   *
   * @maxItems 64
   */
  parameters?: TypeNode1[];
  return?: TypeNode6;
  /**
   * Referenced type name (kind: reference).
   */
  name?: string;
  /**
   * Module the referenced type comes from (kind: reference).
   */
  module?: string;
  /**
   * This interface was referenced by `TypeNode6`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode5`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeNode`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One event emitted by the component.
 */
export interface Event {
  /**
   * Mechanical event name without framework prefixes ("press", not "onPress").
   */
  name: string;
  /**
   * Verbatim source doc-comment text for this event.
   */
  description?: string;
  payload?: TypeExpression1;
  /**
   * This interface was referenced by `Event`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Layered type of the event payload.
 */
export interface TypeExpression1 {
  structured: TypeNode;
  /**
   * Verbatim source type text (e.g., the original TypeScript type).
   */
  raw: string;
  /**
   * This interface was referenced by `TypeExpression`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One content projection point. Name absent means the default slot / children.
 */
export interface Slot {
  /**
   * Slot name; absent for the default slot.
   */
  name?: string;
  /**
   * Verbatim source doc-comment text for this slot.
   */
  description?: string;
  scopedPayload?: TypeExpression2;
  /**
   * This interface was referenced by `Slot`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Layered type of data flowing into projected content (scoped slot / render prop).
 */
export interface TypeExpression2 {
  structured: TypeNode;
  /**
   * Verbatim source type text (e.g., the original TypeScript type).
   */
  raw: string;
  /**
   * This interface was referenced by `TypeExpression`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One public method of the component.
 */
export interface Method {
  /**
   * Method name as declared in source.
   */
  name: string;
  /**
   * Verbatim source doc-comment text for this method.
   */
  description?: string;
  /**
   * Ordered method parameters.
   *
   * @maxItems 64
   */
  parameters?: {
    /**
     * Parameter name.
     */
    name: string;
    /**
     * Verbatim source doc-comment text for this parameter.
     */
    description?: string;
    type?: TypeExpression3;
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^x-".
     */
    [k: string]: unknown;
  }[];
  return?: TypeExpression4;
  /**
   * This interface was referenced by `Method`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Layered type of the parameter.
 */
export interface TypeExpression3 {
  structured: TypeNode;
  /**
   * Verbatim source type text (e.g., the original TypeScript type).
   */
  raw: string;
  /**
   * This interface was referenced by `TypeExpression`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Layered return type.
 */
export interface TypeExpression4 {
  structured: TypeNode;
  /**
   * Verbatim source type text (e.g., the original TypeScript type).
   */
  raw: string;
  /**
   * This interface was referenced by `TypeExpression`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression1`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression2`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression3`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   *
   * This interface was referenced by `TypeExpression4`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One CSS custom property the component consumes.
 */
export interface CssProperty {
  /**
   * Custom property name including the -- prefix.
   */
  name: string;
  /**
   * Verbatim source doc-comment text for this custom property.
   */
  description?: string;
  /**
   * CSS syntax string (per CSS Properties and Values).
   */
  syntax?: string;
  /**
   * Default CSS value as verbatim source text.
   */
  default?: string;
  /**
   * This interface was referenced by `CssProperty`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One CSS shadow part exposed via ::part(). CEM-inherited node.
 */
export interface CssPart {
  /**
   * Part name.
   */
  name: string;
  /**
   * Verbatim source doc-comment text for this part.
   */
  description?: string;
  /**
   * This interface was referenced by `CssPart`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * Controlled-vocabulary semantic classification of the component.
 */
export interface SemanticClassification {
  /**
   * Controlled-vocabulary term (Open UI taxonomy / WAI-ARIA anchored; pinned in packages/spec/data/vocabulary.json).
   */
  term:
    | "accordion"
    | "alert"
    | "alertdialog"
    | "avatar"
    | "badge"
    | "breadcrumb"
    | "button"
    | "card"
    | "carousel"
    | "checkbox"
    | "combobox"
    | "datepicker"
    | "dialog"
    | "disclosure"
    | "empty-state"
    | "file-upload"
    | "grid"
    | "image"
    | "link"
    | "listbox"
    | "menu"
    | "menubar"
    | "meter"
    | "navigation"
    | "pagination"
    | "popover"
    | "progressbar"
    | "radio"
    | "rating"
    | "searchbox"
    | "select"
    | "skeleton"
    | "slider"
    | "spinbutton"
    | "switch"
    | "tab"
    | "table"
    | "tabpanel"
    | "tabs"
    | "textbox"
    | "toast"
    | "toolbar"
    | "tooltip"
    | "tree"
    | "treegrid";
  /**
   * Constrained freeform notes accompanying the term; never a replacement for it.
   */
  notes?: string;
  /**
   * This interface was referenced by `SemanticClassification`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * One usage example; must compile in the producer's CI to remain core content.
 */
export interface Example {
  /**
   * Short example title.
   */
  title?: string;
  /**
   * Example source language.
   */
  lang: "ts" | "tsx" | "html";
  /**
   * Example source code.
   */
  source: string;
  /**
   * This interface was referenced by `Example`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
/**
 * An export binding of a module.
 */
export interface ModuleExport {
  /**
   * The exported name; "default" for default exports.
   */
  name: string;
  /**
   * Name of the declaration this export binds to; must resolve within the document.
   */
  declaration: string;
  /**
   * This interface was referenced by `ModuleExport`'s JSON-Schema definition
   * via the `patternProperty` "^x-".
   */
  [k: string]: unknown;
}
