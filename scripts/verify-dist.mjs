#!/usr/bin/env node
/**
 * Prove the two tarballs actually work when installed.
 *
 * The conformance suite runs the toolchain from a checkout, where every repo-shaped
 * path resolves by accident of layout. This script is the only check that exercises
 * what a consumer gets: it installs both tarballs into a throwaway project **outside**
 * this repository and drives the CLIs there.
 *
 * Usage:  node scripts/verify-dist.mjs        (run `pnpm dist:pack` first)
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOY = path.join(REPO_ROOT, "deploy");

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log(`  ok    ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  ${label}\n        ${error.message.split("\n").join("\n        ")}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tarballs = existsSync(DEPLOY) ? readdirSync(DEPLOY).filter((f) => f.endsWith(".tgz")) : [];
if (tarballs.length === 0) {
  console.error("no tarballs in deploy/ — run `pnpm dist:pack` first");
  process.exit(2);
}

const project = mkdtempSync(path.join(tmpdir(), "acm-verify-"));
console.log(`verifying ${tarballs.length} tarball(s) in ${project}\n`);

/** Run a command in the throwaway project; never throws, so a failure is a report. */
function run(command, args, options = {}) {
  const result = execFileSync(command, args, {
    cwd: options.cwd ?? project,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  return result;
}
function runAllowFail(command, args) {
  try {
    return { stdout: run(command, args), status: 0 };
  } catch (error) {
    return { stdout: error.stdout ?? "", stderr: error.stderr ?? "", status: error.status ?? -1 };
  }
}
const acm = (...args) => runAllowFail(path.join(project, "node_modules/.bin/acm"), args);

writeFileSync(
  path.join(project, "package.json"),
  JSON.stringify({ name: "acm-verify-fixture", version: "0.0.0", private: true }, null, 2),
);
run("npm", ["install", "--no-audit", "--no-fund", ...tarballs.map((t) => path.join(DEPLOY, t))]);

console.log("exactly two shipped packages");
check("deploy/ holds exactly the two consumer packages", () => {
  assert(
    tarballs.length === 2,
    `expected 2 tarballs, found ${tarballs.length}: ${tarballs.join(", ")}`,
  );
  const names = tarballs.map((t) => t.replace(/-\d.*$/, "")).sort();
  assert(
    JSON.stringify(names) === JSON.stringify(["acm-analyzer", "acm-toolchain"]),
    `unexpected packages: ${names.join(", ")}`,
  );
});

console.log("\nthe acm CLI, installed");
check("capabilities emits a valid envelope naming init", () => {
  const { stdout, status } = acm("capabilities", "--json");
  assert(status === 0, `exit ${status}`);
  const envelope = JSON.parse(stdout);
  assert(envelope.type === "capabilities", `type ${envelope.type}`);
  assert(
    envelope.data.commands.some((c) => c.name === "init"),
    "init missing from the capability manifest",
  );
});

check("init installs the skill and reports the empty corpus", () => {
  const { stdout, status } = acm("init");
  assert(status === 0, `exit ${status}`);
  const installed = path.join(project, ".claude/skills/acm-discovery/SKILL.md");
  assert(existsSync(installed), "SKILL.md was not written");
  assert(stdout.includes("no ACM Manifests found"), "empty corpus not reported");
  assert(stdout.includes("acm-analyzer analyze"), "no pointer to the analyzer");
});

check("the installed skill is byte-identical to the agent-docs target", () => {
  const installed = readFileSync(
    path.join(project, ".claude/skills/acm-discovery/SKILL.md"),
    "utf8",
  );
  const { stdout } = acm("agent-docs", "--target", "claude-skill");
  assert(installed === stdout, "installed bytes differ from `agent-docs --target`");
});

check("a second init is fresh; a tampered file is refused; --force overwrites", () => {
  assert(acm("init").stdout.includes("fresh"), "second run was not fresh");
  const installed = path.join(project, ".claude/skills/acm-discovery/SKILL.md");
  const pristine = readFileSync(installed, "utf8");
  writeFileSync(installed, "hand-written\n");
  const blocked = acm("init");
  assert(blocked.status === 3, `expected exit 3, got ${blocked.status}`);
  assert(readFileSync(installed, "utf8") === "hand-written\n", "a refusal still wrote");
  assert(acm("init", "--force").status === 0, "--force failed");
  assert(readFileSync(installed, "utf8") === pristine, "--force did not restore the skill");
});

console.log("\ndiscovery against a real corpus");
check("a dependency's Manifest is discovered, searched, and read back", () => {
  const dep = path.join(project, "node_modules/@fixture/buttons");
  mkdirSync(dep, { recursive: true });
  writeFileSync(
    path.join(dep, "package.json"),
    JSON.stringify({ name: "@fixture/buttons", version: "1.0.0" }),
  );
  const manifest = readFileSync(
    path.join(
      REPO_ROOT,
      "packages/conformance/fixtures/witness/lit/agentic-component-manifest.json",
    ),
    "utf8",
  );
  writeFileSync(path.join(dep, "agentic-component-manifest.json"), manifest);

  const preflight = acm("init", "--force");
  assert(preflight.stdout.includes("@fixture/buttons"), "preflight missed the new Manifest");

  const search = acm("search", "button", "--json");
  assert(search.status === 0, `search exit ${search.status}`);
  const results = JSON.parse(search.stdout);
  assert(results.type === "search", `type ${results.type}`);
  assert(results.data.total > 0, "search found nothing in a non-empty corpus");

  const name = results.data.results[0].name;
  const detail = JSON.parse(acm("component", name, "--json").stdout);
  assert(detail.type === "component.detail", `type ${detail.type}`);
});

console.log("\nthe analyzer, installed");
check("analyze derives a Manifest the installed acm validates", () => {
  const source = path.join(project, "src");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    path.join(source, "my-badge.ts"),
    [
      "/** A small status badge. */",
      "export class MyBadge extends HTMLElement {",
      "  /** The label text. */",
      "  label = '';",
      "}",
      "customElements.define('my-badge', MyBadge);",
      "",
    ].join("\n"),
  );
  const analyzer = runAllowFail(path.join(project, "node_modules/.bin/acm-analyzer"), [
    "analyze",
    "--globs",
    "src/**/*.ts",
    "--outdir",
    "out",
  ]);
  assert(analyzer.status === 0 || analyzer.status === 3, `analyze exit ${analyzer.status}`);
  const emitted = path.join(project, "out/agentic-component-manifest.json");
  assert(existsSync(emitted), "no manifest was emitted");
  const validated = acm("validate", emitted);
  assert(validated.status === 0, `validate exit ${validated.status}: ${validated.stderr}`);
});

console.log("\nrepo-development commands are not part of the shipped surface");
for (const command of ["drift", "coverage"]) {
  check(`${command} refuses to run outside a checkout`, () => {
    const { status, stderr } = acm(command);
    assert(status === 2, `expected exit 2, got ${status}`);
    assert(
      stderr.includes("repo-development command"),
      `unhelpful message: ${stderr.trim() || "(empty)"}`,
    );
  });
}

rmSync(project, { recursive: true, force: true });
console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
