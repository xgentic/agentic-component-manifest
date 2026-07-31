/**
 * Multi-framework selection: parsing, precedence, plugin order, and the collision rule.
 *
 * One `--framework` selects one plugin; several select several, in the order written, so a
 * repository that mixes paradigms is one run rather than one run per framework. Because
 * two framework plugins can key off the same syntax (Angular and Stencil both match
 * `@Component`), the seam has to decide a winner deterministically — first claim wins,
 * the loser's contribution is dropped with an attributed `ACM-A-DUPENTRY` warning.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli.js";
import { normalizeFrameworks, resolvePlugins, validateFileConfig } from "../src/config.js";
import { UsageError } from "../src/diagnostics.js";
import type { AnalyzerPlugin } from "../src/plugin.js";
import { analyzeProject } from "../src/run.js";
import { defaultSettings } from "../src/types.js";

const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "acm-frameworks-"));
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

/** Write a throwaway package whose files are given as `relative path → source`. */
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpRoot, "proj-"));
  writeFileSync(path.join(dir, "package.json"), `{ "name": "@acme/mixed", "version": "0.0.0" }`);
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

/** The declarations of an analyzed project, flattened across modules. */
function declarationsOf(text: string | null): Array<Record<string, any>> {
  return JSON.parse(text ?? '{"modules":[]}').modules.flatMap(
    (m: { declarations?: unknown[] }) => m.declarations ?? [],
  );
}

describe("normalizeFrameworks: flatten, validate, de-duplicate", () => {
  it("splits comma-separated values and preserves the written order", () => {
    expect(normalizeFrameworks(["stencil,react"], "--framework")).toEqual(["stencil", "react"]);
    expect(normalizeFrameworks(["react", "stencil"], "--framework")).toEqual(["react", "stencil"]);
  });

  it("trims whitespace and ignores empty segments", () => {
    expect(normalizeFrameworks([" lit , react ", ""], "--framework")).toEqual(["lit", "react"]);
  });

  it("keeps the first occurrence of a repeated name", () => {
    expect(normalizeFrameworks(["lit", "react", "lit"], "--framework")).toEqual(["lit", "react"]);
  });

  it("is fatal for an unknown name, naming the origin and the supported set", () => {
    expect(() => normalizeFrameworks(["svelte"], "--framework")).toThrow(UsageError);
    expect(() => normalizeFrameworks(["svelte"], "--framework")).toThrow(
      /--framework: unknown framework "svelte".*vanilla, lit, stencil, angular, react/,
    );
  });

  it("accepts vanilla as an explicit choice so it can compose with a framework", () => {
    expect(normalizeFrameworks(["vanilla,lit"], "--framework")).toEqual(["vanilla", "lit"]);
  });
});

describe("parseCliArgs: --framework is repeatable and comma-separated", () => {
  it("treats repeated flags and one comma-separated flag identically", () => {
    const repeated = parseCliArgs(["analyze", "--framework", "stencil", "--framework", "react"]);
    const joined = parseCliArgs(["analyze", "--framework", "stencil,react"]);
    expect(repeated.overrides.frameworks).toEqual(["stencil", "react"]);
    expect(joined.overrides.frameworks).toEqual(["stencil", "react"]);
  });

  it("leaves the override unset when the flag is absent (vanilla default)", () => {
    expect(parseCliArgs(["analyze"]).overrides.frameworks).toBeUndefined();
  });

  it("is a usage error for an unknown name", () => {
    expect(() => parseCliArgs(["analyze", "--framework", "svelte"])).toThrow(UsageError);
  });
});

describe("settings file: framework | frameworks, one name or many", () => {
  it("accepts the plural key with a list", () => {
    expect(validateFileConfig({ frameworks: ["lit", "react"] }, "c.js").frameworks).toEqual([
      "lit",
      "react",
    ]);
  });

  it("accepts the singular key with one name (back-compatible)", () => {
    expect(validateFileConfig({ framework: "lit" }, "c.js").frameworks).toEqual(["lit"]);
  });

  it("rejects a file that sets both keys", () => {
    expect(() => validateFileConfig({ framework: "lit", frameworks: ["react"] }, "c.js")).toThrow(
      /set either "framework" or "frameworks", not both/,
    );
  });

  it("rejects a non-string entry naming the key", () => {
    expect(() => validateFileConfig({ frameworks: [1] }, "c.js")).toThrow(
      /"frameworks" must be a string or an array of strings/,
    );
  });
});

describe("resolvePlugins: framework plugins in selection order, then user plugins", () => {
  const user: AnalyzerPlugin = { name: "user", analyze() {} };

  it("runs the vanilla plugin alone when nothing is selected", () => {
    const settings = defaultSettings();
    expect(resolvePlugins(settings).map((p) => p.name)).toEqual(["vanilla"]);
  });

  it("runs every selected framework, in order, ahead of user plugins", () => {
    const settings = defaultSettings();
    settings.frameworks = ["stencil", "react"];
    settings.plugins = [user];
    expect(resolvePlugins(settings).map((p) => p.name)).toEqual(["stencil", "react", "user"]);
  });
});

describe("analyzing a mixed-framework project in one pass", () => {
  it("extracts a Stencil and a React component together, each with its own paradigm", async () => {
    const dir = project({
      "src/button.tsx": STENCIL_BUTTON,
      "src/card.tsx": REACT_CARD,
    });
    const settings = defaultSettings();
    settings.frameworks = ["stencil", "react"];

    const outcome = await analyzeProject(settings, dir, { write: false });
    const declarations = declarationsOf(outcome.text);

    expect(declarations.map((d) => d.name).sort()).toEqual(["AcmeButton", "Card"]);
    expect(declarations.find((d) => d.name === "AcmeButton")?.identity.paradigmClass).toBe(
      "retained-dom",
    );
    expect(declarations.find((d) => d.name === "Card")?.identity.paradigmClass).toBe("vdom");
  });

  it("finds nothing for the framework that is not selected", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON, "src/card.tsx": REACT_CARD });
    const settings = defaultSettings();
    settings.frameworks = ["react"];

    const declarations = declarationsOf(
      (await analyzeProject(settings, dir, { write: false })).text,
    );
    expect(declarations.map((d) => d.name)).toEqual(["Card"]);
  });

  it("reports what each plugin produced in the run stats", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON, "src/card.tsx": REACT_CARD });
    const settings = defaultSettings();
    settings.frameworks = ["stencil", "react"];

    const { stats } = await analyzeProject(settings, dir, { write: false });
    expect(stats.perPlugin).toEqual([
      { plugin: "stencil", declarations: 1 },
      { plugin: "react", declarations: 1 },
    ]);
    expect(stats.declarations).toBe(2);
  });
});

describe("collision: two plugins claiming one declaration (first wins)", () => {
  /** Angular and Stencil both match `@Component`, so selecting both is the sharp case. */
  it("keeps the first plugin's entry and warns, attributing the dropped contribution", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON });
    const settings = defaultSettings();
    settings.frameworks = ["stencil", "angular"];

    const outcome = await analyzeProject(settings, dir, { write: false });
    const declarations = declarationsOf(outcome.text);

    expect(declarations).toHaveLength(1);
    expect(declarations[0].identity.paradigmClass).toBe("retained-dom"); // stencil ran first

    const duplicate = outcome.diagnostics.find((d) => d.code === "ACM-A-DUPENTRY");
    expect(duplicate?.severity).toBe("warning");
    expect(duplicate?.plugin).toBe("angular"); // the loser is blamed, not the winner
    expect(duplicate?.message).toMatch(/already claimed by plugin "stencil"/);
  });

  it("gives the other order the other winner (selection order is the tie-break)", async () => {
    const dir = project({ "src/button.tsx": STENCIL_BUTTON });
    const settings = defaultSettings();
    settings.frameworks = ["angular", "stencil"];

    const outcome = await analyzeProject(settings, dir, { write: false });
    expect(declarationsOf(outcome.text)[0].identity.paradigmClass).toBe("signals-di");
  });
});
