import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { compile as jsonSchemaToTs } from "json-schema-to-typescript";
import { acmSchema, REPO_ROOT } from "./validate.js";
import { buildSkillFiles } from "./agent-docs.js";

const GENERATED_DIR = path.join(REPO_ROOT, "packages/spec/generated");
const TYPES_PATH = path.join(GENERATED_DIR, "types.ts");
const REFERENCE_PATH = path.join(GENERATED_DIR, "reference.md");

const BANNER =
  "/* Generated from packages/spec/schema/acm.schema.json — do not edit by hand.\n" +
  " * Regenerate with `pnpm generate`; staleness fails CI (gate-drift). */";

export async function generateTypes(): Promise<string> {
  return jsonSchemaToTs(structuredClone(acmSchema), "AcmManifest", {
    bannerComment: BANNER,
    additionalProperties: false,
  });
}

function typeSummary(def: any): string {
  if (def.$ref) return String(def.$ref).replace("#/$defs/", "→ ");
  if (def.enum) return `enum(${def.enum.length})`;
  if (Array.isArray(def.type)) return def.type.join("|");
  if (def.type === "array") {
    const items = def.items ?? {};
    return `array<${items.$ref ? String(items.$ref).replace("#/$defs/", "") : (items.type ?? "object")}>`;
  }
  return def.type ?? "object";
}

export function generateReference(): string {
  const lines: string[] = [
    "# ACM Field Reference",
    "",
    "Generated from `acm.schema.json` — do not edit by hand. Regenerate with `pnpm generate`.",
    "",
  ];
  const sections: Array<[string, any]> = [["(document root)", acmSchema]];
  for (const [name, def] of Object.entries<any>(acmSchema.$defs ?? {})) sections.push([name, def]);
  for (const [name, def] of sections) {
    if (!def.properties) continue;
    lines.push(`## ${name}`, "");
    if (def.description) lines.push(def.description, "");
    lines.push("| Field | Type | Tier | Description |", "| --- | --- | --- | --- |");
    for (const [field, fdef] of Object.entries<any>(def.properties)) {
      const flags = [
        fdef.acmCemInherited ? "CEM-inherited" : "",
        fdef.acmApplicability ? `applies: ${fdef.acmApplicability.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("; ");
      const description = `${fdef.description ?? ""}${flags ? ` *(${flags})*` : ""}`;
      lines.push(
        `| \`${field}\` | ${typeSummary(fdef)} | ${fdef.acmTier ?? ""} | ${description.replaceAll("|", "\\|")} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

export interface DriftReport {
  stale: string[];
}

export async function checkDrift(write: boolean): Promise<DriftReport> {
  const expected: Array<[string, string]> = [
    [TYPES_PATH, await generateTypes()],
    [REFERENCE_PATH, generateReference()],
    // Steering-layer artifacts (ADR 0004): the Discovery Skill's generated
    // blocks and per-ecosystem targets, projected from the capability manifest.
    ...buildSkillFiles().files.map(([rel, content]): [string, string] => [
      path.join(REPO_ROOT, rel),
      content,
    ]),
  ];
  const stale: string[] = [];
  for (const [file, content] of expected) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current !== content) {
      stale.push(path.relative(REPO_ROOT, file));
      if (write) {
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, content);
      }
    }
  }
  return { stale };
}
