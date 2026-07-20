import type { Diagnostic } from "./diagnostics.js";
import { checkCanonical, serializeNumber } from "./canonicalize.js";

/**
 * NS-VIEW-2 emitter: block style, 2-space indent, plain scalars only where YAML 1.2
 * core round-trips them losslessly (else double-quoted with JSON escaping), no anchors,
 * no flow collections except empty {} / [], key order inherited from canonical JSON.
 */

const RESERVED = new Set(["true", "false", "null", "yes", "no", "on", "off", "y", "n", "~"]);

function isPlainScalar(s: string): boolean {
  if (s.length === 0) return false;
  if (RESERVED.has(s.toLowerCase())) return false;
  if (!/^[A-Za-z_][A-Za-z0-9_@./ -]*$/.test(s)) return false;
  if (s !== s.trim()) return false;
  return true;
}

function scalar(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return serializeNumber(v);
  if (typeof v === "string") return isPlainScalar(v) ? v : JSON.stringify(v);
  throw new Error("not a scalar");
}

function isScalarValue(v: unknown): boolean {
  return v === null || typeof v !== "object";
}

function emitBlock(v: unknown, indent: number): string[] {
  const pad = "  ".repeat(indent);
  const lines: string[] = [];
  if (Array.isArray(v)) {
    for (const item of v) {
      if (isScalarValue(item)) {
        lines.push(`${pad}- ${scalar(item)}`);
      } else if (Array.isArray(item) ? item.length === 0 : Object.keys(item as object).length === 0) {
        lines.push(`${pad}- ${Array.isArray(item) ? "[]" : "{}"}`);
      } else {
        const child = emitBlock(item, indent + 1);
        lines.push(`${pad}- ${child[0]!.trimStart()}`, ...child.slice(1));
      }
    }
    return lines;
  }
  const obj = v as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    const k = isPlainScalar(key) ? key : JSON.stringify(key);
    if (isScalarValue(value)) {
      lines.push(`${pad}${k}: ${scalar(value)}`);
    } else if (
      Array.isArray(value) ? value.length === 0 : Object.keys(value as object).length === 0
    ) {
      lines.push(`${pad}${k}: ${Array.isArray(value) ? "[]" : "{}"}`);
    } else {
      lines.push(`${pad}${k}:`, ...emitBlock(value, indent + 1));
    }
  }
  return lines;
}

export function agentViewFromValue(value: unknown): string {
  return emitBlock(value, 0).join("\n") + "\n";
}

export function agentViewFromText(
  canonicalText: string,
): { ok: boolean; view?: string; diagnostics: Diagnostic[] } {
  const { canonical } = checkCanonical(canonicalText);
  if (!canonical) {
    return {
      ok: false,
      diagnostics: [
        {
          ruleId: "ACM-C-DRIFT",
          pointer: "",
          message: "input is not ACM Canonical JSON; the Agent View projects canonical form only (NS-VIEW-1)",
        },
      ],
    };
  }
  return { ok: true, view: agentViewFromValue(JSON.parse(canonicalText)), diagnostics: [] };
}
