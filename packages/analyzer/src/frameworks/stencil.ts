/**
 * Stencil plugin (T021, research R-06). Consumes only the public plugin interface.
 *
 * Recognizes `@Component({ tag })` classes. `@Prop()` reactive properties become inputs
 * (honoring `{ reflect }`, `{ attribute }` alias, and `{ mutable }`); `@Event()`
 * `EventEmitter<T>` properties become events with typed payloads (honoring the
 * `{ eventName }` alias); `@Method()` members become methods. Unlike Lit/Angular, Stencil
 * methods are **opt-in** — only `@Method()`-decorated methods are public API, so a plain
 * public method is internal and excluded. `@State()`/`@Watch()`/`@Listen()`/`@Element()`
 * members are internal and ignored. Slots and CSS hooks come from the CEM JSDoc tags;
 * `@Component({ formAssociated: true })` surfaces the `x-wc` node. Identity: `tagName` +
 * module/export; `paradigmClass: retained-dom`.
 */

import ts from "typescript";
import { cemTags, description } from "../jsdoc.js";
import type {
  AnalyzerPlugin,
  EntryDraft,
  ModuleContext,
  SessionContext,
  TypeExpression,
} from "../plugin.js";
import {
  applyDocMetadata,
  boolValue,
  decoratorCall,
  findDecorator,
  inputFromProperty,
  isExportedDecl,
  isPublicMember,
  memberName,
  methodDraft,
  moduleFacet,
  objectProp,
  stringValue,
} from "./shared.js";

/** The object-literal options of a `@Component(...)` / `@Prop(...)` / `@Event(...)` call. */
function decoratorOptions(dec: ts.Decorator | undefined): ts.ObjectLiteralExpression | undefined {
  const arg = dec && decoratorCall(dec)?.arguments[0];
  return arg && ts.isObjectLiteralExpression(arg) ? arg : undefined;
}

/** The tag from `@Component({ tag: '...' })`, or undefined when the class is not a Stencil component. */
function componentTag(node: ts.ClassDeclaration): string | undefined {
  const opts = decoratorOptions(findDecorator(node, "Component"));
  return opts ? stringValue(objectProp(opts, "tag")) : undefined;
}

/** True when the class declares `@Component({ formAssociated: true })` (a form-associated WC). */
function isFormAssociated(node: ts.ClassDeclaration): boolean {
  const opts = decoratorOptions(findDecorator(node, "Component"));
  return !!opts && boolValue(objectProp(opts, "formAssociated")) === true;
}

/**
 * Whether a prop's type serializes to an HTML attribute, per Stencil's rule: primitives
 * (`string`/`number`/`boolean`), string/number literals, and unions thereof map to an
 * attribute; complex types (objects, arrays, functions, references) are property-only.
 * An untyped `@Prop()` is treated as `any`, which Stencil still exposes as an attribute.
 */
function mapsToAttribute(type: TypeExpression | undefined): boolean {
  const s = type?.structured;
  if (!s) return true;
  if (s.kind === "primitive") {
    return s.primitive === "string" || s.primitive === "number" || s.primitive === "boolean";
  }
  if (s.kind === "literal") return true;
  if (s.kind === "union") return (s.members ?? []).every((m) => m.kind === "literal");
  return false;
}

/** Stencil derives an attribute name by dash-casing (param-case) the property name. */
function dashCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/** Extra input fields from a `@Prop({ reflect, attribute, mutable })` decorator. */
function propOptions(member: ts.PropertyDeclaration): {
  reflects?: boolean;
  attribute?: string;
  mutable?: boolean;
} {
  const opts = decoratorOptions(findDecorator(member, "Prop"));
  if (!opts) return {};
  return {
    reflects: boolValue(objectProp(opts, "reflect")) === true ? true : undefined,
    attribute: stringValue(objectProp(opts, "attribute")),
    mutable: boolValue(objectProp(opts, "mutable")) === true ? true : undefined,
  };
}

/** The aliased public event name from `@Event({ eventName: '...' })`, if any. */
function eventNameAlias(dec: ts.Decorator): string | undefined {
  const opts = decoratorOptions(dec);
  return opts ? stringValue(objectProp(opts, "eventName")) : undefined;
}

/** Payload of an `@Event() foo: EventEmitter<T>` property, from its `EventEmitter<T>` annotation. */
function emitterPayload(
  member: ts.PropertyDeclaration,
  module: ModuleContext,
  ctx: SessionContext,
): TypeExpression | undefined {
  if (member.type && ts.isTypeReferenceNode(member.type) && member.type.typeArguments?.[0]) {
    return ctx.types.map(member.type.typeArguments[0], module);
  }
  return undefined;
}

function analyzeComponent(
  node: ts.ClassDeclaration,
  tagName: string | undefined,
  module: ModuleContext,
  ctx: SessionContext,
): void {
  const className = node.name!.text;
  const mod = moduleFacet(isExportedDecl(node), ctx);
  const entry: EntryDraft = ctx.createEntry(module, {
    name: className,
    paradigmClass: "retained-dom",
    identity: { tagName, module: mod, export: mod ? className : undefined },
  });

  const desc = description(node, module);
  if (desc) entry.describe(desc);
  applyDocMetadata(entry, node, module, ctx);

  const eventNames = new Set<string>();
  for (const member of node.members) {
    if (!isPublicMember(member)) continue;
    const name = memberName(member);
    if (!name) continue;

    if (ts.isPropertyDeclaration(member) && findDecorator(member, "Prop")) {
      const { reflects, attribute, mutable } = propOptions(member);
      const input = inputFromProperty(member, name, module, ctx, { reflects });
      // A serializable @Prop() is exposed as a dash-cased attribute; capture the attribute
      // name (explicit alias, else Stencil's implicit derivation) when it differs from the
      // property name — the non-obvious case an agent needs to author markup correctly.
      const attrName = attribute ?? (mapsToAttribute(input.type) ? dashCase(name) : undefined);
      const extensions: Record<string, unknown> = {};
      if (attrName && attrName !== name) extensions["x-attribute"] = attrName;
      if (mutable) extensions["x-stencil"] = { mutable: true };
      if (Object.keys(extensions).length) input.extensions = extensions;
      entry.addInput(input);
    } else if (ts.isPropertyDeclaration(member) && findDecorator(member, "Event")) {
      const eventName = eventNameAlias(findDecorator(member, "Event")!) ?? name;
      entry.addEvent({
        name: eventName,
        description: description(member, module),
        payload: emitterPayload(member, module, ctx),
      });
      eventNames.add(eventName);
    } else if (ts.isMethodDeclaration(member) && findDecorator(member, "Method")) {
      // Opt-in: only `@Method()`-decorated methods are the element's public API.
      entry.addMethod(methodDraft(member, name, module, ctx));
    }
  }

  // JSDoc supplements: additional @fires events, plus all slots and CSS hooks.
  const tags = cemTags(node, module, ctx.types);
  for (const event of tags.events) if (!eventNames.has(event.name)) entry.addEvent(event);
  for (const slot of tags.slots) entry.addSlot(slot);
  for (const prop of tags.cssProperties) entry.addCssProperty(prop);
  for (const part of tags.cssParts) entry.addCssPart(part);

  if (isFormAssociated(node)) entry.set("x-wc", { formAssociated: true });
}

/** Build the Stencil plugin. */
export function stencilPlugin(): AnalyzerPlugin {
  return {
    name: "stencil",
    analyze(node, module, ctx) {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      if (!findDecorator(node, "Component")) return;
      const tag = componentTag(node);
      // A component with neither a tag nor an export has no identity facet.
      if (!tag && !isExportedDecl(node)) return;
      analyzeComponent(node, tag, module, ctx);
    },
  };
}
