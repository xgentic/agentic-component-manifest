import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { REPO_ROOT } from "../../toolchain/src/validate.js";

export const FIXTURES = path.join(REPO_ROOT, "packages/conformance/fixtures");

/** The discovery-corpus fixture project, REPO_ROOT-relative (stable in output). */
export const DISCOVERY_CORPUS = "packages/conformance/fixtures/discovery-corpus";

/**
 * Spawn the real `acm` CLI (tsx over cli.ts) with pinned cwd and a TTY-free
 * environment — the seam the stdout-purity and parity gates guard.
 */
export function runAcm(
  args: string[],
  opts: { cwd?: string } = {},
): { stdout: string; stderr: string; exitCode: number } {
  const tsxBin = path.join(
    REPO_ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
  );
  const result = spawnSync(
    tsxBin,
    [path.join(REPO_ROOT, "packages/toolchain/src/cli.ts"), ...args],
    {
      cwd: opts.cwd ?? REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
      shell: process.platform === "win32",
    },
  );
  if (result.error) throw result.error;
  return { stdout: result.stdout, stderr: result.stderr, exitCode: result.status ?? -1 };
}

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
