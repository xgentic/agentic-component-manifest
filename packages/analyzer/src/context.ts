/**
 * Entry-creation seam (T008): the `EntryDraft` factory plus the `SessionContext` /
 * `ModuleContext` factories. This is where the plugin API's structural guarantees are
 * enforced — an entry cannot exist without a paradigm class and a valid identity, a
 * description cannot be a free string, and unnamespaced unknown keys are refused.
 */

import type ts from "typescript";
import type { Diagnostic } from "./diagnostics.js";
import type { AnalyzerSettings } from "./types.js";
import type {
  CssPartDraft,
  CssPropertyDraft,
  EntryDraft,
  EntryInit,
  EventDraft,
  ExampleDraft,
  IdentityFacets,
  InputDraft,
  ManifestDraft,
  MethodDraft,
  ModuleContext,
  ParadigmClass,
  SemanticDraft,
  SessionContext,
  SlotDraft,
  Span,
  TypeExpression,
  TypeMapping,
} from "./plugin.js";

/** Raised when a plugin creates a structurally-illegal entry; the engine attributes it. */
export class EntryDraftError extends Error {}

/** Identity facets legal for each paradigm class — the guard against merged surfaces. */
const ALLOWED_FACETS: Record<ParadigmClass, ReadonlyArray<keyof IdentityFacets>> = {
  "retained-dom": ["tagName", "module", "export"],
  vdom: ["module", "export"],
  "compiler-sfc": ["module", "export"],
  "signals-di": ["selector", "module", "export"],
};

const PARADIGM_CLASSES = Object.keys(ALLOWED_FACETS) as ParadigmClass[];

/** Construct a provenance-carrying span (the only accepted description value). */
export function makeSpan(file: string, start: number, end: number, text: string): Span {
  return { __span: true, text, file, start, end };
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

/** Escape a raw object key for use as a JSON Pointer reference token (RFC 6901). */
function escapePointer(key: string): string {
  return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Draft-API enforcement of contribution rule 1 (contracts/plugin-api.md): a member's
 * passthrough `extensions` may carry only namespaced `x-*` keys. Unnamespaced keys are
 * refused at the seam — a plugin cannot smuggle unverifiable data into a core field
 * (the validator is the backstop, but the draft API rejects it first, with attribution).
 */
function assertNamespaced(
  extensions: Record<string, unknown> | undefined,
  entry: string,
  member: string,
): void {
  if (!extensions) return;
  for (const key of Object.keys(extensions)) {
    if (!key.startsWith("x-")) {
      throw new EntryDraftError(
        `entry "${entry}" ${member}: only namespaced x-* keys are allowed (got "${key}")`,
      );
    }
  }
}

export class EntryDraftImpl implements EntryDraft {
  readonly name: string;
  readonly paradigmClass: ParadigmClass;
  /** The exported name this declaration binds to, when it carries an export facet. */
  get exportName(): string | undefined {
    return this.identity.export;
  }
  private readonly identity: IdentityFacets;
  private description: Span | undefined;
  private readonly inputs: InputDraft[] = [];
  private readonly events: EventDraft[] = [];
  private readonly slots: SlotDraft[] = [];
  private readonly methods: MethodDraft[] = [];
  private readonly cssProperties: CssPropertyDraft[] = [];
  private readonly cssParts: CssPartDraft[] = [];
  private semantics: SemanticDraft | undefined;
  private examples: ExampleDraft[] = [];
  private readonly extensions = new Map<string, unknown>();
  private readonly getActivePlugin: () => string | undefined;
  /** Per-contribution provenance: entry-relative JSON Pointer → the plugin that set it. */
  private readonly provenanceRecords: Array<{ path: string; plugin: string | undefined }> = [];

  constructor(init: EntryInit, getActivePlugin: () => string | undefined) {
    this.name = init.name;
    this.paradigmClass = init.paradigmClass;
    this.identity = { ...init.identity };
    this.getActivePlugin = getActivePlugin;
    this.record(""); // the entry root (name/identity) belongs to its creating plugin
  }

  /** Note that the currently-active plugin contributed the subtree at entry-relative `path`. */
  private record(path: string): void {
    this.provenanceRecords.push({ path, plugin: this.getActivePlugin() });
  }

  /**
   * Contribution provenance, entry-relative; the engine prefixes each with the entry's
   * output pointer so a validation failure can be attributed to the offending plugin (T042).
   */
  provenance(): ReadonlyArray<{ path: string; plugin: string | undefined }> {
    return this.provenanceRecords;
  }

  describe(span: Span): void {
    this.description = span;
    this.record("/description");
  }
  addInput(input: InputDraft): void {
    assertNamespaced(input.extensions, this.name, `input "${input.name}"`);
    this.record(`/inputs/${this.inputs.length}`);
    this.inputs.push(input);
  }
  addEvent(event: EventDraft): void {
    this.record(`/events/${this.events.length}`);
    this.events.push(event);
  }
  addSlot(slot: SlotDraft): void {
    this.record(`/slots/${this.slots.length}`);
    this.slots.push(slot);
  }
  addMethod(method: MethodDraft): void {
    this.record(`/methods/${this.methods.length}`);
    this.methods.push(method);
  }
  addCssProperty(prop: CssPropertyDraft): void {
    this.record(`/cssProperties/${this.cssProperties.length}`);
    this.cssProperties.push(prop);
  }
  addCssPart(part: CssPartDraft): void {
    this.record(`/cssParts/${this.cssParts.length}`);
    this.cssParts.push(part);
  }
  setSemantics(semantic: SemanticDraft): void {
    this.semantics = semantic;
    this.record("/semantics");
  }
  addExample(example: ExampleDraft): void {
    this.record(`/examples/${this.examples.length}`);
    this.examples.push(example);
  }
  /** Internal (verification pass only): the pending examples, in source order. */
  get exampleDrafts(): readonly ExampleDraft[] {
    return this.examples;
  }
  /** Internal (verification pass only): keep only examples whose flag is true, order-stable. */
  pruneExamples(keep: boolean[]): void {
    this.examples = this.examples.filter((_, i) => keep[i]);
  }
  set(key: `x-${string}`, value: unknown): void {
    if (!key.startsWith("x-")) {
      throw new EntryDraftError(
        `entry "${this.name}": only namespaced x-* keys may be set on core entries (got "${key}")`,
      );
    }
    this.extensions.set(key, value);
    this.record(`/${escapePointer(key)}`);
  }

  /** Serialize to the schema's declaration shape (Span → verbatim text, absent-when-empty). */
  toEntry(): Record<string, unknown> {
    const entry: Record<string, unknown> = {
      name: this.name,
      identity: omitUndefined({ paradigmClass: this.paradigmClass, ...this.identity }),
    };
    if (this.description) entry.description = this.description.text;
    if (this.inputs.length) entry.inputs = this.inputs.map(serializeInput);
    if (this.events.length) entry.events = this.events.map(serializeEvent);
    if (this.slots.length) entry.slots = this.slots.map(serializeSlot);
    if (this.methods.length) entry.methods = this.methods.map(serializeMethod);
    if (this.cssProperties.length)
      entry.cssProperties = this.cssProperties.map(serializeCssProperty);
    if (this.cssParts.length) entry.cssParts = this.cssParts.map(serializeCssPart);
    if (this.semantics) {
      entry.semantics = omitUndefined({
        term: this.semantics.term,
        notes: this.semantics.notes?.text,
      });
    }
    if (this.examples.length) entry.examples = this.examples.map(serializeExample);
    for (const [k, v] of this.extensions) entry[k] = v;
    return entry;
  }
}

function serializeType(t: TypeExpression | undefined): unknown {
  if (!t) return undefined;
  return { structured: t.structured, raw: t.raw };
}

function serializeInput(i: InputDraft): Record<string, unknown> {
  return omitUndefined({
    name: i.name,
    description: i.description?.text,
    type: serializeType(i.type),
    default: i.default,
    required: i.required,
    reflects: i.reflects,
    twoWay: i.twoWay,
    ...i.extensions,
  });
}

function serializeEvent(e: EventDraft): Record<string, unknown> {
  return omitUndefined({
    name: e.name,
    description: e.description?.text,
    payload: serializeType(e.payload),
  });
}

function serializeSlot(s: SlotDraft): Record<string, unknown> {
  return omitUndefined({
    name: s.name,
    description: s.description?.text,
    scopedPayload: serializeType(s.scopedPayload),
  });
}

function serializeMethod(m: MethodDraft): Record<string, unknown> {
  return omitUndefined({
    name: m.name,
    description: m.description?.text,
    parameters: m.parameters?.length
      ? m.parameters.map((p) =>
          omitUndefined({
            name: p.name,
            description: p.description?.text,
            type: serializeType(p.type),
          }),
        )
      : undefined,
    return: serializeType(m.return),
  });
}

function serializeCssProperty(p: CssPropertyDraft): Record<string, unknown> {
  return omitUndefined({
    name: p.name,
    description: p.description?.text,
    syntax: p.syntax,
    default: p.default,
  });
}

function serializeCssPart(p: CssPartDraft): Record<string, unknown> {
  return omitUndefined({ name: p.name, description: p.description?.text });
}

function serializeExample(e: ExampleDraft): Record<string, unknown> {
  return omitUndefined({ title: e.title, lang: e.lang, source: e.source.text });
}

function validateInit(init: EntryInit): void {
  if (!PARADIGM_CLASSES.includes(init.paradigmClass)) {
    throw new EntryDraftError(
      `entry "${init.name}": unknown paradigmClass "${init.paradigmClass}"`,
    );
  }
  const allowed = ALLOWED_FACETS[init.paradigmClass];
  const present = (Object.keys(init.identity) as Array<keyof IdentityFacets>).filter(
    (k) => init.identity[k] !== undefined,
  );
  if (present.length === 0) {
    throw new EntryDraftError(`entry "${init.name}": at least one identity facet is required`);
  }
  for (const facet of present) {
    if (!allowed.includes(facet)) {
      throw new EntryDraftError(
        `entry "${init.name}": facet "${facet}" is not valid for paradigmClass "${init.paradigmClass}" (no merged cross-framework surfaces)`,
      );
    }
  }
  const hasModule = init.identity.module !== undefined;
  const hasExport = init.identity.export !== undefined;
  if (hasModule !== hasExport) {
    throw new EntryDraftError(
      `entry "${init.name}": module and export facets are paired (both or neither)`,
    );
  }
}

/** Internal handle the engine uses to serialize modules and stamp the active plugin. */
export interface SessionContextInternal extends SessionContext {
  /** Set the plugin name stamped onto unattributed diagnostics and errors. */
  _setActivePlugin(name: string | undefined): void;
}

export function createSessionContext(
  settings: AnalyzerSettings,
  sink: Diagnostic[],
  types: TypeMapping,
  packageName: string | undefined,
): SessionContextInternal {
  let activePlugin: string | undefined;
  return {
    settings,
    types,
    packageName,
    _setActivePlugin(name) {
      activePlugin = name;
    },
    addDiagnostic(diagnostic) {
      sink.push(diagnostic.plugin ? diagnostic : { ...diagnostic, plugin: activePlugin });
    },
    span(module, start, end) {
      return makeSpan(
        module.path,
        module.remap(start),
        module.remap(end),
        module.text.slice(start, end),
      );
    },
    createEntry(module, init) {
      validateInit(init);
      const draft = new EntryDraftImpl(init, () => activePlugin);
      (module as ModuleContextInternal)._entries.push(draft);
      return draft;
    },
  };
}

/** Internal module context exposing the mutable entry list to the factory/engine. */
export interface ModuleContextInternal extends ModuleContext {
  readonly _entries: EntryDraftImpl[];
}

export function createModuleContext(
  path: string,
  text: string,
  ast: ts.SourceFile,
  container: "ts" | "sfc",
  remap: (offset: number) => number,
): ModuleContextInternal {
  const entries: EntryDraftImpl[] = [];
  return { path, text, ast, container, remap, _entries: entries, entries };
}

/** Assemble the ManifestDraft view handed to `packageLink`. */
export function manifestDraft(modules: ModuleContextInternal[]): ManifestDraft {
  return { modules: modules.map((m) => ({ path: m.path, entries: m.entries })) };
}

/** Serialize a module's drafts to its schema-shaped `{ path, declarations, exports }`. */
export function serializeModule(module: ModuleContextInternal): Record<string, unknown> {
  const declarations = module._entries.map((e) => e.toEntry());
  const exports = module._entries
    .filter((e) => e.exportName !== undefined)
    .map((e) => ({ name: e.exportName as string, declaration: e.name }));
  const out: Record<string, unknown> = { path: module.path };
  if (declarations.length) out.declarations = declarations;
  if (exports.length) out.exports = exports;
  return out;
}

/**
 * The modules that survive into the manifest — those with at least one declaration —
 * in output order. Shared by `assemble` and `buildProvenance` so their `modules[]`
 * indexing is guaranteed identical (attribution pointers must line up with the output).
 */
export function outputModules(modules: ModuleContextInternal[]): ModuleContextInternal[] {
  return modules.filter((m) => m._entries.length > 0);
}

/** An output-pointer subtree and the plugin that contributed it. */
export interface ProvenanceRecord {
  /** Absolute JSON Pointer prefix into the emitted manifest. */
  prefix: string;
  /** The plugin active when the contribution was made (a framework or user plugin). */
  plugin: string | undefined;
}

/**
 * Map every plugin contribution to the output JSON Pointer subtree it produced, so a
 * post-`packageLink` validation failure can be attributed to the offending plugin
 * (T042, US4 scenario 4). Indices mirror `assemble` exactly via `outputModules`.
 */
export function buildProvenance(modules: ModuleContextInternal[]): ProvenanceRecord[] {
  const provenance: ProvenanceRecord[] = [];
  outputModules(modules).forEach((module, mi) => {
    module._entries.forEach((entry, di) => {
      const base = `/modules/${mi}/declarations/${di}`;
      for (const rec of entry.provenance()) {
        provenance.push({ prefix: base + rec.path, plugin: rec.plugin });
      }
    });
  });
  return provenance;
}
