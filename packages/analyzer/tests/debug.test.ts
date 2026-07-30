/**
 * Run observability: the `--dev` trace and the diagnostics that explain an empty result.
 *
 * The failure this covers is the analyzer's worst one — it runs, exits clean, writes a
 * valid manifest with nothing in it, and says nothing about why. Every assertion here
 * pins a piece of the answer: what was discovered, what parsed, which plugins ran, what
 * the sources actually import, and which files yielded nothing. Observation must not
 * change the output, so the manifest text is asserted to be identical with and without it.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { analyzeProject, TRACE_LIST_CAP } from "../src/run.js";
import { defaultSettings, type AnalyzerSettings } from "../src/types.js";

const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "acm-debug-"));
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpRoot, "proj-"));
  writeFileSync(path.join(dir, "package.json"), `{ "name": "@acme/debug", "version": "0.0.0" }`);
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(dir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, body, "utf8");
  }
  return dir;
}

const STENCIL_BUTTON = `
import { Component, Prop, h } from '@stencil/core';

/** A Stencil button. */
@Component({ tag: 'acme-button' })
export class AcmeButton {
  /** Visual variant. */
  @Prop() variant: string = 'primary';
}
`;

const REACT_CARD = `
import type { ReactNode } from 'react';

interface CardProps {
  /** Card heading. */
  title?: string;
}

/** A React card. */
export const Card = (props: CardProps): ReactNode => null;
`;

/** A plain helper module: parses, imports no framework, yields no declaration. */
const HELPER = `export const clamp = (n: number): number => (n < 0 ? 0 : n);\n`;

function settingsFor(frameworks: AnalyzerSettings["frameworks"], dev = false): AnalyzerSettings {
  const settings = defaultSettings();
  settings.frameworks = frameworks;
  settings.dev = dev;
  return settings;
}

/** Analyze `dir` capturing the trace lines the CLI would print under `--dev`. */
async function traced(
  dir: string,
  settings: AnalyzerSettings,
): Promise<{ lines: string[]; outcome: Awaited<ReturnType<typeof analyzeProject>> }> {
  const lines: string[] = [];
  const outcome = await analyzeProject(settings, dir, {
    write: false,
    log: (line) => lines.push(line),
  });
  return { lines, outcome };
}

describe("framework census: what the sources actually import", () => {
  it("reports every framework seen, in a stable order, with the files that import it", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON, "src/card.tsx": REACT_CARD });
    const { stats } = await analyzeProject(settingsFor([]), dir, { write: false });

    expect(stats.detected.map((s) => s.framework)).toEqual(["stencil", "react"]);
    expect(stats.detected[0]).toMatchObject({
      specifier: "@stencil/core",
      files: ["src/button.tsx"],
    });
    expect(stats.detected[1]).toMatchObject({ specifier: "react", files: ["src/card.tsx"] });
  });

  it("reports no sighting for sources that import no framework", async () => {
    const dir = project({ "src/util.ts": HELPER });
    const { stats } = await analyzeProject(settingsFor([]), dir, { write: false });
    expect(stats.detected).toEqual([]);
  });
});

describe("ACM-A-FRAMEWORK: the hint that rescues a silent empty run", () => {
  it("names the framework the sources import when nothing was extracted", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON });
    const outcome = await analyzeProject(settingsFor([]), dir, { write: false });

    const hint = outcome.diagnostics.find((d) => d.code === "ACM-A-FRAMEWORK");
    expect(hint?.severity).toBe("warning");
    expect(hint?.message).toMatch(/1 file\(s\) import "@stencil\/core"/);
    expect(hint?.message).toMatch(/active framework selection is vanilla/);
    expect(hint?.message).toMatch(/--framework stencil/);
  });

  it("suggests the whole missing set at once for a mixed project", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON, "src/card.tsx": REACT_CARD });
    const outcome = await analyzeProject(settingsFor([]), dir, { write: false });
    expect(outcome.diagnostics.find((d) => d.code === "ACM-A-FRAMEWORK")?.message).toMatch(
      /--framework stencil,react/,
    );
  });

  it("stays silent once the right framework is selected", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON });
    const outcome = await analyzeProject(settingsFor(["stencil"]), dir, { write: false });
    expect(outcome.diagnostics.find((d) => d.code === "ACM-A-FRAMEWORK")).toBeUndefined();
    expect(outcome.exitCode).toBe(0);
  });

  it("stays silent when the run did produce declarations, even if another framework is present", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON, "src/card.tsx": REACT_CARD });
    const outcome = await analyzeProject(settingsFor(["stencil"]), dir, { write: false });
    expect(outcome.diagnostics.find((d) => d.code === "ACM-A-FRAMEWORK")).toBeUndefined();
  });

  it("stays silent when there is nothing to blame it on (no framework imports at all)", async () => {
    const dir = project({ "src/util.ts": HELPER });
    const outcome = await analyzeProject(settingsFor([]), dir, { write: false });
    expect(outcome.diagnostics.find((d) => d.code === "ACM-A-FRAMEWORK")).toBeUndefined();
    expect(outcome.diagnostics.find((d) => d.code === "ACM-A-EMPTY")).toBeDefined();
  });
});

describe("diagnostics that name the scope they came up empty in", () => {
  it("ACM-A-EMPTY reports the file count and the active framework", async () => {
    const dir = project({ "src/util.ts": HELPER, "src/other.ts": HELPER });
    const outcome = await analyzeProject(settingsFor(["stencil"]), dir, { write: false });
    expect(outcome.diagnostics.find((d) => d.code === "ACM-A-EMPTY")?.message).toBe(
      "no components found in 2 scanned file(s) using framework stencil; wrote a valid empty manifest",
    );
  });

  it("ACM-A-NOFILES names the globs, the directory, and the way out", async () => {
    const dir = project({ "lib/util.ts": HELPER }); // nothing under src/
    const outcome = await analyzeProject(settingsFor(["stencil"]), dir, { write: false });
    const nofiles = outcome.diagnostics.find((d) => d.code === "ACM-A-NOFILES");
    expect(nofiles?.severity).toBe("error");
    expect(nofiles?.message).toMatch(/no source files matched \["src\/\*\*/);
    expect(nofiles?.message).toMatch(/pass --globs/);
    expect(outcome.exitCode).toBe(1);
  });
});

describe("--dev trace", () => {
  it("is silent unless dev is set", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON });
    const { lines } = await traced(dir, settingsFor(["stencil"]));
    expect(lines).toEqual([]);
  });

  it("walks the whole pipeline: discovery, parse, plugins, census, yield, summary", async () => {
    const dir = project({
      "src/button.tsx": STENCIL_BUTTON,
      "src/util.ts": HELPER,
    });
    const { lines } = await traced(dir, settingsFor(["stencil"], true));
    const trace = lines.join("\n");

    expect(trace).toMatch(/discovered 2 file\(s\) matching \["src\/\*\*/);
    expect(trace).toContain("  src/button.tsx");
    expect(trace).toContain("parsed 2 file(s), skipped 0");
    expect(trace).toContain("plugins: stencil");
    expect(trace).toMatch(/framework imports detected: stencil \("@stencil\/core", 1 file\(s\)\)/);
    expect(trace).toContain("  stencil: 1 declaration(s)");
    expect(trace).toContain("1 parsed file(s) yielded no declarations:");
    expect(trace).toContain("  src/util.ts");
    expect(trace).toContain(
      "summary: 2 file(s) scanned · 1 module(s) with declarations · 1 declaration(s)",
    );
  });

  it("names every plugin that ran, including the ones that produced nothing", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON });
    const { lines } = await traced(dir, settingsFor(["stencil", "react"], true));
    expect(lines).toContain("plugins: stencil → react");
    expect(lines).toContain("  react: 0 declaration(s)");
  });

  it("caps file listings instead of dumping a whole repository", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < TRACE_LIST_CAP + 5; i++) files[`src/m${i}.ts`] = HELPER;
    const { lines } = await traced(project(files), settingsFor([], true));

    const listed = lines.filter((l) => /^ {2}src\/m\d+\.ts$/.test(l));
    expect(listed.length).toBe(TRACE_LIST_CAP * 2); // discovery listing + the barren listing
    expect(lines.filter((l) => l === `  … 5 more`)).toHaveLength(2);
  });

  it("does not change the manifest it describes (SC-002)", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON });
    const quiet = await analyzeProject(settingsFor(["stencil"]), dir, { write: false });
    const { outcome: loud } = await traced(dir, settingsFor(["stencil"], true));
    expect(loud.text).toBe(quiet.text);
    expect(loud.text).not.toBeNull();
  });
});
