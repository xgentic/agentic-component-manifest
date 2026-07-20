import { describe, expect, it } from "vitest";
import { canonicalize, checkCanonical } from "../../toolchain/src/canonicalize.js";
import { compileYaml } from "../../toolchain/src/compile.js";
import { VALID_FIXTURE_DIRS, loadFixture, readFixture } from "./helpers.js";

describe("gate-determinism: checked-in fixtures ARE canonical (NS-CANON-5)", () => {
  for (const dir of VALID_FIXTURE_DIRS) {
    it(`${dir}/agentic-component-manifest.json is byte-identical to its canonical form`, () => {
      expect(checkCanonical(readFixture(`${dir}/agentic-component-manifest.json`)).canonical).toBe(true);
    });
  }

  it("a hand-reordered document is flagged as drift", () => {
    const doc = loadFixture("minimal/agentic-component-manifest.json");
    const reordered = JSON.stringify(
      { modules: doc.modules, schemaVersion: doc.schemaVersion },
      null,
      2,
    );
    expect(checkCanonical(reordered).canonical).toBe(false);
  });
});

describe("gate-determinism: YAML authoring compiles byte-identically (NS-YAML, US2)", () => {
  for (const dir of ["minimal", "witness/react"]) {
    it(`${dir}/acm.src.yml → canonical JSON equals the checked-in fixture, twice`, () => {
      const src = readFixture(`${dir}/acm.src.yml`);
      const first = compileYaml(src);
      const second = compileYaml(src);
      expect(first.ok).toBe(true);
      expect(first.canonical).toBe(second.canonical);
      expect(first.canonical).toBe(readFixture(`${dir}/agentic-component-manifest.json`));
    });
  }

  it("YAML 1.2 core schema: unquoted `no` is a string (the Norway problem is dead)", () => {
    const result = compileYaml('schemaVersion: 0.1.0\nmodules: []\nx-note: no\n');
    expect(result.ok).toBe(true);
    expect(result.canonical).toContain('"x-note": "no"');
  });

  it("custom tags are a profile violation (NS-YAML-3)", () => {
    const result = compileYaml("schemaVersion: !!js/regexp foo\nmodules: []\n");
    expect(result.ok).toBe(false);
    expect(result.stage).toBe("profile");
    expect(result.diagnostics.some((d) => d.ruleId === "ACM-P-YAMLTAG")).toBe(true);
  });

  it("non-string keys are a profile violation (NS-YAML-2)", () => {
    const result = compileYaml("1: one\nschemaVersion: 0.1.0\nmodules: []\n");
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.ruleId === "ACM-P-KEY")).toBe(true);
  });
});

describe("gate-determinism: scalar rules (NS-CANON-3)", () => {
  it("numbers serialize per ECMAScript Number::toString", () => {
    const out = canonicalize({ "x-numbers": [1.0, 1e21, -0, 0.5, 42] });
    expect(out).toContain("1,");
    expect(out).toContain("1e+21");
    expect(out).not.toContain("-0");
    expect(out).toContain("0.5");
  });

  it("unknown keys sort after declared keys, lexicographically (NS-CANON-2)", () => {
    const out = canonicalize({ "x-zeta": 1, schemaVersion: "0.1.0", "x-alpha": 2, modules: [] });
    const positions = ["schemaVersion", "modules", "x-alpha", "x-zeta"].map((k) => out.indexOf(k));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
