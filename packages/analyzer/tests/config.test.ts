/**
 * US3 settings-file loading + precedence (T038, optional layer).
 *
 * Covers the config-file contract (contracts/config-file.md): auto-discovery, native
 * `import()` of the default export, key/type validation, plugin-shape validation, the
 * CLI > file > defaults precedence (list options replaced, not merged), and the rule
 * that any malformed file is a fatal `UsageError` (exit 2) — never a silent fallback.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  loadConfigFile,
  mergeSettings,
  resolveSettings,
  validateFileConfig,
} from "../src/config.js";
import { UsageError } from "../src/diagnostics.js";

const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "acm-config-"));
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

let counter = 0;
/** A fresh temp directory so every settings file has a unique path (import cache). */
function tmpDir(): string {
  const dir = path.join(tmpRoot, `case-${counter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function write(dir: string, basename: string, body: string): void {
  writeFileSync(path.join(dir, basename), body, "utf8");
}

describe("validateFileConfig: shape + key validation (fatal, never silent)", () => {
  it("rejects an unknown key naming it and the allowed set", () => {
    expect(() => validateFileConfig({ framwork: "lit" }, "c.js")).toThrow(UsageError);
    expect(() => validateFileConfig({ framwork: "lit" }, "c.js")).toThrow(/unknown key "framwork"/);
  });

  it("rejects a non-object default export", () => {
    expect(() => validateFileConfig(null, "c.js")).toThrow(/configuration object/);
    expect(() => validateFileConfig([1, 2], "c.js")).toThrow(/configuration object/);
    expect(() => validateFileConfig("nope", "c.js")).toThrow(/configuration object/);
  });

  it("rejects type-invalid fields", () => {
    expect(() => validateFileConfig({ globs: "src/**" }, "c.js")).toThrow(
      /"globs" must be an array/,
    );
    expect(() => validateFileConfig({ outdir: 5 }, "c.js")).toThrow(/"outdir" must be a string/);
    expect(() => validateFileConfig({ quiet: "yes" }, "c.js")).toThrow(/"quiet" must be a boolean/);
  });

  it("rejects an unknown framework naming the supported set", () => {
    expect(() => validateFileConfig({ framework: "svelte" }, "c.js")).toThrow(/unknown framework/);
    expect(() => validateFileConfig({ framework: "svelte" }, "c.js")).toThrow(
      /lit, angular, react/,
    );
  });

  it("rejects a plugin entry with no name or no hook, naming the index", () => {
    expect(() => validateFileConfig({ plugins: [{ analyze() {} }] }, "c.js")).toThrow(
      /plugins\[0\] is missing a string "name"/,
    );
    expect(() => validateFileConfig({ plugins: [{ name: "noop" }] }, "c.js")).toThrow(
      /plugins\[0\] \("noop"\) defines no lifecycle hook/,
    );
  });

  it("accepts a fully-populated valid config", () => {
    const cfg = validateFileConfig(
      {
        globs: ["src/**/*.ts"],
        exclude: ["**/*.test.ts"],
        outdir: "dist",
        framework: "lit",
        dev: false,
        quiet: true,
        watch: false,
        plugins: [{ name: "enrich", analyze() {} }],
      },
      "c.js",
    );
    expect(cfg.framework).toBe("lit");
    expect(cfg.plugins).toHaveLength(1);
    expect(cfg.exclude).toEqual(["**/*.test.ts"]);
  });
});

describe("loadConfigFile: discovery + native import (fatal on any problem)", () => {
  it("returns undefined when no file is present and none is requested", async () => {
    expect(await loadConfigFile(tmpDir(), undefined)).toBeUndefined();
  });

  it("auto-discovers acm-analyzer.config.mjs and imports the default export", async () => {
    const dir = tmpDir();
    write(dir, "acm-analyzer.config.mjs", `export default { outdir: "dist", framework: "lit" };`);
    const loaded = await loadConfigFile(dir, undefined);
    expect(loaded?.path).toBe("acm-analyzer.config.mjs");
    expect(loaded?.config.outdir).toBe("dist");
    expect(loaded?.config.framework).toBe("lit");
  });

  it("prefers .js over .mjs when both exist", async () => {
    const dir = tmpDir();
    write(dir, "package.json", `{ "type": "module" }`); // make .js parse as ESM
    write(dir, "acm-analyzer.config.js", `export default { outdir: "from-js" };`);
    write(dir, "acm-analyzer.config.mjs", `export default { outdir: "from-mjs" };`);
    const loaded = await loadConfigFile(dir, undefined);
    expect(loaded?.path).toBe("acm-analyzer.config.js");
    expect(loaded?.config.outdir).toBe("from-js");
  });

  it("loads an explicit --config path", async () => {
    const dir = tmpDir();
    write(dir, "custom.mjs", `export default { framework: "react" };`);
    const loaded = await loadConfigFile(dir, "custom.mjs");
    expect(loaded?.config.framework).toBe("react");
  });

  it("is fatal when an explicit --config path is missing", async () => {
    await expect(loadConfigFile(tmpDir(), "nope.mjs")).rejects.toThrow(/settings file not found/);
  });

  it("is fatal (naming the file) when the file throws on import", async () => {
    const dir = tmpDir();
    write(dir, "throws.mjs", `throw new Error("boom");`);
    await expect(loadConfigFile(dir, "throws.mjs")).rejects.toThrow(/throws\.mjs: failed to load/);
  });

  it("is fatal when the file has no default export", async () => {
    const dir = tmpDir();
    write(dir, "nodefault.mjs", `export const x = 1;`);
    await expect(loadConfigFile(dir, "nodefault.mjs")).rejects.toThrow(/missing a default export/);
  });
});

describe("mergeSettings: CLI > file > defaults, lists replaced not merged", () => {
  it("uses defaults when neither file nor CLI sets a field", () => {
    const s = mergeSettings(undefined, {});
    expect(s.outdir).toBe(".");
    expect(s.globs).toEqual(["src/**/*.{js,ts,jsx,tsx}"]);
    expect(s.framework).toBeUndefined();
  });

  it("lets the file override defaults", () => {
    const s = mergeSettings({ outdir: "dist", framework: "angular" }, {});
    expect(s.outdir).toBe("dist");
    expect(s.framework).toBe("angular");
  });

  it("lets a CLI flag override the file field-by-field", () => {
    const s = mergeSettings({ outdir: "dist", framework: "angular" }, { outdir: "out2" });
    expect(s.outdir).toBe("out2"); // CLI wins
    expect(s.framework).toBe("angular"); // untouched file value survives
  });

  it("replaces list options entirely (no merge)", () => {
    const s = mergeSettings({ globs: ["a/**"], exclude: ["x"] }, { globs: ["b/**"] });
    expect(s.globs).toEqual(["b/**"]); // replaced, not ['a/**','b/**']
    expect(s.exclude).toEqual(["x"]); // file value kept
  });
});

describe("resolveSettings: precedence + records path + dev/quiet exclusion", () => {
  it("records the resolved config path and applies precedence end-to-end", async () => {
    const dir = tmpDir();
    write(dir, "acm-analyzer.config.mjs", `export default { outdir: "dist", framework: "lit" };`);
    const settings = await resolveSettings(
      { configPath: undefined, overrides: { framework: "react" } },
      dir,
    );
    expect(settings.config).toBe("acm-analyzer.config.mjs");
    expect(settings.outdir).toBe("dist"); // from file
    expect(settings.framework).toBe("react"); // CLI override wins
  });

  it("is fatal when the merged result sets both dev and quiet", async () => {
    const dir = tmpDir();
    write(dir, "acm-analyzer.config.mjs", `export default { quiet: true };`);
    await expect(
      resolveSettings({ configPath: undefined, overrides: { dev: true } }, dir),
    ).rejects.toThrow(/mutually exclusive/);
  });

  it("leaves config undefined when no file is discovered", async () => {
    const settings = await resolveSettings({ configPath: undefined, overrides: {} }, tmpDir());
    expect(settings.config).toBeUndefined();
  });
});
