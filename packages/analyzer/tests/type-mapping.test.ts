import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createTypeMapping } from "../src/type-mapping.js";
import type { ModuleContext } from "../src/plugin.js";

/** Parse a `type __T = <expr>` and return the type node + a minimal module context. */
function typeOf(expr: string, imports = ""): { node: ts.TypeNode; module: ModuleContext } {
  const text = `${imports}\ntype __T = ${expr};`;
  const ast = ts.createSourceFile("m.ts", text, ts.ScriptTarget.Latest, true);
  const alias = ast.statements.find(ts.isTypeAliasDeclaration)!;
  const module: ModuleContext = {
    path: "m.ts",
    text,
    ast,
    container: "ts",
    entries: [],
    remap: (o) => o,
  };
  return { node: alias.type, module };
}

const types = createTypeMapping();
const map = (expr: string, imports?: string) => {
  const { node, module } = typeOf(expr, imports);
  return types.map(node, module)!;
};

describe("type-mapping: documented rules (docs/type-mapping.md)", () => {
  it("primitives and null map to primitive nodes", () => {
    expect(map("string").structured).toEqual({ kind: "primitive", primitive: "string" });
    expect(map("void").structured).toEqual({ kind: "primitive", primitive: "void" });
    expect(map("null").structured).toEqual({ kind: "primitive", primitive: "null" });
  });

  it("array, Array<T>, and Record<K,V> map structurally", () => {
    expect(map("string[]").structured).toEqual({
      kind: "array",
      items: { kind: "primitive", primitive: "string" },
    });
    expect(map("Array<number>").structured.kind).toBe("array");
    expect(map("Record<string, number>").structured).toEqual({
      kind: "record",
      key: { kind: "primitive", primitive: "string" },
      valueType: { kind: "primitive", primitive: "number" },
    });
  });

  it("object type literals map to fields with optional flags", () => {
    const s = map("{ a: string; b?: number }").structured;
    expect(s.kind).toBe("object");
    expect(s.fields).toEqual([
      { name: "a", type: { kind: "primitive", primitive: "string" } },
      { name: "b", type: { kind: "primitive", primitive: "number" }, optional: true },
    ]);
  });

  it("intersection and tuple take the opaque fallback (no node in the grammar)", () => {
    expect(map("A & B").structured).toEqual({ kind: "opaque" });
    expect(map("[string, number]").structured).toEqual({ kind: "opaque" });
    expect(map("A & B").raw).toBe("A & B");
  });

  it("references resolve module from the file's imports; ambient types carry none", () => {
    expect(map("Foo", "import { Foo } from '@x/foo';").structured).toEqual({
      kind: "reference",
      name: "Foo",
      module: "@x/foo",
    });
    expect(map("FocusOptions").structured).toEqual({ kind: "reference", name: "FocusOptions" });
  });

  it("nesting past the depth bound becomes opaque, but raw stays whole", () => {
    const deep = "{ a: { b: { c: { d: { e: string } } } } }";
    const result = map(deep);
    expect(result.raw).toBe(deep);
    // The 5th level (past bound 4) is opaque within an otherwise-structured tree.
    expect(JSON.stringify(result.structured)).toContain('"opaque"');
  });

  it("raw is always the verbatim source slice; mapping is total", () => {
    expect(map("'a' | 'b'").raw).toBe("'a' | 'b'");
    expect(map("keyof Foo").structured).toEqual({ kind: "opaque" });
  });
});
