/**
 * Lit plugin (T020, research R-04). Consumes only the public plugin interface.
 *
 * Recognizes `@customElement(tag)`, `@property(...)` reactive properties (`reflect`,
 * `attribute` alias), initializer defaults, statically-evident
 * `dispatchEvent(new CustomEvent('name'))`, and the CEM JSDoc tags. Identity:
 * `tagName` + module/export; `paradigmClass: retained-dom`.
 */

import ts from "typescript";
import { cemTags, description } from "../jsdoc.js";
import type { AnalyzerPlugin, EntryDraft, ModuleContext, SessionContext } from "../plugin.js";
import { LIFECYCLE } from "./vanilla.js";
import {
  applyDocMetadata,
  boolValue,
  decoratorCall,
  findDecorator,
  inputFromProperty,
  isExportedDecl,
  isFormAssociated,
  isPublicMember,
  memberName,
  methodDraft,
  moduleFacet,
  objectProp,
  stringValue,
} from "./shared.js";

/** Lit reactive-lifecycle methods that are not public API. */
const LIT_LIFECYCLE = new Set([
  ...LIFECYCLE,
  "render",
  "update",
  "willUpdate",
  "firstUpdated",
  "updated",
  "shouldUpdate",
  "performUpdate",
  "scheduleUpdate",
  "createRenderRoot",
  "getUpdateComplete",
]);

/** The tag from `@customElement('tag')`, or undefined when the class is not a Lit element. */
function customElementTag(node: ts.ClassDeclaration): string | undefined {
  const dec = findDecorator(node, "customElement");
  const call = dec && decoratorCall(dec);
  const arg = call?.arguments[0];
  return arg && ts.isStringLiteralLike(arg) ? arg.text : undefined;
}

/** Extra input fields from a `@property({ reflect, attribute })` decorator. */
function propertyOptions(member: ts.PropertyDeclaration): {
  reflects?: boolean;
  attribute?: string;
} {
  const dec = findDecorator(member, "property");
  const call = dec && decoratorCall(dec);
  const arg = call?.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return {};
  const reflects = boolValue(objectProp(arg, "reflect")) === true ? true : undefined;
  const attribute = stringValue(objectProp(arg, "attribute"));
  return { reflects, attribute };
}

/** Find `this.dispatchEvent(new CustomEvent('name'))` event names in source order. */
function collectDispatchedEvents(node: ts.ClassDeclaration): string[] {
  const names: string[] = [];
  const visit = (n: ts.Node): void => {
    if (
      ts.isNewExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === "CustomEvent" &&
      n.arguments?.[0] &&
      ts.isStringLiteralLike(n.arguments[0])
    ) {
      const name = n.arguments[0].text;
      if (!names.includes(name)) names.push(name);
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(node, visit);
  return names;
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
  const entry: EntryDraft = ctx.createEntry(module, {
    name: className,
    paradigmClass: "retained-dom",
    identity: { tagName, module: mod, export: mod ? className : undefined },
  });

  const desc = description(node, module);
  if (desc) entry.describe(desc);
  applyDocMetadata(entry, node, module, ctx);

  for (const member of node.members) {
    if (!isPublicMember(member)) continue;
    const name = memberName(member);
    if (!name) continue;

    if (ts.isPropertyDeclaration(member) && findDecorator(member, "property")) {
      const { reflects, attribute } = propertyOptions(member);
      entry.addInput(
        inputFromProperty(member, name, module, ctx, {
          reflects,
          extensions: attribute && attribute !== name ? { "x-attribute": attribute } : undefined,
        }),
      );
    } else if (ts.isMethodDeclaration(member) && !LIT_LIFECYCLE.has(name)) {
      entry.addMethod(methodDraft(member, name, module, ctx));
    }
  }

  // CEM @fires tags first (typed payloads + descriptions), then any additional
  // statically-evident CustomEvent dispatches not already declared via @fires.
  const tags = cemTags(node, module, ctx.types);
  const firedNames = new Set<string>();
  for (const event of tags.events) {
    entry.addEvent(event);
    firedNames.add(event.name);
  }
  for (const name of collectDispatchedEvents(node)) {
    if (!firedNames.has(name)) entry.addEvent({ name });
  }
  for (const slot of tags.slots) entry.addSlot(slot);
  for (const prop of tags.cssProperties) entry.addCssProperty(prop);
  for (const part of tags.cssParts) entry.addCssPart(part);

  // `static formAssociated = true` is a web-component capability, not a member of the
  // public API surface — surfaced as the `x-wc` extension node (schema WC convention).
  if (isFormAssociated(node)) entry.set("x-wc", { formAssociated: true });
}

/** Build the Lit plugin. */
export function litPlugin(): AnalyzerPlugin {
  return {
    name: "lit",
    analyze(node, module, ctx) {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const tag = customElementTag(node);
      if (!tag) return;
      analyzeClass(node, tag, module, ctx);
    },
  };
}
