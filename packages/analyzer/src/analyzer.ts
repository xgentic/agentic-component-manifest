/**
 * Framework-blind core engine (T013).
 *
 * Orchestrates the four-phase plugin lifecycle over discovered modules —
 * `collect → analyze → moduleLink → packageLink` — driving resolved plugins in a
 * fixed order (framework plugin first, then user plugins) and accumulating diagnostics.
 * The core carries no framework knowledge; every extraction happens in a plugin.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import {
  createModuleContext,
  createSessionContext,
  manifestDraft,
  type ModuleContextInternal,
  type SessionContextInternal,
} from "./context.js";
import { discover } from "./discover.js";
import type { Diagnostic } from "./diagnostics.js";
import type { AnalyzerPlugin } from "./plugin.js";
import { createTypeMapping } from "./type-mapping.js";
import type { AnalyzerSettings } from "./types.js";

export interface EngineResult {
  diagnostics: Diagnostic[];
  moduleContexts: ModuleContextInternal[];
}

/** The analyzed package's name, from the nearest `package.json` at `cwd`, or undefined. */
function resolvePackageName(cwd: string): string | undefined {
  try {
    const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"));
    return typeof pkg.name === "string" ? pkg.name : undefined;
  } catch {
    return undefined;
  }
}

/** Run one plugin hook, attributing any thrown error to it as a diagnostic. */
function runHook(ctx: SessionContextInternal, plugin: AnalyzerPlugin, fn: () => void, sink: Diagnostic[]): void {
  ctx._setActivePlugin(plugin.name);
  try {
    fn();
  } catch (err) {
    sink.push({
      code: "ACM-A-PLUGIN",
      severity: "error",
      plugin: plugin.name,
      message: (err as Error).message,
    });
  } finally {
    ctx._setActivePlugin(undefined);
  }
}

/** Discover, parse, and run the four phases. Returns module contexts ready for emit. */
export async function runEngine(
  settings: AnalyzerSettings,
  plugins: AnalyzerPlugin[],
  cwd: string,
): Promise<EngineResult> {
  const { modules, diagnostics } = await discover(settings.globs, settings.exclude, cwd, plugins);
  if (modules.length === 0) return { diagnostics, moduleContexts: [] };

  const types = createTypeMapping();
  const ctx = createSessionContext(settings, diagnostics, types, resolvePackageName(cwd));
  const moduleContexts = modules.map((m) =>
    createModuleContext(m.path, m.text, m.ast, m.container, m.remap),
  );

  // collect: per-module pre-pass, plugins in order.
  for (const module of moduleContexts) {
    for (const plugin of plugins) {
      if (plugin.collect) runHook(ctx, plugin, () => plugin.collect!(module, ctx), diagnostics);
    }
  }

  // analyze: per top-level declaration, in source order, plugins in order.
  for (const module of moduleContexts) {
    for (const statement of module.ast.statements) {
      for (const plugin of plugins) {
        if (plugin.analyze) runHook(ctx, plugin, () => plugin.analyze!(statement, module, ctx), diagnostics);
      }
    }
  }

  // moduleLink: per-module post-pass.
  for (const module of moduleContexts) {
    for (const plugin of plugins) {
      if (plugin.moduleLink) runHook(ctx, plugin, () => plugin.moduleLink!(module, ctx), diagnostics);
    }
  }

  // packageLink: whole-manifest post-pass.
  const draft = manifestDraft(moduleContexts);
  for (const plugin of plugins) {
    if (plugin.packageLink) runHook(ctx, plugin, () => plugin.packageLink!(draft, ctx), diagnostics);
  }

  return { diagnostics, moduleContexts };
}
