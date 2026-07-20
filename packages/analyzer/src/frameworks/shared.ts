/**
 * Shared syntactic helpers for the built-in framework plugins.
 *
 * These consume only the public plugin interface (`ModuleContext`, `SessionContext`,
 * the draft types) — they are convenience over the same seam an external plugin uses,
 * never a privileged path.
 */

import ts from "typescript";
import { description, exampleTags, semanticTag } from "../jsdoc.js";
import type {
  EntryDraft,
  InputDraft,
  MethodDraft,
  ModuleContext,
  SessionContext,
} from "../plugin.js";

/**
 * Attach Tier-2 doc-metadata (feature 003) to an entry: the `@acmSemantic` classification
 * and any `@example` usage blocks, from the declaration's doc comment. Framework-blind — the
 * four built-in frameworks all call this at their per-declaration extraction, so identical
 * annotations produce identical output (spec FR-010). Examples are compile-verified later.
 */
export function applyDocMetadata(
  entry: EntryDraft,
  node: ts.Node,
  module: ModuleContext,
  ctx: SessionContext,
): void {
  const semantic = semanticTag(node, module, ctx);
  if (semantic) entry.setSemantics(semantic);
  for (const example of exampleTags(node, module, ctx)) entry.addExample(example);
}

export function hasModifier(node: ts.HasModifiers, kind: ts.SyntaxKind): boolean {
  return (ts.getModifiers(node) ?? []).some((m) => m.kind === kind);
}

/** Public API member: instance-level, not private/protected, not `_`-prefixed. */
export function isPublicMember(member: ts.ClassElement): boolean {
  if (hasModifier(member as ts.HasModifiers, ts.SyntaxKind.StaticKeyword)) return false;
  if (hasModifier(member as ts.HasModifiers, ts.SyntaxKind.PrivateKeyword)) return false;
  if (hasModifier(member as ts.HasModifiers, ts.SyntaxKind.ProtectedKeyword)) return false;
  const name = member.name;
  if (name && ts.isPrivateIdentifier(name)) return false;
  if (name && ts.isIdentifier(name) && name.text.startsWith("_")) return false;
  return true;
}

export function memberName(member: ts.ClassElement): string | undefined {
  const name = member.name;
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
}

export function isExportedDecl(node: ts.HasModifiers): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

/** All decorators on a node (empty when none). */
export function decoratorsOf(node: ts.HasDecorators): readonly ts.Decorator[] {
  return ts.getDecorators(node) ?? [];
}

/** The identifier name of a decorator (`@Foo` or `@Foo(...)`), or undefined. */
export function decoratorName(dec: ts.Decorator): string | undefined {
  const expr = ts.isCallExpression(dec.expression) ? dec.expression.expression : dec.expression;
  return ts.isIdentifier(expr) ? expr.text : undefined;
}

/** Find a decorator by name on a node. */
export function findDecorator(node: ts.HasDecorators, name: string): ts.Decorator | undefined {
  return decoratorsOf(node).find((d) => decoratorName(d) === name);
}

/** The call expression of a decorator (`@Foo(args)`), or undefined for `@Foo`. */
export function decoratorCall(dec: ts.Decorator): ts.CallExpression | undefined {
  return ts.isCallExpression(dec.expression) ? dec.expression : undefined;
}

/** Read a property expression from an object literal by key. */
export function objectProp(
  obj: ts.ObjectLiteralExpression,
  key: string,
): ts.Expression | undefined {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key) {
      return p.initializer;
    }
  }
  return undefined;
}

export function stringValue(expr: ts.Expression | undefined): string | undefined {
  return expr && ts.isStringLiteralLike(expr) ? expr.text : undefined;
}

export function boolValue(expr: ts.Expression | undefined): boolean | undefined {
  if (!expr) return undefined;
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

/** Build a MethodDraft from a class method declaration. */
export function methodDraft(
  member: ts.MethodDeclaration,
  name: string,
  module: ModuleContext,
  ctx: SessionContext,
): MethodDraft {
  const parameters = member.parameters
    .filter((p) => ts.isIdentifier(p.name))
    .map((p) => ({
      name: (p.name as ts.Identifier).text,
      description: undefined,
      type: ctx.types.map(p.type, module),
    }));
  return {
    name,
    description: description(member, module),
    parameters: parameters.length ? parameters : undefined,
    return: ctx.types.map(member.type, module),
  };
}

/** Build an InputDraft from a class property, merging any framework-specific extras. */
export function inputFromProperty(
  member: ts.PropertyDeclaration,
  name: string,
  module: ModuleContext,
  ctx: SessionContext,
  extra: Partial<InputDraft> = {},
): InputDraft {
  return {
    name,
    description: description(member, module),
    type: ctx.types.map(member.type, module),
    default: member.initializer ? member.initializer.getText(module.ast) : undefined,
    ...extra,
  };
}

/** The module identity facet (package name) when the declaration is exported. */
export function moduleFacet(exported: boolean, ctx: SessionContext): string | undefined {
  return exported ? ctx.packageName : undefined;
}

/** True when the class declares `static formAssociated = true` (a form-associated WC). */
export function isFormAssociated(node: ts.ClassDeclaration): boolean {
  return node.members.some(
    (m) =>
      ts.isPropertyDeclaration(m) &&
      hasModifier(m, ts.SyntaxKind.StaticKeyword) &&
      ts.isIdentifier(m.name) &&
      m.name.text === "formAssociated" &&
      m.initializer?.kind === ts.SyntaxKind.TrueKeyword,
  );
}
