import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The one module that knows where the toolchain's data lives.
 *
 * The toolchain runs in two layouts and must resolve the same assets in both:
 *
 *   repo      packages/toolchain/src/*.ts  →  packages/spec/…, packages/discovery-skill/…
 *   packaged  <pkg>/dist/cli.js            →  <pkg>/assets/spec/…, <pkg>/assets/skill/…
 *
 * Every asset path in the toolchain goes through one of the exports below, so an
 * installed `@acm/toolchain` never reaches for a repo-shaped path. `scripts/build.mjs`
 * populates `assets/` when packing; the probe order below is what makes the packaged
 * copy win without the code knowing which layout it is in.
 *
 * `REPO_ROOT` is deliberately nullable: the repo-development commands (`drift`,
 * `coverage`) read fixtures and generated artifacts that only exist in a checkout, and
 * must fail with a clear message rather than a path error when run from an install.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** The installed package root when packaged (`<pkg>/dist` → `<pkg>`), else `packages/toolchain`. */
const PACKAGE_ROOT = path.resolve(here, "..");

/** The repo checkout root, or `undefined` when running from an installed package. */
export const REPO_ROOT_OR_UNDEFINED: string | undefined = (() => {
  const candidate = path.resolve(here, "../../..");
  return existsSync(path.join(candidate, "packages/spec/schema/acm.schema.json"))
    ? candidate
    : undefined;
})();

/**
 * Repo-checkout root. Kept as a non-optional export because the conformance suite and
 * the repo-only commands index off it; in a packaged install it points at a directory
 * that does not carry the repo layout, and `requireRepoLayout()` is the guard.
 */
export const REPO_ROOT: string = REPO_ROOT_OR_UNDEFINED ?? PACKAGE_ROOT;

/** First existing candidate, else the last one (so error messages name the expected path). */
function resolveRoot(candidates: string[], probe: string): string {
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, probe))) return candidate;
  }
  return candidates[candidates.length - 1]!;
}

/** `packages/spec` in a checkout, `<pkg>/assets/spec` when packaged. */
export const SPEC_DIR: string = resolveRoot(
  [
    path.join(PACKAGE_ROOT, "assets/spec"),
    ...(REPO_ROOT_OR_UNDEFINED ? [path.join(REPO_ROOT_OR_UNDEFINED, "packages/spec")] : []),
  ],
  "schema/acm.schema.json",
);

/** `packages/discovery-skill` in a checkout, `<pkg>/assets/skill` when packaged. */
export const SKILL_DIR: string = resolveRoot(
  [
    path.join(PACKAGE_ROOT, "assets/skill"),
    ...(REPO_ROOT_OR_UNDEFINED
      ? [path.join(REPO_ROOT_OR_UNDEFINED, "packages/discovery-skill")]
      : []),
  ],
  "blocks/activation.md",
);

/**
 * The manifest schema version, self-declared by the spec package (Principle VII).
 * Read lazily so a consumer that never emits a manifest doesn't need the file.
 */
export function readSpecPackageVersion(): string {
  return (
    JSON.parse(readFileSync(path.join(SPEC_DIR, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;
}

/**
 * The toolchain's own `package.json` — the version and description `acm capabilities`
 * reports. Same file in both layouts (`packages/toolchain/package.json` is the source
 * the build derives the shipped manifest from).
 */
export function readToolchainPackageJson(): { version?: string; description?: string } {
  return JSON.parse(readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")) as {
    version?: string;
    description?: string;
  };
}

/**
 * Guard for the repo-development commands. Their inputs (`packages/spec/generated`,
 * `packages/conformance/fixtures/witness`) ship with the repo, not with the package.
 */
export function requireRepoLayout(command: string): string {
  if (REPO_ROOT_OR_UNDEFINED === undefined) {
    throw new RepoOnlyCommandError(command);
  }
  return REPO_ROOT_OR_UNDEFINED;
}

export class RepoOnlyCommandError extends Error {
  constructor(readonly command: string) {
    super(
      `\`acm ${command}\` is a repo-development command and is not available in an ` +
        `installed @acm/toolchain (it reads this repository's generated artifacts and fixtures).`,
    );
    this.name = "RepoOnlyCommandError";
  }
}
