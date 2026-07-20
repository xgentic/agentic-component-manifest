import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AjvModule from "ajv/dist/2020.js";
import type { Diagnostic } from "./diagnostics.js";

const Ajv2020 = (AjvModule as any).default ?? AjvModule;

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../../..");
export const SCHEMA_PATH = path.join(REPO_ROOT, "packages/spec/schema/acm.schema.json");
export const META_SCHEMA_PATH = path.join(REPO_ROOT, "packages/spec/schema/acm.meta.schema.json");

export const acmSchema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

export const MAX_DEPTH = 32;
export const ACM_VOCABULARY = ["acmTier", "acmApplicability", "acmCemInherited"];

export function createAjv() {
  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
  ajv.addVocabulary(ACM_VOCABULARY);
  return ajv;
}

let compiled: ((doc: unknown) => boolean) & { errors?: any[] | null };
function getValidator() {
  if (!compiled) compiled = createAjv().compile(acmSchema) as typeof compiled;
  return compiled;
}

function ruleForKeyword(keyword: string): string {
  if (keyword === "maxLength") return "ACM-X-MAXLEN";
  if (keyword === "maxItems" || keyword === "maxProperties") return "ACM-X-MAXITEMS";
  return "ACM-V-SCHEMA";
}

/** Iterative depth measurement — hostile inputs must be bounded before deep processing. */
function measureDepth(root: unknown): number {
  let max = 0;
  const stack: Array<[unknown, number]> = [[root, 1]];
  while (stack.length > 0) {
    const [node, depth] = stack.pop()!;
    if (node !== null && typeof node === "object") {
      if (depth > max) max = depth;
      if (depth > MAX_DEPTH + 1) return depth;
      const values = Array.isArray(node) ? node : Object.values(node);
      for (const v of values) stack.push([v, depth + 1]);
    }
  }
  return max;
}

function checkExports(doc: any): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const modules = Array.isArray(doc?.modules) ? doc.modules : [];
  modules.forEach((mod: any, mi: number) => {
    const names = new Set(
      (Array.isArray(mod?.declarations) ? mod.declarations : []).map((d: any) => d?.name),
    );
    (Array.isArray(mod?.exports) ? mod.exports : []).forEach((exp: any, ei: number) => {
      if (typeof exp?.declaration === "string" && !names.has(exp.declaration)) {
        diagnostics.push({
          ruleId: "ACM-V-EXPORT",
          pointer: `/modules/${mi}/exports/${ei}/declaration`,
          message: `export "${exp.name}" references unknown declaration "${exp.declaration}" (NS-VALID-1)`,
        });
      }
    });
  });
  return diagnostics;
}

const MEMBER_COLLECTIONS = ["inputs", "events", "slots", "methods", "cssProperties", "cssParts"];

function checkDuplicates(doc: any): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const modulePaths = new Set<string>();
  const modules = Array.isArray(doc?.modules) ? doc.modules : [];
  modules.forEach((mod: any, mi: number) => {
    if (typeof mod?.path === "string") {
      if (modulePaths.has(mod.path)) {
        diagnostics.push({
          ruleId: "ACM-V-DUP",
          pointer: `/modules/${mi}/path`,
          message: `duplicate module path "${mod.path}" (NS-VALID-2)`,
        });
      }
      modulePaths.add(mod.path);
    }
    const declNames = new Set<string>();
    (Array.isArray(mod?.declarations) ? mod.declarations : []).forEach((decl: any, di: number) => {
      if (typeof decl?.name === "string") {
        if (declNames.has(decl.name)) {
          diagnostics.push({
            ruleId: "ACM-V-DUP",
            pointer: `/modules/${mi}/declarations/${di}/name`,
            message: `duplicate declaration name "${decl.name}" (NS-VALID-2)`,
          });
        }
        declNames.add(decl.name);
      }
      for (const coll of MEMBER_COLLECTIONS) {
        const items = decl?.[coll];
        if (!Array.isArray(items)) continue;
        const seen = new Set<string>();
        items.forEach((item: any, ii: number) => {
          // an unnamed slot is the default slot; two unnamed slots are duplicates
          const key = typeof item?.name === "string" ? item.name : "";
          if (seen.has(key)) {
            diagnostics.push({
              ruleId: "ACM-V-DUP",
              pointer: `/modules/${mi}/declarations/${di}/${coll}/${ii}`,
              message: `duplicate ${coll} name "${key || "(default)"}" (NS-VALID-2)`,
            });
          }
          seen.add(key);
        });
      }
    });
  });
  return diagnostics;
}

export function validateManifest(doc: unknown): { valid: boolean; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const depth = measureDepth(doc);
  if (depth > MAX_DEPTH) {
    diagnostics.push({
      ruleId: "ACM-V-DEPTH",
      pointer: "",
      message: `nesting depth ${depth} exceeds limit ${MAX_DEPTH} (NS-LIMIT-2)`,
    });
    return { valid: false, diagnostics };
  }
  const validate = getValidator();
  if (!validate(doc)) {
    for (const err of validate.errors ?? []) {
      diagnostics.push({
        ruleId: ruleForKeyword(err.keyword),
        pointer: err.instancePath ?? "",
        message: `${err.message}${err.keyword === "enum" ? ` (${JSON.stringify(err.params?.allowedValues?.slice(0, 5))}…)` : ""}`,
      });
    }
  }
  diagnostics.push(...checkExports(doc), ...checkDuplicates(doc));
  return { valid: diagnostics.length === 0, diagnostics };
}
