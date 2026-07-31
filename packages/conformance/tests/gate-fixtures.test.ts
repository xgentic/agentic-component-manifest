import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { validateManifest } from "../../toolchain/src/validate.js";
import { canonicalize } from "../../toolchain/src/canonicalize.js";
import { resolveManifestPath } from "../../toolchain/src/discovery.js";
import {
  FIXTURES,
  MINIMAL_BUDGET_BYTES,
  VALID_FIXTURE_DIRS,
  loadFixture,
  readFixture,
} from "./helpers.js";

describe("gate-fixtures: the corpus validates (US1)", () => {
  for (const dir of VALID_FIXTURE_DIRS) {
    it(`${dir} is a valid manifest`, () => {
      const result = validateManifest(loadFixture(`${dir}/agentic-component-manifest.json`));
      expect(result.diagnostics).toEqual([]);
      expect(result.valid).toBe(true);
    });
  }

  it("the minimal fixture stays within its byte budget (constitution III)", () => {
    expect(
      Buffer.byteLength(readFixture("minimal/agentic-component-manifest.json")),
    ).toBeLessThanOrEqual(MINIMAL_BUDGET_BYTES);
  });
});

describe("gate-fixtures: mutations are rejected with the right rule (US1)", () => {
  const base = () => loadFixture("witness/react/agentic-component-manifest.json");

  it("wrong value type", () => {
    const doc = base();
    doc.modules[0].declarations[0].inputs[0].default = 5;
    const r = validateManifest(doc);
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.ruleId === "ACM-V-SCHEMA")).toBe(true);
  });

  it("missing identity", () => {
    const doc = base();
    delete doc.modules[0].declarations[0].identity;
    const r = validateManifest(doc);
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.ruleId === "ACM-V-SCHEMA")).toBe(true);
  });

  it("semantic term outside the controlled vocabulary", () => {
    const doc = base();
    doc.modules[0].declarations[0].semantics.term = "sparkle-widget";
    const r = validateManifest(doc);
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.ruleId === "ACM-V-SCHEMA")).toBe(true);
  });

  it("missing schemaVersion self-declaration (NS-DISC-5)", () => {
    const doc = base();
    delete doc.schemaVersion;
    const r = validateManifest(doc);
    expect(r.valid).toBe(false);
  });

  it("oversized description (NS-LIMIT-1)", () => {
    const doc = base();
    doc.modules[0].declarations[0].description = "A".repeat(9000);
    const r = validateManifest(doc);
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.ruleId === "ACM-X-MAXLEN")).toBe(true);
  });

  it("duplicate member names (NS-VALID-2)", () => {
    const doc = base();
    doc.modules[0].declarations[0].inputs.push(doc.modules[0].declarations[0].inputs[0]);
    const r = validateManifest(doc);
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.ruleId === "ACM-V-DUP")).toBe(true);
  });

  it("unresolved export (NS-VALID-1)", () => {
    const doc = base();
    doc.modules[0].exports[0].declaration = "Ghost";
    const r = validateManifest(doc);
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.ruleId === "ACM-V-EXPORT")).toBe(true);
  });
});

describe("gate-fixtures: hostile fixtures (constitution X)", () => {
  it("over-limit rejected with the limit rule", () => {
    const r = validateManifest(loadFixture("hostile/over-limit.json"));
    expect(r.valid).toBe(false);
    expect(r.diagnostics.some((d) => d.ruleId === "ACM-X-MAXLEN")).toBe(true);
  });

  it("deep-nesting rejected before deep processing", () => {
    const r = validateManifest(loadFixture("hostile/deep-nesting.json"));
    expect(r.valid).toBe(false);
    expect(r.diagnostics[0]?.ruleId).toBe("ACM-V-DEPTH");
  });

  it("injection text is structurally VALID — hostility is a consumer concern, not a shape error", () => {
    const r = validateManifest(loadFixture("hostile/injection.json"));
    expect(r.valid).toBe(true);
  });
});

describe("gate-fixtures: extension preservation and must-ignore (NS-IGNORE-1)", () => {
  it("x-* content survives validation and canonicalization opaquely", () => {
    const doc = loadFixture("adversarial/form-associated/agentic-component-manifest.json");
    expect(validateManifest(doc).valid).toBe(true);
    expect(canonicalize(doc)).toContain('"x-wc"');
    expect(canonicalize(doc)).toContain('"formAssociated": true');
  });

  it("consumers pass unknown fields through untouched (must-ignore)", () => {
    const doc = loadFixture("minimal/agentic-component-manifest.json");
    doc.futureField = { added: "in a later minor version" };
    const out = canonicalize(doc);
    expect(out).toContain('"futureField"');
  });
});

describe("gate-fixtures: examples compile (Tier 2, constitution IV)", () => {
  for (const dir of VALID_FIXTURE_DIRS) {
    const doc = loadFixture(`${dir}/agentic-component-manifest.json`);
    for (const mod of doc.modules) {
      for (const decl of mod.declarations ?? []) {
        for (const [i, example] of (decl.examples ?? []).entries()) {
          it(`${dir} example #${i} (${example.lang}) transpiles`, () => {
            const result = ts.transpileModule(example.source, {
              reportDiagnostics: true,
              compilerOptions: {
                jsx: ts.JsxEmit.React,
                target: ts.ScriptTarget.ES2022,
                experimentalDecorators: true,
              },
            });
            expect(result.diagnostics ?? []).toEqual([]);
          });
        }
      }
    }
  }
});

describe("gate-fixtures: discovery convention (NS-DISC)", () => {
  it("resolves the acm field first", () => {
    const r = resolveManifestPath(path.join(FIXTURES, "discovery/field-pkg"));
    expect(r.error).toBeUndefined();
    expect(r.path?.endsWith(path.join("manifest", "agentic-component-manifest.json"))).toBe(true);
    expect(
      validateManifest(
        JSON.parse(readFixture("discovery/field-pkg/manifest/agentic-component-manifest.json")),
      ).valid,
    ).toBe(true);
  });

  it("falls back to the conventional filename", () => {
    const r = resolveManifestPath(path.join(FIXTURES, "discovery/filename-pkg"));
    expect(r.path?.endsWith("agentic-component-manifest.json")).toBe(true);
  });

  it("an advertised-but-missing manifest is a clean error", () => {
    const r = resolveManifestPath(path.join(FIXTURES, "discovery/broken-pkg"));
    expect(r.path).toBeUndefined();
    expect(r.error).toContain("NS-DISC-4");
  });

  it("no manifest at all is a clean error", () => {
    const r = resolveManifestPath(FIXTURES);
    expect(r.error).toBeDefined();
  });
});
