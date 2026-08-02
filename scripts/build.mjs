#!/usr/bin/env node
/**
 * Build the two shipped packages.
 *
 * The repo decomposes into five workspace packages for authoring reasons — the
 * normative layer, the toolchain, the skill blocks, the analyzer, the conformance
 * suite. A consumer has exactly two needs, so exactly two packages ship:
 *
 *   @xgentic/acm            the `acm` CLI + the JSON Schema + the Discovery Skill payload
 *                           → consume Manifests, and `acm init` to wire an agent up
 *   @xgentic/acm-analyzer   the `acm-analyzer` CLI → produce a Manifest from source
 *
 * `@xgentic/acm-spec` and `@xgentic/acm-discovery-skill` become `assets/` inside the
 * packages that need them; `@xgentic/acm-conformance` never ships.
 *
 * Each package is self-contained: the analyzer bundles the toolchain modules it uses
 * rather than depending on them, so the two tarballs install in any order with no
 * version skew. Both are built from one source tree, so they cannot drift.
 *
 * Usage:  node scripts/build.mjs [--pack]
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(REPO_ROOT, "dist");
const DEPLOY = path.join(REPO_ROOT, "deploy");

const read = (rel) => JSON.parse(readFileSync(path.join(REPO_ROOT, rel), "utf8"));
const specPkg = read("packages/spec/package.json");
const toolchainPkg = read("packages/toolchain/package.json");
const analyzerPkg = read("packages/analyzer/package.json");
const rootPkg = read("package.json");

/** Fields every shipped package.json inherits from the monorepo root. */
const COMMON = {
  license: rootPkg.license,
  repository: rootPkg.repository,
  homepage: rootPkg.homepage,
  engines: { node: ">=20" },
  type: "module",
};

const PACKAGES = [
  {
    name: "toolchain",
    entries: {
      "dist/cli.js": "packages/toolchain/src/cli.ts",
      "dist/index.js": "packages/toolchain/src/index.ts",
    },
    // `json-schema-to-typescript` is only reachable from `acm drift`, a repo-development
    // command that refuses to run outside a checkout — so it is external and undeclared.
    external: ["ajv", "ajv/*", "yaml", "json-schema-to-typescript"],
    assets: [
      ["packages/spec/schema", "assets/spec/schema"],
      ["packages/spec/package.json", "assets/spec/package.json"],
      ["packages/discovery-skill/blocks", "assets/skill/blocks"],
      ["packages/discovery-skill/generated", "assets/skill/generated"],
    ],
    manifest: {
      ...COMMON,
      name: toolchainPkg.name,
      version: toolchainPkg.version,
      description: toolchainPkg.description,
      keywords: rootPkg.keywords,
      bin: { acm: "./dist/cli.js" },
      exports: { ".": "./dist/index.js" },
      files: ["dist", "assets", "README.md"],
      dependencies: toolchainPkg.dependencies,
    },
    readme: "packages/toolchain/README.md",
  },
  {
    name: "analyzer",
    entries: {
      "dist/cli.js": "packages/analyzer/src/cli.ts",
      "dist/plugin.js": "packages/analyzer/src/plugin.ts",
    },
    external: ["ajv", "ajv/*", "typescript", "chokidar", "tinyglobby"],
    assets: [
      ["packages/spec/schema", "assets/spec/schema"],
      ["packages/spec/package.json", "assets/spec/package.json"],
    ],
    manifest: {
      ...COMMON,
      name: analyzerPkg.name,
      version: analyzerPkg.version,
      description: analyzerPkg.description,
      keywords: rootPkg.keywords,
      bin: { "acm-analyzer": "./dist/cli.js" },
      exports: { ".": "./dist/plugin.js" },
      files: ["dist", "assets", "README.md"],
      // Workspace deps are bundled in, not depended on: what remains is what npm must
      // fetch. `ajv` comes along with the bundled reference validator.
      dependencies: Object.fromEntries(
        Object.entries(analyzerPkg.dependencies).filter(([n]) => !n.startsWith("@xgentic/")),
      ),
    },
    readme: "packages/analyzer/README.md",
  },
];

/**
 * The analyzer imports `@xgentic/acm` by package name; in the workspace that resolves
 * to TypeScript source esbuild can bundle directly.
 */
const workspaceAlias = {
  "@xgentic/acm": path.join(REPO_ROOT, "packages/toolchain/src/index.ts"),
};

/**
 * esbuild hoists the entry file's own shebang into the bundle. In the repo those point
 * at `tsx`, which the shipped package does not have — rewrite to plain node, and never
 * emit a second shebang line (node rejects one below line 1).
 */
function normalizeShebang(file) {
  const source = readFileSync(file, "utf8");
  const body = source.startsWith("#!") ? source.slice(source.indexOf("\n") + 1) : source;
  writeFileSync(file, `#!/usr/bin/env node\n${body}`, { mode: 0o755 });
}

async function build(pkg) {
  const outRoot = path.join(DIST, pkg.name);
  rmSync(outRoot, { recursive: true, force: true });
  mkdirSync(outRoot, { recursive: true });

  for (const [out, entry] of Object.entries(pkg.entries)) {
    await esbuild.build({
      entryPoints: [path.join(REPO_ROOT, entry)],
      outfile: path.join(outRoot, out),
      bundle: true,
      platform: "node",
      target: "node20",
      format: "esm",
      external: pkg.external,
      alias: workspaceAlias,
      logLevel: "warning",
    });
    if (out.endsWith("cli.js")) normalizeShebang(path.join(outRoot, out));
  }

  for (const [from, to] of pkg.assets) {
    cpSync(path.join(REPO_ROOT, from), path.join(outRoot, to), { recursive: true });
  }

  writeFileSync(path.join(outRoot, "package.json"), JSON.stringify(pkg.manifest, null, 2) + "\n");
  cpSync(path.join(REPO_ROOT, pkg.readme), path.join(outRoot, "README.md"));

  return outRoot;
}

/**
 * Every asset the shipped code resolves through `paths.ts` must actually be in the
 * package. Scanning the bundle for `packages/…` strings would only produce noise — the
 * repo-layout probe and the repo-only commands name those paths on purpose. The real
 * proof that nothing reaches for a checkout is behavioural: `scripts/verify-dist.mjs`
 * installs these tarballs outside the repo and drives the CLIs there.
 */
function assertAssetsPresent(outRoot, expected) {
  const missing = expected.filter((rel) => !existsSync(path.join(outRoot, rel)));
  if (missing.length > 0) {
    throw new Error(`shipped package is missing assets:\n  ${missing.join("\n  ")}`);
  }
  // The spec package never ships, but its version is the manifest `schemaVersion`.
  const shipped = JSON.parse(readFileSync(path.join(outRoot, "assets/spec/package.json"), "utf8"));
  if (shipped.version !== specPkg.version) {
    throw new Error(`assets/spec/package.json is stale: ${shipped.version} ≠ ${specPkg.version}`);
  }
}

/** The assets each package's code resolves at runtime, by package name. */
const REQUIRED_ASSETS = {
  "@xgentic/acm": [
    "assets/spec/schema/acm.schema.json",
    "assets/spec/schema/acm.meta.schema.json",
    "assets/skill/blocks/activation.md",
    "assets/skill/generated/targets/claude-skill/acm-discovery/SKILL.md",
    "assets/skill/generated/targets/AGENTS.fragment.md",
    "assets/skill/generated/targets/rules/acm-discovery.md",
  ],
  "@xgentic/acm-analyzer": ["assets/spec/schema/acm.schema.json"],
};

const packed = [];
for (const pkg of PACKAGES) {
  const outRoot = await build(pkg);
  assertAssetsPresent(outRoot, REQUIRED_ASSETS[pkg.manifest.name]);
  console.log(`built  ${pkg.manifest.name}  →  ${path.relative(REPO_ROOT, outRoot)}`);
  packed.push({ pkg, outRoot });
}

if (process.argv.includes("--pack")) {
  // A fresh deploy/ every time: a stale tarball from an older layout is worse than none.
  rmSync(DEPLOY, { recursive: true, force: true });
  mkdirSync(DEPLOY, { recursive: true });
  for (const { pkg, outRoot } of packed) {
    execFileSync("npm", ["pack", "--pack-destination", DEPLOY], {
      cwd: outRoot,
      stdio: ["ignore", "ignore", "inherit"],
    });
    console.log(`packed ${pkg.manifest.name}`);
  }
}
