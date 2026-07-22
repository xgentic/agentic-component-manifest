/**
 * JSDoc extraction (T011): verbatim doc-comment description spans and the CEM tag
 * vocabulary (`@fires`/`@event`, `@slot`, `@cssprop`/`@cssproperty`, `@csspart`).
 *
 * Descriptions are carried verbatim (absent when the source has none — never
 * synthesized, Principle IV). Custom tags are parsed from the raw tag text; TypeScript
 * preserves it whole for non-standard tags.
 */

import ts from "typescript";
import { acmSchema } from "@xgentic/acm";
import { makeSpan } from "./context.js";
import type {
  CssPartDraft,
  CssPropertyDraft,
  EventDraft,
  ExampleDraft,
  ModuleContext,
  SemanticDraft,
  SessionContext,
  SlotDraft,
  Span,
  TypeMapping,
} from "./plugin.js";

/**
 * The controlled-vocabulary term set (feature 003, research R-02) — read from the schema's
 * own `semanticClassification.term` enum via `@xgentic/acm`, so there is no parallel term
 * list to drift (Principle I, single source of truth).
 */
const SEMANTIC_TERMS: ReadonlySet<string> = new Set<string>(
  (
    acmSchema as {
      $defs?: { semanticClassification?: { properties?: { term?: { enum?: string[] } } } };
    }
  ).$defs?.semanticClassification?.properties?.term?.enum ?? [],
);

/** Structural limits, read from the schema so there is no parallel constant to drift (Principle I). */
const DEFS =
  (
    acmSchema as {
      $defs?: Record<
        string,
        { properties?: Record<string, { maxLength?: number; maxItems?: number }> }
      >;
    }
  ).$defs ?? {};
const NOTES_MAX = DEFS.semanticClassification?.properties?.notes?.maxLength ?? 2048;
const EX_SOURCE_MAX = DEFS.example?.properties?.source?.maxLength ?? 8192;
const EX_TITLE_MAX = DEFS.example?.properties?.title?.maxLength ?? 256;
const EX_MAX_ITEMS = DEFS.componentDeclaration?.properties?.examples?.maxItems ?? 32;

/** Language a fence info string maps to, or `undefined` when unsupported. */
function fenceLang(info: string): ExampleDraft["lang"] | undefined {
  const l = info.trim().toLowerCase();
  if (l === "" || l === "ts" || l === "typescript" || l === "js" || l === "javascript") return "ts";
  if (l === "tsx" || l === "jsx") return "tsx";
  if (l === "html") return "html";
  return undefined;
}

function jsDocBlocks(node: ts.Node): ts.JSDoc[] {
  return ((node as { jsDoc?: ts.JSDoc[] }).jsDoc ?? []).filter(ts.isJSDoc);
}

/** The nearest JSDoc block (the one immediately above the node), or undefined. */
function nearestBlock(node: ts.Node): ts.JSDoc | undefined {
  const blocks = jsDocBlocks(node);
  return blocks.length ? blocks[blocks.length - 1] : undefined;
}

function spanOf(node: ts.Node, module: ModuleContext, text: string): Span {
  const sf = module.ast;
  return makeSpan(module.path, module.remap(node.getStart(sf)), module.remap(node.getEnd()), text);
}

/** Verbatim description of a declaration or member — its JSDoc free text, or absent. */
export function description(node: ts.Node, module: ModuleContext): Span | undefined {
  const block = nearestBlock(node);
  if (!block) return undefined;
  const text = ts.getTextOfJSDocComment(block.comment);
  if (!text) return undefined;
  return spanOf(block, module, text);
}

/** Split a tag body into its leading token(s) and a trailing `- description`. */
function splitDescription(body: string): { head: string; desc: string | undefined } {
  const sep = body.indexOf(" - ");
  if (sep >= 0) {
    return { head: body.slice(0, sep).trim(), desc: body.slice(sep + 3).trim() || undefined };
  }
  const trimmed = body.trim();
  if (trimmed.startsWith("-")) return { head: "", desc: trimmed.slice(1).trim() || undefined };
  return { head: trimmed, desc: undefined };
}

interface RawTag {
  name: string;
  body: string;
  node: ts.JSDocTag;
}

function tagsOf(node: ts.Node): RawTag[] {
  const block = nearestBlock(node);
  if (!block?.tags) return [];
  return block.tags.map((t) => ({
    name: t.tagName.text.toLowerCase(),
    body: ts.getTextOfJSDocComment(t.comment) ?? "",
    node: t,
  }));
}

export interface CemTags {
  events: EventDraft[];
  slots: SlotDraft[];
  cssProperties: CssPropertyDraft[];
  cssParts: CssPartDraft[];
}

/** Parse the CEM tag vocabulary from a declaration's JSDoc into ready-to-add drafts. */
export function cemTags(node: ts.Node, module: ModuleContext, types: TypeMapping): CemTags {
  const out: CemTags = { events: [], slots: [], cssProperties: [], cssParts: [] };
  for (const tag of tagsOf(node)) {
    const span = (text: string | undefined): Span | undefined =>
      text === undefined ? undefined : spanOf(tag.node, module, text);

    if (tag.name === "fires" || tag.name === "event") {
      const typeMatch = tag.body.match(/\{([^}]*)\}/);
      const rest = tag.body.replace(/\{[^}]*\}/, " ");
      const { head, desc } = splitDescription(rest);
      if (!head) continue;
      out.events.push({
        name: head,
        description: span(desc),
        payload: typeMatch ? types.mapText(typeMatch[1], module) : undefined,
      });
    } else if (tag.name === "slot") {
      const { head, desc } = splitDescription(tag.body);
      out.slots.push({ name: head || undefined, description: span(desc) });
    } else if (tag.name === "cssprop" || tag.name === "cssproperty") {
      const syntaxMatch = tag.body.match(/\{([^}]*)\}/);
      let rest = tag.body.replace(/\{[^}]*\}/, " ");
      const bracket = rest.match(/\[([^\]]*)\]/);
      let name: string | undefined;
      let dflt: string | undefined;
      if (bracket) {
        rest = rest.replace(/\[[^\]]*\]/, " ");
        const eq = bracket[1]!.indexOf("=");
        name = eq >= 0 ? bracket[1]!.slice(0, eq).trim() : bracket[1]!.trim();
        dflt = eq >= 0 ? bracket[1]!.slice(eq + 1).trim() : undefined;
      }
      const { head, desc } = splitDescription(rest);
      if (!name) name = head || undefined;
      if (!name) continue;
      out.cssProperties.push({
        name,
        description: span(desc),
        syntax: syntaxMatch ? syntaxMatch[1]!.trim() : undefined,
        default: dflt,
      });
    } else if (tag.name === "csspart") {
      const { head, desc } = splitDescription(tag.body);
      if (!head) continue;
      out.cssParts.push({ name: head, description: span(desc) });
    }
  }
  return out;
}

/** Emit a doc-metadata warning about a declaration's doc comment (feature 003). */
function docWarn(ctx: SessionContext, module: ModuleContext, code: string, message: string): void {
  ctx.addDiagnostic({ code, severity: "warning", file: module.path, message });
}

/**
 * Parse the `@acmSemantic <term> - <notes>` tag (feature 003, contracts/doc-tags.md). The
 * term is validated against the controlled vocabulary; an unknown/empty term or a duplicate
 * tag is a warning (semantics dropped), never manifest content. First tag in source order
 * wins. Returns the draft, or `undefined` when none is valid.
 */
export function semanticTag(
  node: ts.Node,
  module: ModuleContext,
  ctx: SessionContext,
): SemanticDraft | undefined {
  const tags = tagsOf(node).filter((t) => t.name === "acmsemantic");
  if (tags.length === 0) return undefined;
  if (tags.length > 1) {
    docWarn(
      ctx,
      module,
      "ACM-A-SEMDUP",
      `multiple @acmSemantic tags; using the first, ignoring ${tags.length - 1} more`,
    );
  }
  const tag = tags[0]!;
  const { head: term, desc: notes } = splitDescription(tag.body);
  if (!term) {
    docWarn(ctx, module, "ACM-A-SEMTERM", "@acmSemantic has no term; semantics dropped");
    return undefined;
  }
  if (!SEMANTIC_TERMS.has(term)) {
    docWarn(
      ctx,
      module,
      "ACM-A-SEMTERM",
      `@acmSemantic term "${term}" is not in the controlled vocabulary; semantics dropped`,
    );
    return undefined;
  }
  if (notes !== undefined && notes.length > NOTES_MAX) {
    docWarn(
      ctx,
      module,
      "ACM-A-EXLIMIT",
      `@acmSemantic notes exceed ${NOTES_MAX} chars; notes dropped`,
    );
    return { term };
  }
  return { term, notes: notes === undefined ? undefined : spanOf(tag.node, module, notes) };
}

/** A fenced code block inside an `@example` body: `[preamble] \`\`\`lang\\n<code>\`\`\``. */
const FENCE = /```([A-Za-z]*)\r?\n([\s\S]*?)```/;

/**
 * Parse `@example` blocks (feature 003, contracts/doc-tags.md). One `ExampleDraft` per block,
 * in source order. A fence's info string sets `lang` (default `ts`); text before the fence is
 * the `title`; the fenced code (markers stripped) is the verbatim `source`. Empty bodies and
 * unsupported fence languages are warnings (block dropped). Compile-verification happens later
 * (`examples-verify.ts`); this only extracts.
 */
export function exampleTags(
  node: ts.Node,
  module: ModuleContext,
  ctx: SessionContext,
): ExampleDraft[] {
  const out: ExampleDraft[] = [];
  for (const tag of tagsOf(node).filter((t) => t.name === "example")) {
    const body = tag.body;
    const fence = body.match(FENCE);
    let lang: ExampleDraft["lang"] = "ts";
    let title: string | undefined;
    let source: string;
    if (fence) {
      const detected = fenceLang(fence[1] ?? "");
      if (detected === undefined) {
        docWarn(
          ctx,
          module,
          "ACM-A-EXLANG",
          `@example fence language "${fence[1]}" is unsupported (ts|tsx|html); example dropped`,
        );
        continue;
      }
      lang = detected;
      title = body.slice(0, fence.index).trim() || undefined;
      source = (fence[2] ?? "").replace(/\r?\n$/, "");
    } else {
      source = body.trim();
    }
    if (source.trim() === "") {
      docWarn(ctx, module, "ACM-A-EXEMPTY", "@example has no code body; example dropped");
      continue;
    }
    if (source.length > EX_SOURCE_MAX) {
      docWarn(
        ctx,
        module,
        "ACM-A-EXLIMIT",
        `@example source exceeds ${EX_SOURCE_MAX} chars; example dropped`,
      );
      continue;
    }
    if (title !== undefined && title.length > EX_TITLE_MAX) {
      docWarn(
        ctx,
        module,
        "ACM-A-EXLIMIT",
        `@example title exceeds ${EX_TITLE_MAX} chars; title dropped`,
      );
      title = undefined;
    }
    if (out.length >= EX_MAX_ITEMS) {
      docWarn(
        ctx,
        module,
        "ACM-A-EXLIMIT",
        `more than ${EX_MAX_ITEMS} @example blocks; extras dropped`,
      );
      break;
    }
    out.push({ lang, title, source: spanOf(tag.node, module, source) });
  }
  return out;
}
