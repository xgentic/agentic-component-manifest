import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { acmSchema, createAjv, META_SCHEMA_PATH, REPO_ROOT } from "../../toolchain/src/validate.js";
import { checkSchemaMeta } from "../../toolchain/src/meta.js";
import path from "node:path";

const metaSchema = JSON.parse(readFileSync(META_SCHEMA_PATH, "utf8"));

describe("gate-schema: the schema is valid and self-documenting (constitution I)", () => {
  it("compiles under JSON Schema draft 2020-12", () => {
    expect(() => createAjv().compile(structuredClone(acmSchema))).not.toThrow();
  });

  it("validates against the ACM meta-schema (top-level shape)", () => {
    const ajv = createAjv();
    const valid = ajv.validate(metaSchema, acmSchema);
    expect(ajv.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it("every specified field is typed, described, and provenance-tiered (meta walker)", () => {
    expect(checkSchemaMeta(acmSchema)).toEqual([]);
  });

  it("rejects a field with no provenance tier (seeded violation)", () => {
    const mutated = structuredClone(acmSchema);
    delete mutated.$defs.input.properties.name.acmTier;
    const diagnostics = checkSchemaMeta(mutated);
    expect(diagnostics.some((d) => d.ruleId === "ACM-M-TIER")).toBe(true);
  });

  it("rejects a field with no description (seeded violation)", () => {
    const mutated = structuredClone(acmSchema);
    delete mutated.$defs.event.properties.name.description;
    const diagnostics = checkSchemaMeta(mutated);
    expect(diagnostics.some((d) => d.ruleId === "ACM-M-DESC")).toBe(true);
  });

  it("rejects restricted applicability on a non-CEM-inherited node (constitution II)", () => {
    const mutated = structuredClone(acmSchema);
    mutated.$defs.componentDeclaration.properties.inputs.acmApplicability = ["vdom"];
    const diagnostics = checkSchemaMeta(mutated);
    expect(diagnostics.some((d) => d.ruleId === "ACM-M-APPLIC")).toBe(true);
  });

  it("semantic term enum is in sync with the pinned vocabulary", () => {
    const vocabulary = JSON.parse(
      readFileSync(path.join(REPO_ROOT, "packages/spec/data/vocabulary.json"), "utf8"),
    );
    expect(acmSchema.$defs.semanticClassification.properties.term.enum).toEqual(vocabulary.terms);
  });
});
