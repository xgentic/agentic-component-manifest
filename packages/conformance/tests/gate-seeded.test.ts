import { describe, expect, it } from "vitest";
import { acmSchema } from "../../toolchain/src/validate.js";
import { checkSchemaMeta } from "../../toolchain/src/meta.js";
import { checkCanonical, canonicalize } from "../../toolchain/src/canonicalize.js";
import { computeCoverage, loadWitnessFixtures } from "../../toolchain/src/coverage.js";
import { REGISTRY } from "../../toolchain/src/registry.js";
import { checkRegistryCompleteness } from "../../toolchain/src/capability.js";
import { readAuthoredBlocks, sweepAuthoredReferences } from "../../toolchain/src/agent-docs.js";
import { sanitize } from "../../toolchain/src/render.js";
import { search } from "../../toolchain/src/api.js";
import {
  DISCOVERY_CORPUS,
  MINIMAL_BUDGET_BYTES,
  loadFixture,
  readFixture,
  runAcm,
} from "./helpers.js";

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

  // Discovery seeded proofs (spec 004 T027, constitution IX).

  it("a registry entry with a blanked description fails the capability drift gate", () => {
    const mutated = structuredClone(REGISTRY);
    mutated.find((c) => c.name === "search")!.description = "";
    expect(checkRegistryCompleteness(REGISTRY)).toEqual([]);
    expect(checkRegistryCompleteness(mutated)).toContain("search: empty description");
  });

  it("an undescribed command fails the capability drift gate", () => {
    const mutated = structuredClone(REGISTRY);
    mutated.push({
      name: "swizzle",
      description: "",
      arguments: [],
      options: [],
      jsonSupported: true,
      responseTypes: [],
      examples: [],
    });
    const problems = checkRegistryCompleteness(mutated);
    expect(problems).toContain("swizzle: empty description");
    expect(problems).toContain("swizzle: no examples");
    expect(problems).toContain("swizzle: jsonSupported but no responseTypes");
  });

  it("bypassing the sanitizer would leak control bytes — the inertness gate bites", () => {
    const hostile = loadFixture(
      "discovery-corpus/node_modules/hostile-pkg/agentic-component-manifest.json",
    );
    const raw: string = hostile.modules[0].declarations[0].description;
    const controls = new RegExp("[" + "\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F" + "]");
    expect(raw).toMatch(controls); // the seed: unsanitized text violates the assertion
    expect(sanitize(raw)).not.toMatch(controls); // the sanitizer is load-bearing
  });

  it("a fabricated reference in an authored block fails the skill sweep (spec 005 SC-003)", () => {
    const blocks = readAuthoredBlocks();
    expect(sweepAuthoredReferences(blocks)).toEqual([]); // the gate's clean state…
    const seeded = {
      ...blocks,
      workflow: blocks.workflow + "\nPrefer `--fuzz`; run acm swizzle on ACM-D-TELEPORT.",
    };
    const problems = sweepAuthoredReferences(seeded);
    expect(problems.some((p) => p.includes('"--fuzz"'))).toBe(true);
    expect(problems.some((p) => p.includes('"acm swizzle"'))).toBe(true);
    expect(problems.some((p) => p.includes('"ACM-D-TELEPORT"'))).toBe(true);
  });

  it("an envelope mutated after the API returns is caught by the parity gate", async () => {
    const api = await search("button", { project: DISCOVERY_CORPUS, limit: 2 });
    const cli = JSON.parse(
      runAcm(["search", "button", "--project", DISCOVERY_CORPUS, "--limit", "2", "--json"]).stdout,
    );
    expect(cli).toEqual(api); // the gate's assertion…
    const mutated = structuredClone(api);
    mutated.data.total += 1; // …and the seed that must break it
    expect(cli).not.toEqual(mutated);
  });
});
