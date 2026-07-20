import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../toolchain/src/validate.js";

export const FIXTURES = path.join(REPO_ROOT, "packages/conformance/fixtures");

/** Every checked-in valid manifest fixture (canonical form, goldened). */
export const VALID_FIXTURE_DIRS = [
  "minimal",
  "witness/lit",
  "witness/react",
  "witness/vue",
  "witness/angular",
  "adversarial/headless",
  "adversarial/scoped-slot",
  "adversarial/polymorphic",
  "adversarial/controlled",
  "adversarial/form-associated",
  "maximal",
] as const;

/** Minimal-fixture byte budget (constitution III). Changing this is a reviewable event. */
export const MINIMAL_BUDGET_BYTES = 1024;

export function readFixture(rel: string): string {
  return readFileSync(path.join(FIXTURES, rel), "utf8");
}

export function loadFixture(rel: string): any {
  return JSON.parse(readFixture(rel));
}
