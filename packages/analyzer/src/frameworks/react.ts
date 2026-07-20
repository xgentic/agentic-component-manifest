/**
 * React plugin (T023, research R-07). Consumes only the public plugin interface.
 *
 * Exported function components (incl. `forwardRef`/`memo`) with a same-file props type
 * (interface / alias / inline). Each prop → input (`?` → optional, destructuring
 * defaults → `default`); callback/`on*` props stay inputs (React has no event channel).
 * Events/slots/CSS come from the CEM JSDoc tags; imperative-handle methods from
 * `useImperativeHandle`. Identity: module + export only; `paradigmClass: vdom`.
 */

import ts from "typescript";
import { cemTags, description } from "../jsdoc.js";
import type { AnalyzerPlugin, EntryDraft, ModuleContext, SessionContext } from "../plugin.js";
import { applyDocMetadata, isExportedDecl, methodDraft, moduleFacet } from "./shared.js";

interface Component {
  name: string;
  exported: boolean;
  /** The render function whose first parameter is the props. */
  render: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;
  /** Props type node (explicit annotation or a wrapper's type argument). */
  propsType: ts.TypeNode | undefined;
}

function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function unwrapWrapper(expr: ts.Expression): {
  fn?: ts.Expression;
  typeArgs?: ts.NodeArray<ts.TypeNode>;
} {
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const callee = expr.expression.text;
    if (callee === "forwardRef" || callee === "memo") {
      return { fn: expr.arguments[0], typeArgs: expr.typeArguments };
    }
  }
  return { fn: expr };
}

/** Recognize an exported function component from a top-level statement. */
function componentOf(node: ts.Node): Component | undefined {
  if (ts.isFunctionDeclaration(node) && node.name && isPascalCase(node.name.text)) {
    return {
      name: node.name.text,
      exported: isExportedDecl(node),
      render: node,
      propsType: node.parameters[0]?.type,
    };
  }
  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    if (
      !decl ||
      !ts.isIdentifier(decl.name) ||
      !isPascalCase(decl.name.text) ||
      !decl.initializer
    ) {
      return undefined;
    }
    const { fn, typeArgs } = unwrapWrapper(decl.initializer);
    if (!fn || (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn))) return undefined;
    const propsType = fn.parameters[0]?.type ?? typeArgs?.[1];
    return {
      name: decl.name.text,
      exported: isExportedDecl(node),
      render: fn,
      propsType,
    };
  }
  return undefined;
}

/** Resolve a props type node to its member property signatures (same-file only). */
function propsMembers(
  propsType: ts.TypeNode | undefined,
  module: ModuleContext,
): ts.PropertySignature[] {
  if (!propsType) return [];
  let literal: ts.TypeLiteralNode | ts.InterfaceDeclaration | undefined;
  if (ts.isTypeLiteralNode(propsType)) {
    literal = propsType;
  } else if (ts.isTypeReferenceNode(propsType)) {
    const name = propsType.typeName.getText(module.ast);
    for (const stmt of module.ast.statements) {
      if (ts.isInterfaceDeclaration(stmt) && stmt.name.text === name) literal = stmt;
      if (
        ts.isTypeAliasDeclaration(stmt) &&
        stmt.name.text === name &&
        ts.isTypeLiteralNode(stmt.type)
      ) {
        literal = stmt.type;
      }
    }
  }
  if (!literal) return [];
  return literal.members.filter(ts.isPropertySignature);
}

/** Map destructured prop defaults (`{ variant = 'primary' }`) → verbatim default text. */
function destructuringDefaults(
  render: Component["render"],
  module: ModuleContext,
): Map<string, string> {
  const defaults = new Map<string, string>();
  const param = render.parameters[0];
  if (param && ts.isObjectBindingPattern(param.name)) {
    for (const el of param.name.elements) {
      if (ts.isIdentifier(el.name) && el.initializer) {
        defaults.set(el.name.text, el.initializer.getText(module.ast));
      }
    }
  }
  return defaults;
}

/** Extract methods from `useImperativeHandle(ref, () => ({ ... }))`, in source order. */
function imperativeMethods(
  render: Component["render"],
  module: ModuleContext,
  ctx: SessionContext,
  entry: EntryDraft,
): void {
  const visit = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === "useImperativeHandle" &&
      n.arguments[1]
    ) {
      const factory = n.arguments[1];
      const body = ts.isArrowFunction(factory) ? factory.body : undefined;
      const obj =
        body && ts.isParenthesizedExpression(body) && ts.isObjectLiteralExpression(body.expression)
          ? body.expression
          : body && ts.isObjectLiteralExpression(body)
            ? body
            : undefined;
      if (obj) {
        for (const member of obj.properties) {
          if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
            entry.addMethod(methodDraft(member, member.name.text, module, ctx));
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(render);
}

function analyzeComponent(
  comp: Component,
  node: ts.Node,
  module: ModuleContext,
  ctx: SessionContext,
): void {
  const mod = moduleFacet(comp.exported, ctx);
  if (!mod) return; // module + export identity is the only identity React has
  const entry = ctx.createEntry(module, {
    name: comp.name,
    paradigmClass: "vdom",
    identity: { module: mod, export: comp.name },
  });

  const desc = description(node, module);
  if (desc) entry.describe(desc);
  applyDocMetadata(entry, node, module, ctx);

  const defaults = destructuringDefaults(comp.render, module);
  for (const prop of propsMembers(comp.propsType, module)) {
    if (!ts.isIdentifier(prop.name)) continue;
    const name = prop.name.text;
    entry.addInput({
      name,
      description: description(prop, module),
      type: ctx.types.map(prop.type, module),
      default: defaults.get(name),
      required: prop.questionToken ? undefined : true,
    });
  }

  imperativeMethods(comp.render, module, ctx, entry);

  const tags = cemTags(node, module, ctx.types);
  for (const event of tags.events) entry.addEvent(event);
  for (const slot of tags.slots) entry.addSlot(slot);
  for (const prop of tags.cssProperties) entry.addCssProperty(prop);
  for (const part of tags.cssParts) entry.addCssPart(part);
}

export function reactPlugin(): AnalyzerPlugin {
  return {
    name: "react",
    analyze(node, module, ctx) {
      const comp = componentOf(node);
      if (comp) analyzeComponent(comp, node, module, ctx);
    },
  };
}
