/**
 * Default vanilla web-component plugin (T015, research R-04).
 *
 * Consumes ONLY the public plugin interface (dogfooding, SC-005). Recognizes classes
 * registered with `customElements.define`, extracts public members as inputs/methods,
 * and reads the CEM JSDoc tag vocabulary for events/slots/CSS. Identity: `tagName`
 * plus module/export facets; `paradigmClass: retained-dom`.
 */

import ts from "typescript";
import { cemTags, description } from "../jsdoc.js";
import type { AnalyzerPlugin, EntryDraft, ModuleContext, SessionContext } from "../plugin.js";
import {
  applyDocMetadata,
  inputFromProperty,
  isExportedDecl,
  isPublicMember,
  memberName,
  methodDraft,
  moduleFacet,
} from "./shared.js";

/** Lifecycle callbacks that are not part of the public API surface. */
export const LIFECYCLE = new Set([
  "connectedCallback",
  "disconnectedCallback",
  "attributeChangedCallback",
  "adoptedCallback",
  "formAssociatedCallback",
  "formDisabledCallback",
  "formResetCallback",
  "formStateRestoreCallback",
]);

/** Attach CEM JSDoc tags (events/slots/cssProperties/cssParts) to an entry. */
export function applyCemTags(
  entry: EntryDraft,
  node: ts.Node,
  module: ModuleContext,
  ctx: SessionContext,
): void {
  const tags = cemTags(node, module, ctx.types);
  for (const event of tags.events) entry.addEvent(event);
  for (const slot of tags.slots) entry.addSlot(slot);
  for (const prop of tags.cssProperties) entry.addCssProperty(prop);
  for (const part of tags.cssParts) entry.addCssPart(part);
}

/** Map `customElements.define('tag', Class)` → { Class: tag } for one module. */
function collectDefinitions(module: ModuleContext): Map<string, string> {
  const map = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "define" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "customElements" &&
      node.arguments.length >= 2 &&
      ts.isStringLiteralLike(node.arguments[0]!) &&
      ts.isIdentifier(node.arguments[1]!)
    ) {
      map.set(
        (node.arguments[1] as ts.Identifier).text,
        (node.arguments[0] as ts.StringLiteral).text,
      );
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(module.ast, visit);
  return map;
}

function analyzeClass(
  node: ts.ClassDeclaration,
  tagName: string,
  module: ModuleContext,
  ctx: SessionContext,
): void {
  const className = node.name!.text;
  const exported = isExportedDecl(node);
  const mod = moduleFacet(exported, ctx);

  const entry = ctx.createEntry(module, {
    name: className,
    paradigmClass: "retained-dom",
    identity: { tagName, module: mod, export: mod ? className : undefined },
  });

  const desc = description(node, module);
  if (desc) entry.describe(desc);

  for (const member of node.members) {
    if (!isPublicMember(member)) continue;
    const name = memberName(member);
    if (!name) continue;
    if (ts.isPropertyDeclaration(member)) {
      entry.addInput(inputFromProperty(member, name, module, ctx));
    } else if (ts.isMethodDeclaration(member) && !LIFECYCLE.has(name)) {
      entry.addMethod(methodDraft(member, name, module, ctx));
    }
  }

  applyCemTags(entry, node, module, ctx);
  applyDocMetadata(entry, node, module, ctx);
}

export function vanillaPlugin(): AnalyzerPlugin {
  const definitions = new WeakMap<ModuleContext, Map<string, string>>();
  return {
    name: "vanilla",
    collect(module) {
      definitions.set(module, collectDefinitions(module));
    },
    analyze(node, module, ctx) {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const tagName = definitions.get(module)?.get(node.name.text);
      if (!tagName) return;
      analyzeClass(node, tagName, module, ctx);
    },
  };
}
