/**
 * The reusable single-run core: engine → emit.
 *
 * Shared by the CLI (one-shot runs and every watch cycle) and the conformance harness.
 * Kept separate from `cli.ts` so `watch.ts` can drive an analysis without importing the
 * CLI entry — that would form a `cli ↔ watch` import cycle.
 *
 * It also owns the run's *observability*: the `--dev` trace (what was discovered, what
 * each plugin produced, what the sources import) and the mismatch hint that turns a
 * silent empty manifest into an actionable diagnostic. Observation never changes the
 * output — an observed run and an unobserved one are byte-identical (SC-002).
 */

import { runEngine, type RunStats } from "./analyzer.js";
import { unselected } from "./detect.js";
import { exitStatusFor, type Diagnostic } from "./diagnostics.js";
import { emit } from "./emit.js";
import { verifyExamples } from "./examples-verify.js";
import { resolvePlugins } from "./config.js";
import type { AnalyzerPlugin } from "./plugin.js";
import type { AnalyzerSettings, BuiltinFramework } from "./types.js";

export interface AnalyzeOutcome {
  diagnostics: Diagnostic[];
  wrote: boolean;
  /** Canonical manifest text when produced; `null` when emission was aborted. */
  text: string | null;
  exitCode: number;
  /** What the run observed (counts only) — the `--dev` trace's data. */
  stats: RunStats;
}

export interface AnalyzeOptions {
  /** When false, validate and canonicalize but do not touch disk. */
  write?: boolean;
  /**
   * Verbose trace sink; one call per line, unprefixed. Only consulted when `settings.dev`
   * is set, so a caller can always pass it.
   */
  log?: (line: string) => void;
}

/** How many paths a `--dev` file listing prints before collapsing into a count. */
export const TRACE_LIST_CAP = 25;

/** The frameworks actually driving the run — an empty selection means vanilla. */
export function activeFrameworks(settings: AnalyzerSettings): BuiltinFramework[] {
  return settings.frameworks.length ? settings.frameworks : ["vanilla"];
}

/** Print a capped, indented path listing. */
function listing(log: (line: string) => void, paths: readonly string[]): void {
  for (const path of paths.slice(0, TRACE_LIST_CAP)) log(`  ${path}`);
  if (paths.length > TRACE_LIST_CAP) log(`  … ${paths.length - TRACE_LIST_CAP} more`);
}

/**
 * The `--dev` trace. Ordered to answer "why did I get nothing?" top-down: were files
 * found, did they parse, which plugins ran, what do the sources actually import, what did
 * each plugin yield, and which files yielded nothing.
 */
function traceRun(
  log: (line: string) => void,
  settings: AnalyzerSettings,
  plugins: AnalyzerPlugin[],
  stats: RunStats,
): void {
  const excluded = settings.exclude.length
    ? ` excluding ${JSON.stringify(settings.exclude)}`
    : " (no excludes)";
  log(
    `discovered ${stats.matched.length} file(s) matching ${JSON.stringify(settings.globs)}${excluded}`,
  );
  listing(log, stats.matched);
  log(`parsed ${stats.parsed} file(s), skipped ${stats.skipped}`);
  log(`plugins: ${plugins.map((p) => p.name).join(" → ")}`);

  const census = stats.detected.length
    ? stats.detected
        .map((s) => `${s.framework} ("${s.specifier}", ${s.files.length} file(s))`)
        .join(", ")
    : "none";
  log(`framework imports detected: ${census}`);

  for (const { plugin, declarations } of stats.perPlugin) {
    log(`  ${plugin}: ${declarations} declaration(s)`);
  }

  const barren = stats.perModule.filter((m) => m.declarations === 0).map((m) => m.path);
  if (barren.length) {
    log(`${barren.length} parsed file(s) yielded no declarations:`);
    listing(log, barren);
  }
  log(
    `summary: ${stats.matched.length} file(s) scanned · ` +
      `${stats.perModule.length - barren.length} module(s) with declarations · ` +
      `${stats.declarations} declaration(s)`,
  );
}

/**
 * The hint that rescues a silent empty run: nothing was extracted, yet the sources import
 * a framework nobody selected. Raised only in that exact case, so a healthy build never
 * pays a warning for a project that legitimately mixes frameworks.
 */
function frameworkMismatch(settings: AnalyzerSettings, stats: RunStats): Diagnostic | undefined {
  if (stats.declarations > 0 || stats.parsed === 0) return undefined;
  const active = activeFrameworks(settings);
  const missing = unselected(stats.detected, active);
  if (missing.length === 0) return undefined;

  const seen = missing
    .map((s) => `${s.files.length} file(s) import "${s.specifier}"`)
    .join(" and ");
  return {
    code: "ACM-A-FRAMEWORK",
    severity: "warning",
    message:
      `no declarations found, but ${seen} while the active framework selection is ` +
      `${active.join(", ")} — re-run with --framework ${missing.map((s) => s.framework).join(",")}`,
  };
}

/** Run one analysis: engine → emit. The reusable core shared with the conformance harness. */
export async function analyzeProject(
  settings: AnalyzerSettings,
  cwd: string,
  opts: AnalyzeOptions = {},
): Promise<AnalyzeOutcome> {
  const plugins = resolvePlugins(settings);
  const { diagnostics, moduleContexts, stats } = await runEngine(settings, plugins, cwd);
  if (settings.dev && opts.log) traceRun(opts.log, settings, plugins, stats);

  if (moduleContexts.length === 0) {
    return {
      diagnostics,
      wrote: false,
      text: null,
      exitCode: exitStatusFor(diagnostics, false),
      stats,
    };
  }

  // Compile-verify examples before emit: non-compiling ones are pruned from the drafts and
  // reported (feature 003). A core gate, so one-shot and watch cycles both verify.
  const exampleDiagnostics = verifyExamples(moduleContexts);

  const emitted = emit(moduleContexts, {
    outdir: settings.outdir,
    cwd,
    write: opts.write,
    scanned: stats.matched.length,
    frameworks: activeFrameworks(settings),
  });
  const mismatch = frameworkMismatch(settings, stats);
  const all = [
    ...diagnostics,
    ...exampleDiagnostics,
    ...emitted.diagnostics,
    ...(mismatch ? [mismatch] : []),
  ];
  const produced = emitted.text !== null;
  return {
    diagnostics: all,
    wrote: emitted.wrote,
    text: emitted.text,
    exitCode: exitStatusFor(all, produced),
    stats,
  };
}
