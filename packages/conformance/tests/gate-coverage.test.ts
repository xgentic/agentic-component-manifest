import { describe, expect, it } from "vitest";
import {
  PARADIGM_CLASSES,
  computeCoverage,
  loadWitnessFixtures,
} from "../../toolchain/src/coverage.js";

describe("gate-coverage: the Prime Directive is mechanical (constitution II)", () => {
  it("every core structural node is witnessed in every applicable paradigm class", () => {
    const result = computeCoverage(loadWitnessFixtures());
    expect(result.gaps).toEqual([]);
  });

  it("all four paradigm classes have a witness fixture (Angular mandatory)", () => {
    const classes = new Set(
      loadWitnessFixtures().flatMap((f) =>
        f.doc.modules.flatMap((m: any) =>
          (m.declarations ?? []).map((d: any) => d.identity.paradigmClass),
        ),
      ),
    );
    for (const cls of PARADIGM_CLASSES) expect(classes.has(cls)).toBe(true);
  });

  it("cssParts is annotated inapplicable outside retained-DOM (grandfather clause)", () => {
    const result = computeCoverage(loadWitnessFixtures());
    expect(result.matrix.cssParts).toEqual({
      "retained-dom": "witnessed",
      vdom: "n/a",
      "compiler-sfc": "n/a",
      "signals-di": "n/a",
    });
  });
});
