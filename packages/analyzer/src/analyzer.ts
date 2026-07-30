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
import { detectFrameworks, type FrameworkSighting } from "./detect.js";
import { discover } from "./discover.js";
import type { Diagnostic } from "./diagnostics.js";
import type { AnalyzerPlugin } from "./plugin.js";
import { createTypeMapping } from "./type-mapping.js";
import type { AnalyzerSettings } from "./types.js";

/**
 * What one engine run observed, for `--dev` reporting and the "nothing came out" hints.
 * Counts only; never influences the manifest (an observed run and an unobserved one
 * produce byte-identical output).
 */
export interface RunStats {
  /** Every path the globs matched, sorted — parsed or not. */
  matched: string[];
  /** Matched files that parsed and were analyzed. */
  parsed: number;
  /** Matched files skipped as unreadable or unparseable. */
  skipped: number;
  /** Per-module declaration counts, in module order (zero-count modules included). */
  perModule: Array<{ path: string; declarations: number }>;
  /** Declarations produced per plugin, in plugin-execution order (zeros included). */
  perPlugin: Array<{ plugin: string; declarations: number }>;
  /** Total declarations that survived into the drafts. */
  declarations: number;
  /** Which frameworks the parsed sources import (diagnostic only, never selective). */
  detected: FrameworkSighting[];
}

export interface EngineResult {
  diagnostics: Diagnostic[];
  moduleContexts: ModuleContextInternal[];
  stats: RunStats;
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
function runHook(
  ctx: SessionContextInternal,
  plugin: AnalyzerPlugin,
  fn: () => void,
  sink: Diagnostic[],
): void {
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
  const { modules, diagnostics, matched } = await discover(
    settings.globs,
    settings.exclude,
    cwd,
    plugins,
  );
  if (modules.length === 0) {
    return { diagnostics, moduleContexts: [], stats: emptyStats(matched) };
  }

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
        if (plugin.analyze)
          runHook(ctx, plugin, () => plugin.analyze!(statement, module, ctx), diagnostics);
      }
    }
  }

  // moduleLink: per-module post-pass.
  for (const module of moduleContexts) {
    for (const plugin of plugins) {
      if (plugin.moduleLink)
        runHook(ctx, plugin, () => plugin.moduleLink!(module, ctx), diagnostics);
    }
  }

  // packageLink: whole-manifest post-pass.
  const draft = manifestDraft(moduleContexts);
  for (const plugin of plugins) {
    if (plugin.packageLink)
      runHook(ctx, plugin, () => plugin.packageLink!(draft, ctx), diagnostics);
  }

  return { diagnostics, moduleContexts, stats: collectStats(matched, moduleContexts, plugins) };
}

/** Stats for a run that produced no analyzable module (zero matches, or all unparseable). */
function emptyStats(matched: string[]): RunStats {
  return {
    matched,
    parsed: 0,
    skipped: matched.length,
    perModule: [],
    perPlugin: [],
    declarations: 0,
    detected: [],
  };
}

/** Tally what the run observed: files, per-module and per-plugin yields, framework census. */
function collectStats(
  matched: string[],
  moduleContexts: ModuleContextInternal[],
  plugins: AnalyzerPlugin[],
): RunStats {
  const byPlugin = new Map(plugins.map((p) => [p.name, 0]));
  let declarations = 0;
  const perModule = moduleContexts.map((module) => {
    for (const entry of module._entries) {
      declarations++;
      // An entry's creator is always a plugin that ran this session; `?? name` only
      // guards the theoretical case of a draft created outside a hook.
      const creator = entry.creator ?? "unknown";
      byPlugin.set(creator, (byPlugin.get(creator) ?? 0) + 1);
    }
    return { path: module.path, declarations: module._entries.length };
  });

  return {
    matched,
    parsed: moduleContexts.length,
    skipped: matched.length - moduleContexts.length,
    perModule,
    perPlugin: [...byPlugin].map(([plugin, count]) => ({ plugin, declarations: count })),
    declarations,
    detected: detectFrameworks(moduleContexts),
  };
}
