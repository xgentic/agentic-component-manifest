import type { Diagnostic } from "./diagnostics.js";

const TIERS = new Set(["derived", "authored-verifiable"]);

/**
 * Exhaustive meta check on the ACM schema itself (constitution I & II):
 * every specified field must carry a type, a non-empty description, and a provenance
 * tier; restricted applicability is legal only on CEM-inherited nodes.
 */
export function checkSchemaMeta(schema: unknown): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  walk(schema, "");
  return diagnostics;

  function walk(node: unknown, pointer: string): void {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${pointer}/${i}`));
      return;
    }
    if (node === null || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const props = obj["properties"];
    if (props !== null && typeof props === "object" && !Array.isArray(props)) {
      for (const [key, def] of Object.entries(props as Record<string, unknown>)) {
        const p = `${pointer}/properties/${key}`;
        if (def === null || typeof def !== "object" || Array.isArray(def)) {
          diagnostics.push({
            ruleId: "ACM-M-TYPE",
            pointer: p,
            message: "field definition must be an object schema",
          });
          continue;
        }
        const d = def as Record<string, unknown>;
        if (typeof d["description"] !== "string" || d["description"].length === 0) {
          diagnostics.push({
            ruleId: "ACM-M-DESC",
            pointer: p,
            message: "specified field lacks a non-empty description",
          });
        }
        if (!TIERS.has(d["acmTier"] as string)) {
          diagnostics.push({
            ruleId: "ACM-M-TIER",
            pointer: p,
            message: "specified field lacks a provenance tier (acmTier)",
          });
        }
        if (!("type" in d) && !("$ref" in d) && !("enum" in d) && !("const" in d)) {
          diagnostics.push({
            ruleId: "ACM-M-TYPE",
            pointer: p,
            message: "specified field lacks a type (type/$ref/enum/const)",
          });
        }
        if ("acmApplicability" in d && d["acmCemInherited"] !== true) {
          diagnostics.push({
            ruleId: "ACM-M-APPLIC",
            pointer: p,
            message: "restricted applicability on a non-CEM-inherited node (constitution II)",
          });
        }
      }
    }
    for (const [k, v] of Object.entries(obj)) walk(v, `${pointer}/${k}`);
  }
}
