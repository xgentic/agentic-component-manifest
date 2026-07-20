/**
 * Public plugin interface of `@acm/analyzer` (contracts/plugin-api.md).
 *
 * This module is the package's public entry (`exports["."]`). Every built-in framework
 * plugin consumes exactly this interface — there is no privileged internal seam
 * (SC-005 by construction). Phase names inherit the CEM analyzer's lifecycle
 * vocabulary (Principle VIII: no new names for shared concepts).
 */

import type ts from "typescript";
import type { Diagnostic } from "./diagnostics.js";
import type { AnalyzerSettings } from "./types.js";

/** The paradigm class an implementation belongs to; drives the coverage matrix. */
export type ParadigmClass = "retained-dom" | "vdom" | "compiler-sfc" | "signals-di";

/**
 * A verbatim slice of source text with its provenance. The only value the draft API
 * accepts for a description — a plugin cannot invent prose into a core field because
 * the setter takes a `Span`, not a `string` (FR-008, Principle IV, by construction).
 * Spans are produced only by the source-slicing helpers in `jsdoc.ts` / the context.
 */
export interface Span {
  readonly __span: true;
  /** The exact source text this span covers. */
  readonly text: string;
  /** Project-relative POSIX path of the source module. */
  readonly file: string;
  /** UTF-16 offsets into the ORIGINAL file (SFC-remapped where applicable). */
  readonly start: number;
  readonly end: number;
}

/** One node of the closed structured type grammar (schema `$defs/typeNode`). */
export interface TypeNode {
  kind:
    | "primitive"
    | "literal"
    | "union"
    | "array"
    | "record"
    | "object"
    | "function"
    | "reference"
    | "opaque";
  primitive?: "string" | "number" | "boolean" | "null" | "undefined" | "void" | "unknown";
  value?: string | number | boolean | null;
  members?: TypeNode[];
  items?: TypeNode;
  key?: TypeNode;
  valueType?: TypeNode;
  fields?: Array<{ name: string; type: TypeNode; optional?: boolean }>;
  parameters?: TypeNode[];
  return?: TypeNode;
  name?: string;
  module?: string;
}

/** Layered type: structured machine tier + verbatim raw source text (both or neither). */
export interface TypeExpression {
  structured: TypeNode;
  raw: string;
}

/** Result of a container-format unwrap (e.g. Vue SFC → `<script>` text + offset map). */
export interface PreprocessResult {
  /** The extracted script text to parse as TypeScript. */
  text: string;
  /**
   * Maps an offset in the extracted `text` back to an offset in the original file, so
   * spans and diagnostics point into the real source. Identity when omitted.
   */
  remap?(offset: number): number;
}

/** Identity facets a plugin supplies when creating an entry (schema `$defs/identity`). */
export interface IdentityFacets {
  tagName?: string;
  module?: string;
  export?: string;
  selector?: string;
}

/** Everything needed to create exactly one entry draft. */
export interface EntryInit {
  /** Declaration name, unique within its module. */
  name: string;
  paradigmClass: ParadigmClass;
  identity: IdentityFacets;
}

export interface InputDraft {
  name: string;
  description?: Span;
  type?: TypeExpression;
  /** Default value as a verbatim source expression. */
  default?: string;
  required?: boolean;
  reflects?: boolean;
  twoWay?: boolean;
  /** Namespaced (`x-*`) passthrough fields; validated by the schema backstop. */
  extensions?: Record<string, unknown>;
}

export interface EventDraft {
  name: string;
  description?: Span;
  payload?: TypeExpression;
}

export interface SlotDraft {
  /** Absent for the default slot / children. */
  name?: string;
  description?: Span;
  scopedPayload?: TypeExpression;
}

export interface MethodParamDraft {
  name: string;
  description?: Span;
  type?: TypeExpression;
}

export interface MethodDraft {
  name: string;
  description?: Span;
  parameters?: MethodParamDraft[];
  return?: TypeExpression;
}

export interface CssPropertyDraft {
  name: string;
  description?: Span;
  syntax?: string;
  default?: string;
}

export interface CssPartDraft {
  name: string;
  description?: Span;
}

/**
 * Semantic classification (Tier-2, feature 003). `term` is a controlled-vocabulary token
 * validated at extraction against the schema's `semanticClassification.term` enum; `notes`
 * is an optional verbatim source span accompanying — never replacing — the term.
 */
export interface SemanticDraft {
  term: string;
  notes?: Span;
}

/**
 * Usage example (Tier-2, feature 003). `source` is the verbatim example code (fence markers
 * stripped); it reaches core `examples[]` only after compile-verification. `lang` is detected
 * from the fence info string (default `ts`); `title` is an optional leading caption.
 */
export interface ExampleDraft {
  lang: "ts" | "tsx" | "html";
  source: Span;
  title?: string;
}

/**
 * Working representation a plugin fills during `analyze`; serialized into the schema's
 * declaration shape at emit. Members preserve insertion (source) order. Core fields
 * accept only Tier-1 span-derived values; free-form data goes under `x-*` keys.
 */
export interface EntryDraft {
  readonly name: string;
  readonly paradigmClass: ParadigmClass;
  /** Set the declaration description from a verbatim source span (Tier 1). */
  describe(span: Span): void;
  addInput(input: InputDraft): void;
  addEvent(event: EventDraft): void;
  addSlot(slot: SlotDraft): void;
  addMethod(method: MethodDraft): void;
  addCssProperty(prop: CssPropertyDraft): void;
  addCssPart(part: CssPartDraft): void;
  /** Set the component's semantic classification (Tier-2). At most one per declaration. */
  setSemantics(semantic: SemanticDraft): void;
  /** Append a usage example (Tier-2), preserving source order. Verified before emit. */
  addExample(example: ExampleDraft): void;
  /** Contribute a namespaced extension field (arbitrary JSON). Rejects non-`x-` keys. */
  set(key: `x-${string}`, value: unknown): void;
}

/** Per-module view handed to `analyze` / `collect` / `moduleLink`. */
export interface ModuleContext {
  readonly path: string;
  readonly text: string;
  readonly ast: ts.SourceFile;
  readonly container: "ts" | "sfc";
  /** Entry drafts created in this module, in creation order. */
  readonly entries: readonly EntryDraft[];
  /** Map an offset in the parsed text back to the original file (SFC support). */
  remap(offset: number): number;
}

/** TS type node → layered `{ structured, raw }`. Total: never throws (worst case opaque). */
export interface TypeMapping {
  map(node: ts.TypeNode | undefined, module: ModuleContext): TypeExpression | undefined;
  /** Map a type written as text (e.g. from a JSDoc `{Type}`) against a module's imports. */
  mapText(text: string | undefined, module: ModuleContext): TypeExpression | undefined;
}

/** Whole-manifest post-pass view (schema-shaped, pre-serialization) for `packageLink`. */
export interface ManifestDraft {
  readonly modules: ReadonlyArray<{
    readonly path: string;
    readonly entries: readonly EntryDraft[];
  }>;
}

/** The single seam every plugin talks to. */
export interface SessionContext {
  readonly settings: AnalyzerSettings;
  /**
   * The analyzed package's name (from the nearest `package.json`), or `undefined`.
   * Plugins use it as the `module` identity facet. Resolved once by the engine; never
   * read from the environment by a plugin (determinism).
   */
  readonly packageName: string | undefined;
  /** Raise an analyzer diagnostic (`ACM-A-*`). Errors block writing. */
  addDiagnostic(diagnostic: Diagnostic): void;
  /** The only way to create an entry; validates paradigm class + identity facets. */
  createEntry(module: ModuleContext, init: EntryInit): EntryDraft;
  /** Produce a verbatim description span from a source range (Tier-1 helper). */
  span(module: ModuleContext, start: number, end: number): Span;
  /** The injected structured-type service. */
  readonly types: TypeMapping;
}

/**
 * One plugin = one framework's (or one enrichment concern's) participation in analysis.
 * Built-ins and external plugins are indistinguishable to the core.
 */
export interface AnalyzerPlugin {
  /** Unique per session; diagnostics are attributed to it. */
  name: string;
  /** Extra extensions merged into the DEFAULT globs (never into user-supplied globs). */
  fileExtensions?: string[];
  /** Optional container-format unwrap (Vue SFC → script text). Pure function of contents. */
  preprocess?(file: { path: string; text: string }): PreprocessResult | undefined;
  /** Per-module pre-pass: gather cross-declaration facts before analysis. */
  collect?(module: ModuleContext, ctx: SessionContext): void;
  /** Per-declaration extraction: fill an EntryDraft from the syntax node. */
  analyze?(node: ts.Node, module: ModuleContext, ctx: SessionContext): void;
  /** Per-module post-pass: exports, re-export deduplication. */
  moduleLink?(module: ModuleContext, ctx: SessionContext): void;
  /** Whole-manifest post-pass: final ordering-safe contributions. */
  packageLink?(manifest: ManifestDraft, ctx: SessionContext): void;
}
