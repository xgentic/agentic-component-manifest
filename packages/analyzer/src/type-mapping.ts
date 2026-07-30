/**
 * `TypeMapping` service (T010) — executes `docs/type-mapping.md`.
 *
 * TS type node → `{ structured, raw }`. Syntax-only: no checker, no cross-file
 * resolution. Total (never throws); worst case is the declared `opaque` fallback plus
 * verbatim `raw`. Reference modules come only from the file's own `import` clauses.
 */

import ts from "typescript";
import type { TypeMapping, TypeNode } from "./plugin.js";

/** Structured recursion is bounded here; deeper nodes take the opaque fallback. */
export const DEPTH_BOUND = 4;

function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

function rootName(name: ts.EntityName): string {
  let n: ts.EntityName = name;
  while (ts.isQualifiedName(n)) n = n.left;
  return n.text;
}

const importCache = new WeakMap<ts.SourceFile, Map<string, string>>();

/** Map local imported name → module specifier, from the file's own import clauses. */
function importsOf(sf: ts.SourceFile): Map<string, string> {
  const cached = importCache.get(sf);
  if (cached) return cached;
  const map = new Map<string, string>();
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const spec = stmt.moduleSpecifier.text;
    const clause = stmt.importClause;
    if (!clause) continue;
    if (clause.name) map.set(clause.name.text, spec);
    const nb = clause.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) map.set(nb.name.text, spec);
    else if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) map.set(el.name.text, spec);
  }
  importCache.set(sf, map);
  return map;
}

const PRIMITIVE_KEYWORDS: Partial<Record<ts.SyntaxKind, TypeNode["primitive"]>> = {
  [ts.SyntaxKind.StringKeyword]: "string",
  [ts.SyntaxKind.NumberKeyword]: "number",
  [ts.SyntaxKind.BooleanKeyword]: "boolean",
  [ts.SyntaxKind.VoidKeyword]: "void",
  [ts.SyntaxKind.UndefinedKeyword]: "undefined",
  [ts.SyntaxKind.UnknownKeyword]: "unknown",
  [ts.SyntaxKind.NullKeyword]: "null",
};

function structured(
  node: ts.TypeNode,
  sf: ts.SourceFile,
  imports: Map<string, string>,
  depth: number,
): TypeNode {
  if (depth > DEPTH_BOUND) return { kind: "opaque" };

  if (ts.isParenthesizedTypeNode(node)) return structured(node.type, sf, imports, depth);
  if (ts.isTypeOperatorNode(node)) {
    return node.operator === ts.SyntaxKind.ReadonlyKeyword
      ? structured(node.type, sf, imports, depth)
      : { kind: "opaque" };
  }

  const primitive = PRIMITIVE_KEYWORDS[node.kind];
  if (primitive) return { kind: "primitive", primitive };
  if (node.kind === ts.SyntaxKind.AnyKeyword) return { kind: "opaque" };

  if (ts.isLiteralTypeNode(node)) {
    const lit = node.literal;
    if (lit.kind === ts.SyntaxKind.NullKeyword) return { kind: "primitive", primitive: "null" };
    if (ts.isStringLiteral(lit)) return { kind: "literal", value: lit.text };
    if (ts.isNumericLiteral(lit)) return { kind: "literal", value: Number(lit.text) };
    if (lit.kind === ts.SyntaxKind.TrueKeyword) return { kind: "literal", value: true };
    if (lit.kind === ts.SyntaxKind.FalseKeyword) return { kind: "literal", value: false };
    if (ts.isPrefixUnaryExpression(lit)) return { kind: "literal", value: Number(lit.getText(sf)) };
    return { kind: "opaque" };
  }

  if (ts.isUnionTypeNode(node)) {
    return { kind: "union", members: node.types.map((t) => structured(t, sf, imports, depth + 1)) };
  }
  if (ts.isArrayTypeNode(node)) {
    return { kind: "array", items: structured(node.elementType, sf, imports, depth + 1) };
  }
  if (ts.isFunctionTypeNode(node)) {
    return {
      kind: "function",
      parameters: node.parameters.map((p) =>
        p.type ? structured(p.type, sf, imports, depth + 1) : { kind: "opaque" },
      ),
      return: structured(node.type, sf, imports, depth + 1),
    };
  }
  if (ts.isTypeLiteralNode(node)) {
    const fields: NonNullable<TypeNode["fields"]> = [];
    for (const m of node.members) {
      if (!ts.isPropertySignature(m) || !m.name || !ts.isIdentifier(m.name) || !m.type) {
        return { kind: "opaque" };
      }
      fields.push(
        clean({
          name: m.name.text,
          type: structured(m.type, sf, imports, depth + 1),
          optional: m.questionToken ? true : undefined,
        }) as NonNullable<TypeNode["fields"]>[number],
      );
    }
    return { kind: "object", fields };
  }
  if (ts.isTypeReferenceNode(node)) {
    const name = node.typeName.getText(sf);
    const args = node.typeArguments;
    if ((name === "Array" || name === "ReadonlyArray") && args?.length === 1) {
      return { kind: "array", items: structured(args[0]!, sf, imports, depth + 1) };
    }
    if (name === "Record" && args?.length === 2) {
      return {
        kind: "record",
        key: structured(args[0]!, sf, imports, depth + 1),
        valueType: structured(args[1]!, sf, imports, depth + 1),
      };
    }
    const module = imports.get(rootName(node.typeName));
    return clean({ kind: "reference", name, module }) as TypeNode;
  }
  return { kind: "opaque" };
}

/** A throwaway source file used to parse a type written as text (JSDoc `{Type}`). */
function parseTypeText(text: string): ts.TypeNode | undefined {
  const sf = ts.createSourceFile(
    "__type__.ts",
    `type __T = ${text};`,
    ts.ScriptTarget.Latest,
    true,
  );
  const stmt = sf.statements[0];
  return stmt && ts.isTypeAliasDeclaration(stmt) ? stmt.type : undefined;
}

export function createTypeMapping(): TypeMapping {
  return {
    map(node, module) {
      if (!node) return undefined;
      const sf = module.ast;
      return { structured: structured(node, sf, importsOf(sf), 0), raw: node.getText(sf) };
    },
    mapText(text, module) {
      if (text === undefined) return undefined;
      const trimmed = text.trim();
      if (trimmed.length === 0) return undefined;
      const node = parseTypeText(trimmed);
      const parseSf = node?.getSourceFile();
      if (!node || !parseSf) return { structured: { kind: "opaque" }, raw: trimmed };
      return { structured: structured(node, parseSf, importsOf(module.ast), 0), raw: trimmed };
    },
  };
}
