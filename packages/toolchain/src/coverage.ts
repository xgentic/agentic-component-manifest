import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { acmSchema, REPO_ROOT } from "./validate.js";

export const PARADIGM_CLASSES = ["retained-dom", "vdom", "compiler-sfc", "signals-di"] as const;
export type ParadigmClass = (typeof PARADIGM_CLASSES)[number];

export interface CoverageGap {
  node: string;
  paradigmClass: string;
}

export interface CoverageResult {
  /** matrix[node][class] = "witnessed" | "missing" | "n/a" (annotated inapplicable) */
  matrix: Record<string, Record<string, string>>;
  gaps: CoverageGap[];
}

/**
 * Constitution II coverage matrix. Tracked nodes are the structural nodes of a
 * component declaration (collections and composite nodes), read from the schema so the
 * tracked set and the applicability annotations share one source of truth.
 */
export function computeCoverage(fixtures: Array<{ name: string; doc: any }>): CoverageResult {
  const declProps: Record<string, any> = acmSchema.$defs.componentDeclaration.properties;
  const tracked = Object.keys(declProps).filter((k) => k !== "name");

  const witnessed: Record<string, Set<string>> = {};
  for (const fixture of fixtures) {
    const modules = Array.isArray(fixture.doc?.modules) ? fixture.doc.modules : [];
    for (const mod of modules) {
      for (const decl of Array.isArray(mod?.declarations) ? mod.declarations : []) {
        const cls = decl?.identity?.paradigmClass;
        if (typeof cls !== "string") continue;
        const set = (witnessed[cls] ??= new Set());
        for (const [key, value] of Object.entries(decl)) {
          if (nonEmpty(value)) set.add(key);
        }
      }
    }
  }

  const matrix: CoverageResult["matrix"] = {};
  const gaps: CoverageGap[] = [];
  for (const node of tracked) {
    const applicability: string[] = declProps[node].acmApplicability ?? [...PARADIGM_CLASSES];
    matrix[node] = {};
    for (const cls of PARADIGM_CLASSES) {
      if (!applicability.includes(cls)) {
        matrix[node][cls] = "n/a";
        continue;
      }
      const hit = witnessed[cls]?.has(node) ?? false;
      matrix[node][cls] = hit ? "witnessed" : "missing";
      if (!hit) gaps.push({ node, paradigmClass: cls });
    }
  }
  return { matrix, gaps };
}

function nonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

export function loadWitnessFixtures(): Array<{ name: string; doc: any }> {
  const witnessDir = path.join(REPO_ROOT, "packages/conformance/fixtures/witness");
  return readdirSync(witnessDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({
      name: e.name,
      doc: JSON.parse(readFileSync(path.join(witnessDir, e.name, "agentic-component-manifest.json"), "utf8")),
    }));
}

export function renderMatrix(result: CoverageResult): string {
  const nodes = Object.keys(result.matrix);
  const header = ["node", ...PARADIGM_CLASSES].join(" | ");
  const sep = ["---", ...PARADIGM_CLASSES.map(() => "---")].join(" | ");
  const rows = nodes.map((n) =>
    [n, ...PARADIGM_CLASSES.map((c) => result.matrix[n]![c] ?? "?")].join(" | "),
  );
  return [header, sep, ...rows].join("\n");
}
