import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { search } from "../../toolchain/src/api.js";
import { assertResponse } from "../../toolchain/src/envelope.js";
import { DISCOVERY_CORPUS, loadFixture, runAcm } from "./helpers.js";

/**
 * Cross-cutting mandated gates: hostile inertness through the CLI (FR-011 /
 * SC-005), determinism (FR-012 / SC-004 — the two-platform half is discharged
 * by the CI matrix running this suite on ubuntu and macos), the SC-002
 * performance budget, and the SC-001 two-call agent loop composed purely from
 * the capability manifest.
 */

const ESC = String.fromCharCode(27);
const CONTROL_BYTES = new RegExp("[" + "\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F" + "]");

describe("hostile inertness through the CLI (FR-011, NS-DATA-1)", () => {
  it("human output contains no raw ESC/C0/C1 byte from the hostile package", () => {
    const viaSearch = runAcm(["search", "ignore", "--project", DISCOVERY_CORPUS]).stdout;
    const viaDetail = runAcm(["component", "Innocuous", "--project", DISCOVERY_CORPUS]).stdout;
    expect(viaSearch).toContain("Innocuous"); // the hostile entry IS surfaced…
    expect(viaSearch).not.toMatch(CONTROL_BYTES); // …but inertly
    expect(viaDetail).not.toMatch(CONTROL_BYTES);
    expect(viaDetail).toContain("�"); // visible replacement, not silent stripping
  });

  it("machine output byte-preserves the hostile text inside data (no sanitizing)", () => {
    const { stdout } = runAcm(["component", "Innocuous", "--project", DISCOVERY_CORPUS, "--json"]);
    const envelope = assertResponse(stdout, "component.detail");
    const original = loadFixture(
      "discovery-corpus/node_modules/hostile-pkg/agentic-component-manifest.json",
    );
    expect(envelope.data.entry).toEqual(original.modules[0].declarations[0]);
    const description = (envelope.data.entry as { description: string }).description;
    expect(description).toContain(ESC); // bytes preserved through JSON escaping
  });

  it("injection prose appears only inside data fields — envelope structure is unaffected", () => {
    const { stdout } = runAcm(["search", "ignore", "--project", DISCOVERY_CORPUS, "--json"]);
    const envelope = assertResponse(stdout, "search");
    expect(Object.keys(JSON.parse(stdout)).sort()).toEqual(["data", "type"]);
    expect(envelope.data.results.some((r) => r.name === "Innocuous")).toBe(true);
  });
});

describe("determinism (FR-012, SC-004)", () => {
  it("repeated identical invocations are byte-identical (json, text, dense)", () => {
    const invocations = [
      ["search", "button", "--project", DISCOVERY_CORPUS, "--json"],
      ["search", "button", "--project", DISCOVERY_CORPUS],
      [
        "component",
        "AcmeButton",
        "--from",
        "@acme/lit-buttons",
        "--project",
        DISCOVERY_CORPUS,
        "--dense",
      ],
      ["capabilities", "--json"],
    ];
    for (const args of invocations) {
      const first = runAcm(args);
      const second = runAcm(args);
      expect(second.stdout).toBe(first.stdout);
      expect(second.stderr).toBe(first.stderr);
      expect(second.exitCode).toBe(first.exitCode);
    }
  });
});

describe("workspace-linked packages are part of the corpus", () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "acm-linked-corpus-"));

  afterAll(() => rmSync(tempRoot, { recursive: true, force: true }));

  /**
   * npm, pnpm, and yarn all install a workspace package as a symlink in `node_modules`.
   * `readdir` reports a link by its own type, so treating only real directories as
   * packages made a monorepo's own component library — the single most common way a
   * project ships a Manifest — invisible to discovery.
   */
  it("a symlinked package in node_modules is discovered like a real one", async () => {
    writeFileSync(path.join(tempRoot, "package.json"), JSON.stringify({ name: "link-fixture" }));

    const libDir = path.join(tempRoot, "libs", "ui");
    mkdirSync(libDir, { recursive: true });
    writeFileSync(path.join(libDir, "package.json"), JSON.stringify({ name: "@fixture/ui" }));
    writeFileSync(
      path.join(libDir, "agentic-component-manifest.json"),
      JSON.stringify({
        schemaVersion: "0.1.0",
        modules: [
          {
            path: "src/index.ts",
            declarations: [
              {
                name: "LinkedWidget",
                identity: {
                  paradigmClass: "vdom",
                  module: "@fixture/ui",
                  export: "LinkedWidget",
                },
                description: "A widget reached only through a workspace symlink.",
              },
            ],
            exports: [{ name: "LinkedWidget", declaration: "LinkedWidget" }],
          },
        ],
      }),
    );

    const scopeDir = path.join(tempRoot, "node_modules", "@fixture");
    mkdirSync(scopeDir, { recursive: true });
    symlinkSync(libDir, path.join(scopeDir, "ui"), "dir");

    const { data } = await search("linked widget", { project: tempRoot });
    expect(data.total).toBe(1);
    expect(data.results[0]?.name).toBe("LinkedWidget");
    expect(data.results[0]?.source).toBe("@fixture/ui");
  });

  it("a dangling symlink is skipped rather than throwing", async () => {
    const scopeDir = path.join(tempRoot, "node_modules", "@fixture");
    symlinkSync(path.join(tempRoot, "does-not-exist"), path.join(scopeDir, "ghost"), "dir");

    const { data } = await search("linked widget", { project: tempRoot });
    expect(data.total).toBe(1); // still just the real one; no crash
  });
});

describe("performance (SC-002)", () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "acm-perf-corpus-"));

  afterAll(() => rmSync(tempRoot, { recursive: true, force: true }));

  it("search over a 100+-component corpus completes in under one second", async () => {
    writeFileSync(path.join(tempRoot, "package.json"), JSON.stringify({ name: "perf-fixture" }));
    for (let i = 0; i < 100; i++) {
      const name = `pkg-${String(i).padStart(3, "0")}`;
      const dir = path.join(tempRoot, "node_modules", name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name }));
      writeFileSync(
        path.join(dir, "agentic-component-manifest.json"),
        JSON.stringify({
          schemaVersion: "0.1.0",
          modules: [
            {
              path: "src/index.ts",
              declarations: [
                {
                  name: `Widget${i}`,
                  identity: { paradigmClass: "vdom", module: name, export: `Widget${i}` },
                  description: `Widget number ${i} for the performance corpus.`,
                },
              ],
              exports: [{ name: `Widget${i}`, declaration: `Widget${i}` }],
            },
          ],
        }),
      );
    }
    const started = performance.now();
    const { data } = await search("widget", { project: tempRoot });
    const elapsed = performance.now() - started;
    expect(data.total).toBe(100);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe("the two-call agent loop, composed from the capability manifest alone (SC-001)", () => {
  it("capabilities → search → followUp → component.detail, zero help-text scraping", () => {
    // 1. Learn the surface from the one structured self-description call.
    const capabilities = assertResponse(runAcm(["capabilities", "--json"]).stdout, "capabilities");
    const searchCommand = capabilities.data.commands.find((c) => c.name === "search")!;
    expect(searchCommand.json).toBe(true);

    // 2. Call 1 — search, composed strictly from the manifest's declared surface.
    const searchEnvelope = assertResponse(
      runAcm(["search", "action", "button", "--project", DISCOVERY_CORPUS, "--json"]).stdout,
      "search",
    );
    expect(searchEnvelope.data.results.length).toBeGreaterThan(0);

    // 3. Call 2 — run the machine-provided followUp verbatim.
    const followUp = searchEnvelope.data.results[0]!.followUp;
    expect(followUp.startsWith("acm ")).toBe(true);
    const detail = assertResponse(
      runAcm([...followUp.split(" ").slice(1), "--project", DISCOVERY_CORPUS, "--json"]).stdout,
      "component.detail",
    );
    expect(detail.data.entry).toBeDefined();
  });
});
