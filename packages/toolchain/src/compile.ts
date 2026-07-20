import { parseDocument, isMap, isPair, isScalar, isSeq } from "yaml";
import type { Diagnostic } from "./diagnostics.js";
import { canonicalize } from "./canonicalize.js";
import { validateManifest } from "./validate.js";

export interface CompileResult {
  ok: boolean;
  /** "profile" = authoring-profile violation (exit 2), "validate" = invalid manifest (exit 1). */
  stage: "profile" | "validate" | "ok";
  canonical?: string;
  diagnostics: Diagnostic[];
}

/** NS-YAML-1..4: YAML 1.2 core schema, string keys, no custom tags → canonical JSON. */
export function compileYaml(source: string): CompileResult {
  const diagnostics: Diagnostic[] = [];
  const doc = parseDocument(source, { version: "1.2", schema: "core", uniqueKeys: true });
  // the yaml library reports unresolved (custom) tags as warnings — those are
  // authoring-profile violations for us (NS-YAML-3), not tolerable sloppiness
  for (const err of [...doc.errors, ...doc.warnings]) {
    const isTag = err.code === "TAG_RESOLVE_FAILED" || /tag/i.test(err.message);
    diagnostics.push({
      ruleId: isTag ? "ACM-P-YAMLTAG" : "ACM-P-YAML",
      pointer: "",
      message: err.message.split("\n")[0] ?? err.message,
    });
  }
  walkKeys(doc.contents);
  if (diagnostics.length > 0) return { ok: false, stage: "profile", diagnostics };

  const value = doc.toJS({ mapAsMap: false });
  const result = validateManifest(value);
  if (!result.valid) return { ok: false, stage: "validate", diagnostics: result.diagnostics };
  return { ok: true, stage: "ok", canonical: canonicalize(value), diagnostics: [] };

  function walkKeys(node: unknown): void {
    if (isMap(node)) {
      for (const item of node.items) {
        if (isPair(item)) {
          if (!isScalar(item.key) || typeof item.key.value !== "string") {
            diagnostics.push({
              ruleId: "ACM-P-KEY",
              pointer: "",
              message: "mapping keys must be strings (NS-YAML-2)",
            });
          }
          walkKeys(item.value);
        }
      }
    } else if (isSeq(node)) {
      for (const item of node.items) walkKeys(item);
    }
  }
}
