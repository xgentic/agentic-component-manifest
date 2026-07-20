import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalize, checkCanonical, validateManifest } from "../../toolchain/src/index.js";
import { analyzeProject } from "../../analyzer/src/run.js";
import { defaultSettings, type BuiltinFramework } from "../../analyzer/src/types.js";
import { FIXTURES, readFixture } from "./helpers.js";

/**
 * FR-013 / SC-002 / SC-003: the analyzer reproduces each checked-in golden manifest
 * byte-for-byte from real source, deterministically. Each case analyzes `<dir>/src`
 * and byte-matches the target manifest.
 *
 * Two kinds of golden:
 *  - **analyzer goldens** (`analyzer/<fw>`) — full byte-match; the golden carries only
 *    analyzer-derivable (Tier-1) nodes, so it matches `analyze(src)` directly.
 *  - **witness goldens** (`witness/<fw>`) — the checked-in feature-001 witness manifests
 *    also carry `semantics`/`examples` (`acmTier: authored-verifiable`, Tier 2), which a
 *    Tier-1-only producer cannot emit. Per research R-12a, FR-013 is satisfied against the
 *    witness's **Tier-1 projection**: the golden with `semantics`/`examples` removed and
 *    re-canonicalized. The witness goldens, their Agent-View/source YAML, and
 *    `gate-coverage` are left untouched.
 */
interface WitnessCase {
  dir: string;
  framework?: BuiltinFramework;
  /** Match the Tier-1 projection of the golden (witness manifests carrying Tier-2 nodes). */
  projected?: boolean;
}

const CASES: WitnessCase[] = [
  { dir: "analyzer/vanilla" }, // vanilla golden (no witness slot of its own — R-12)
  { dir: "analyzer/doc-metadata" }, // feature 003: @acmSemantic + @example Tier-2 extraction
  { dir: "analyzer/angular", framework: "angular" }, // classic @Input/@Output decorators
  { dir: "witness/lit", framework: "lit", projected: true }, // retained-dom witness
  { dir: "witness/react", framework: "react", projected: true }, // vdom witness
  { dir: "witness/angular", framework: "angular", projected: true }, // signals-di witness
];

/** Strip Tier-2 `semantics`/`examples` and re-canonicalize (R-12a Tier-1 projection). */
function tier1Projection(manifestText: string): string {
  const manifest = JSON.parse(manifestText);
  for (const module of manifest.modules ?? []) {
    for (const decl of module.declarations ?? []) {
      delete decl.semantics;
      delete decl.examples;
    }
  }
  return canonicalize(manifest);
}

/** The byte-exact manifest the analyzer must reproduce for a case. */
function target(c: WitnessCase): string {
  const golden = readFixture(`${c.dir}/agentic-component-manifest.json`);
  return c.projected ? tier1Projection(golden) : golden;
}

async function analyzeFixture(c: WitnessCase): Promise<string | null> {
  const settings = defaultSettings();
  settings.framework = c.framework;
  const outcome = await analyzeProject(settings, path.join(FIXTURES, c.dir), { write: false });
  return outcome.text;
}

describe("analyzer-witness: analyze reproduces checked-in goldens byte-for-byte (FR-013)", () => {
  for (const c of CASES) {
    const label = c.projected ? "Tier-1 projection of agentic-component-manifest.json" : "agentic-component-manifest.json";

    it(`${c.dir}: analyze(src) byte-matches ${label}`, async () => {
      const text = await analyzeFixture(c);
      expect(text).toBe(target(c));
    });

    it(`${c.dir}: re-analysis is byte-identical (SC-002)`, async () => {
      const first = await analyzeFixture(c);
      const second = await analyzeFixture(c);
      expect(first).toBe(second);
    });

    it(`${c.dir}: output is schema-valid and canonical`, async () => {
      const text = await analyzeFixture(c);
      expect(text).not.toBeNull();
      expect(validateManifest(JSON.parse(text!)).valid).toBe(true);
      expect(checkCanonical(text!).canonical).toBe(true);
    });
  }
});
