import { encode } from "gpt-tokenizer/encoding/o200k_base";
import { describe, expect, it } from "vitest";
import { agentViewFromText } from "../../toolchain/src/agent-view.js";
import { VALID_FIXTURE_DIRS, loadFixture, readFixture } from "./helpers.js";

// The published manifest (`agentic-component-manifest.json`) and its Agent View
// (`acm.view.yml`) are a golden pair but do not share a filename stem, so carry
// both paths explicitly. The hostile fixture keeps its own `injection.*` stem.
const GOLDENED = [
  ...VALID_FIXTURE_DIRS.map((d) => ({
    json: `${d}/agentic-component-manifest.json`,
    view: `${d}/acm.view.yml`,
  })),
  { json: "hostile/injection.json", view: "hostile/injection.view.yml" },
];

describe("gate-agent-view: golden pairs freeze the emitter (NS-VIEW-3, US3)", () => {
  for (const g of GOLDENED) {
    it(`${g.view} matches the emitter byte-for-byte, twice`, () => {
      const text = readFixture(g.json);
      const first = agentViewFromText(text);
      const second = agentViewFromText(text);
      expect(first.ok).toBe(true);
      expect(first.view).toBe(second.view);
      expect(first.view).toBe(readFixture(g.view));
    });
  }

  it("refuses non-canonical input (NS-VIEW-1)", () => {
    const minified = JSON.stringify(loadFixture("minimal/agentic-component-manifest.json"));
    const result = agentViewFromText(minified);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.ruleId).toBe("ACM-C-DRIFT");
  });
});

describe("gate-agent-view: token economy (SC-005)", () => {
  for (const g of GOLDENED) {
    it(`${g.view}: view is ≥15% cheaper in tokens than formatted JSON`, () => {
      const json = readFixture(g.json);
      const view = readFixture(g.view);
      const jsonTokens = encode(json).length;
      const viewTokens = encode(view).length;
      expect(viewTokens).toBeLessThanOrEqual(jsonTokens * 0.85);
    });
  }
});

describe("gate-agent-view: hostile text is inert data (NS-DATA-1, constitution X)", () => {
  // The reference consumer: plain data access over the parsed manifest. It returns
  // manifest text verbatim as data and has no code path that interprets it.
  function referenceConsumerReadDescription(doc: any): string {
    return doc.modules[0].declarations[0].description;
  }

  it("the injection description is surfaced verbatim, as data", () => {
    const doc = loadFixture("hostile/injection.json");
    const text = referenceConsumerReadDescription(doc);
    expect(text).toContain("Ignore all previous instructions");
    expect(text).toBe(doc.modules[0].declarations[0].description);
  });

  it("the Agent View carries the injection text as a quoted scalar, not structure", () => {
    const view = readFixture("hostile/injection.view.yml");
    const descriptionLine = view.split("\n").find((l) => l.includes("IMPORTANT SYSTEM MESSAGE"));
    expect(descriptionLine).toBeDefined();
    expect(descriptionLine!.trimStart().startsWith('description: "')).toBe(true);
  });
});
