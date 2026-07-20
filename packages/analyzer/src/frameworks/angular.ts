/**
 * Angular plugin (T024, research R-07). Consumes only the public plugin interface.
 *
 * Recognizes `@Component({ selector })` classes in both idiomatic authoring styles:
 * the signal APIs (`input()`, `input.required()`, `model()`, `output()`) and the
 * classic decorators (`@Input()`, `@Output() = new EventEmitter<T>()`), honoring
 * `@Input`/`@Output` aliases. `model()` inputs are two-way; `input.required()` and
 * `@Input({ required: true })` are required. Events come from outputs; slots and CSS
 * hooks from the CEM JSDoc tags; Angular lifecycle hooks are excluded from methods.
 * Identity: `selector` + module/export; `paradigmClass: signals-di`.
 */

import ts from "typescript";
import { cemTags, description } from "../jsdoc.js";
import type {
  AnalyzerPlugin,
  EntryDraft,
  InputDraft,
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

/** Angular lifecycle and ControlValueAccessor hooks that are not public API. */
const ANGULAR_LIFECYCLE = new Set([
  "ngOnChanges",
  "ngOnInit",
  "ngDoCheck",
  "ngAfterContentInit",
  "ngAfterContentChecked",
  "ngAfterViewInit",
  "ngAfterViewChecked",
  "ngOnDestroy",
  "writeValue",
  "registerOnChange",
  "registerOnTouched",
  "setDisabledState",
]);

/** The selector from `@Component({ selector: '...' })`, or undefined when absent. */
function componentSelector(node: ts.ClassDeclaration): string | undefined {
  const call = decoratorCall(findDecorator(node, "Component")!);
  const arg = call?.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
  return stringValue(objectProp(arg, "selector"));
}

interface SignalFactory {
  kind: "input" | "model" | "output";
  required: boolean;
  typeArg: ts.TypeNode | undefined;
  defaultArg: ts.Expression | undefined;
}

/** Recognize an `input()/input.required()/model()/output()` property initializer. */
function signalFactory(init: ts.Expression | undefined): SignalFactory | undefined {
  if (!init || !ts.isCallExpression(init)) return undefined;
  let callee = init.expression;
  let required = false;
  if (ts.isPropertyAccessExpression(callee)) {
    if (callee.name.text !== "required") return undefined;
    required = true;
    callee = callee.expression;
  }
  if (!ts.isIdentifier(callee)) return undefined;
  const kind = callee.text;
  if (kind !== "input" && kind !== "model" && kind !== "output") return undefined;
  return {
    kind,
    required,
    typeArg: init.typeArguments?.[0],
    defaultArg: required ? undefined : init.arguments[0],
  };
}

/** Alias/required options from an `@Input(...)` decorator. */
function inputOptions(dec: ts.Decorator): { alias?: string; required?: boolean } {
  const arg = decoratorCall(dec)?.arguments[0];
  if (!arg) return {};
  if (ts.isStringLiteralLike(arg)) return { alias: arg.text };
  if (ts.isObjectLiteralExpression(arg)) {
    return {
      alias: stringValue(objectProp(arg, "alias")),
      required: boolValue(objectProp(arg, "required")) === true ? true : undefined,
    };
  }
  return {};
}

/** The aliased public event name from an `@Output(...)` decorator, if any. */
function outputAlias(dec: ts.Decorator): string | undefined {
  const arg = decoratorCall(dec)?.arguments[0];
  if (arg && ts.isStringLiteralLike(arg)) return arg.text;
  if (arg && ts.isObjectLiteralExpression(arg)) return stringValue(objectProp(arg, "alias"));
  return undefined;
}

/** Payload of a decorator output: `new EventEmitter<T>()` or an `EventEmitter<T>` annotation. */
function emitterPayload(
  member: ts.PropertyDeclaration,
  module: ModuleContext,
  ctx: SessionContext,
): TypeExpression | undefined {
  const init = member.initializer;
  if (init && ts.isNewExpression(init) && init.typeArguments?.[0]) {
    return ctx.types.map(init.typeArguments[0], module);
  }
  if (member.type && ts.isTypeReferenceNode(member.type) && member.type.typeArguments?.[0]) {
    return ctx.types.map(member.type.typeArguments[0], module);
  }
  return undefined;
}

/** Input draft for a signal `input()/model()` property (default is the call argument). */
function signalInput(
  member: ts.PropertyDeclaration,
  name: string,
  sig: SignalFactory,
  module: ModuleContext,
  ctx: SessionContext,
): InputDraft {
  return {
    name,
    description: description(member, module),
    type: sig.typeArg ? ctx.types.map(sig.typeArg, module) : ctx.types.map(member.type, module),
    default: sig.defaultArg ? sig.defaultArg.getText(module.ast) : undefined,
    required: sig.required ? true : undefined,
    twoWay: sig.kind === "model" ? true : undefined,
  };
}

function analyzeComponent(
  node: ts.ClassDeclaration,
  selector: string | undefined,
  module: ModuleContext,
  ctx: SessionContext,
): void {
  const className = node.name!.text;
  const mod = moduleFacet(isExportedDecl(node), ctx);
  const entry: EntryDraft = ctx.createEntry(module, {
    name: className,
    paradigmClass: "signals-di",
    identity: { selector, module: mod, export: mod ? className : undefined },
  });

  const desc = description(node, module);
  if (desc) entry.describe(desc);
  applyDocMetadata(entry, node, module, ctx);

  const eventNames = new Set<string>();
  const addEvent = (name: string, event: Parameters<EntryDraft["addEvent"]>[0]): void => {
    entry.addEvent(event);
    eventNames.add(name);
  };

  for (const member of node.members) {
    if (!isPublicMember(member)) continue;
    const name = memberName(member);
    if (!name) continue;

    if (ts.isPropertyDeclaration(member)) {
      const sig = signalFactory(member.initializer);
      const inputDec = findDecorator(member, "Input");
      const outputDec = findDecorator(member, "Output");
      if (sig?.kind === "output") {
        addEvent(name, {
          name,
          description: description(member, module),
          payload: sig.typeArg ? ctx.types.map(sig.typeArg, module) : undefined,
        });
      } else if (sig) {
        entry.addInput(signalInput(member, name, sig, module, ctx));
      } else if (inputDec) {
        const { alias, required } = inputOptions(inputDec);
        entry.addInput(
          inputFromProperty(member, alias ?? name, module, ctx, required ? { required: true } : {}),
        );
      } else if (outputDec) {
        const eventName = outputAlias(outputDec) ?? name;
        addEvent(eventName, {
          name: eventName,
          description: description(member, module),
          payload: emitterPayload(member, module, ctx),
        });
      }
    } else if (ts.isMethodDeclaration(member) && !ANGULAR_LIFECYCLE.has(name)) {
      entry.addMethod(methodDraft(member, name, module, ctx));
    }
  }

  // JSDoc supplements: additional @fires events, plus all slots and CSS hooks.
  const tags = cemTags(node, module, ctx.types);
  for (const event of tags.events) if (!eventNames.has(event.name)) entry.addEvent(event);
  for (const slot of tags.slots) entry.addSlot(slot);
  for (const prop of tags.cssProperties) entry.addCssProperty(prop);
  for (const part of tags.cssParts) entry.addCssPart(part);
}

/** Build the Angular plugin. */
export function angularPlugin(): AnalyzerPlugin {
  return {
    name: "angular",
    analyze(node, module, ctx) {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      if (!findDecorator(node, "Component")) return;
      const selector = componentSelector(node);
      // A component with neither a selector nor an export has no identity facet.
      if (!selector && !isExportedDecl(node)) return;
      analyzeComponent(node, selector, module, ctx);
    },
  };
}
