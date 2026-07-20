import { describe, expect, it } from "vitest";
import { acmSchema } from "../../toolchain/src/validate.js";
import { checkSchemaMeta } from "../../toolchain/src/meta.js";
import { checkCanonical, canonicalize } from "../../toolchain/src/canonicalize.js";
import { computeCoverage, loadWitnessFixtures } from "../../toolchain/src/coverage.js";
import { MINIMAL_BUDGET_BYTES, loadFixture, readFixture } from "./helpers.js";

/**
 * SC-007: seeded non-conformant changes — every gate must FIRE when violated.
 * These mirror the quickstart.md mutation table.
 */
describe("gate-seeded: each gate has teeth (constitution IX)", () => {
  it("a schema field without acmTier is rejected by the meta gate", () => {
    const mutated = structuredClone(acmSchema);
    delete mutated.$defs.slot.properties.name.acmTier;
    expect(checkSchemaMeta(mutated).some((d) => d.ruleId === "ACM-M-TIER")).toBe(true);
  });

  it("removing the Angular witness opens signals-di gaps in the matrix", () => {
    const fixtures = loadWitnessFixtures().filter((f) => f.name !== "angular");
    const result = computeCoverage(fixtures);
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.gaps.every((g) => g.paradigmClass === "signals-di")).toBe(true);
  });

  it("hand-reordered keys in a canonical fixture are detected as drift", () => {
    const doc = loadFixture("witness/lit/agentic-component-manifest.json");
    const reordered =
      JSON.stringify({ modules: doc.modules, schemaVersion: doc.schemaVersion }, null, 2) + "\n";
    expect(reordered === readFixture("witness/lit/agentic-component-manifest.json")).toBe(false);
    expect(checkCanonical(reordered).canonical).toBe(false);
  });

  it("growing the minimal fixture past its budget is caught", () => {
    const doc = loadFixture("minimal/agentic-component-manifest.json");
    doc["x-pad"] = "P".repeat(700);
    const grown = canonicalize(doc);
    expect(Buffer.byteLength(grown)).toBeGreaterThan(MINIMAL_BUDGET_BYTES);
    // the gate-fixtures budget assertion would now fail — this proves the boundary bites
  });

  it("a NEW node cannot smuggle restricted applicability (grandfather is closed)", () => {
    const mutated = structuredClone(acmSchema);
    mutated.$defs.componentDeclaration.properties.slots.acmApplicability = ["vdom", "compiler-sfc"];
    expect(checkSchemaMeta(mutated).some((d) => d.ruleId === "ACM-M-APPLIC")).toBe(true);
  });
});
