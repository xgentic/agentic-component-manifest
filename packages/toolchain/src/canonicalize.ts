import { acmSchema } from "./validate.js";

/**
 * NS-CANON-2: canonical key order = schema declaration order (first occurrence of a
 * property name across the schema's `properties` maps, walked in document order).
 * Unknown and x-* keys sort after all declared keys, lexicographically.
 */
function buildKeyOrder(schema: unknown): Map<string, number> {
  const order = new Map<string, number>();
  walk(schema);
  return order;

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const props = obj["properties"];
    if (props !== null && typeof props === "object" && !Array.isArray(props)) {
      for (const key of Object.keys(props as Record<string, unknown>)) {
        if (!order.has(key)) order.set(key, order.size);
      }
    }
    for (const v of Object.values(obj)) walk(v);
  }
}

const KEY_ORDER = buildKeyOrder(acmSchema);

/** NS-CANON-3: ECMAScript Number::toString is RFC 8785 §3.2.2.3's algorithm. */
export function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) throw new Error("non-finite numbers are illegal in canonical JSON");
  if (Object.is(n, -0)) return "0";
  return String(n);
}

function orderKeys(keys: string[]): string[] {
  const known = keys
    .filter((k) => KEY_ORDER.has(k))
    .sort((a, b) => KEY_ORDER.get(a)! - KEY_ORDER.get(b)!);
  const unknown = keys.filter((k) => !KEY_ORDER.has(k)).sort();
  return [...known, ...unknown];
}

function emit(v: unknown, indent: number): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return serializeNumber(v);
  if (typeof v !== "object") throw new Error(`unsupported value type: ${typeof v}`);
  const pad = "  ".repeat(indent + 1);
  const close = "  ".repeat(indent);
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    return "[\n" + v.map((item) => pad + emit(item, indent + 1)).join(",\n") + "\n" + close + "]";
  }
  const obj = v as Record<string, unknown>;
  const keys = orderKeys(Object.keys(obj));
  if (keys.length === 0) return "{}";
  return (
    "{\n" +
    keys.map((k) => `${pad}${JSON.stringify(k)}: ${emit(obj[k], indent + 1)}`).join(",\n") +
    "\n" +
    close +
    "}"
  );
}

/** Emit ACM Canonical JSON (NS-CANON-1..4) with a single trailing newline. */
export function canonicalize(value: unknown): string {
  return emit(value, 0) + "\n";
}

export function checkCanonical(text: string): { canonical: boolean; expected: string } {
  const expected = canonicalize(JSON.parse(text));
  return { canonical: expected === text, expected };
}
