/**
 * Watch mode (T037).
 *
 * A `chokidar` watcher over the include globs' static base directories re-runs the
 * session on every source change, debounced 100 ms. Each cycle goes through the same
 * atomic emit as a one-shot run, so a write is never partial and an unchanged input
 * reproduces byte-identical output (SC-002). A per-cycle failure (parse error, zero
 * matches, validation failure) reports a diagnostic and keeps watching — only exit-2
 * usage/config errors terminate, and those are raised before watching begins.
 *
 * chokidar v4 no longer expands globs, so we watch the globs' magic-free base
 * directories and let `discover()` re-apply the real include/exclude every cycle.
 */

import path from "node:path";
import { watch as chokidarWatch } from "chokidar";
import { analyzeProject, type AnalyzeOutcome } from "./run.js";
import type { AnalyzerSettings } from "./types.js";

/** Coalesce a burst of filesystem events into one re-analysis. */
export const DEBOUNCE_MS = 100;

export interface WatchOptions {
  /** Whether each cycle writes `<outdir>/agentic-component-manifest.json` (default true). */
  write?: boolean;
  /** Lifecycle progress lines (e.g. "change detected"); suppressed by the CLI when quiet. */
  log?: (line: string) => void;
  /** Per-cycle `--dev` trace sink, forwarded to `analyzeProject` (see `AnalyzeOptions`). */
  trace?: (line: string) => void;
  /** Invoked after every cycle (initial run included) with its outcome and trigger path. */
  onCycle?: (outcome: AnalyzeOutcome, trigger: string) => void;
}

export interface WatchController {
  /** Resolves once the initial run is done and the watcher is listening. */
  ready: Promise<void>;
  /** Stop watching and release the debounce timer. */
  close(): Promise<void>;
}

/**
 * The magic-free leading directory of a glob (relative to cwd). `src/**\/*.ts` → `src`;
 * `**\/*.ts` → `.`. Watching this directory and re-globbing on change is correct
 * regardless of the pattern's precision.
 */
export function globBase(glob: string): string {
  const magic = /[*?{}[\]()!+@]/;
  const base: string[] = [];
  for (const segment of glob.split("/")) {
    if (magic.test(segment)) break;
    base.push(segment);
  }
  return base.join("/") || ".";
}

/**
 * Start watching. Performs one immediate analysis, then re-analyzes on change. The
 * returned controller exposes `ready` (initial run + watcher listening) and `close()`.
 */
export async function runWatch(
  settings: AnalyzerSettings,
  cwd: string,
  opts: WatchOptions = {},
): Promise<WatchController> {
  const write = opts.write ?? true;
  const log = opts.log ?? (() => {});
  const outFile = path.resolve(cwd, settings.outdir, "agentic-component-manifest.json");

  const cycle = async (trigger: string): Promise<void> => {
    const outcome = await analyzeProject(settings, cwd, { write, log: opts.trace });
    opts.onCycle?.(outcome, trigger);
  };

  // Initial run before the watcher starts, so the manifest exists immediately.
  await cycle("(initial)");

  const roots = [...new Set(settings.globs.map(globBase))];
  const watcher = chokidarWatch(roots, {
    cwd,
    ignoreInitial: true,
    persistent: true,
    ignored: (target: string) => {
      const parts = target.split(path.sep);
      if (parts.includes("node_modules") || parts.includes(".git")) return true;
      // Never react to our own output (would self-trigger an endless loop).
      const abs = path.isAbsolute(target) ? target : path.resolve(cwd, target);
      if (abs === outFile) return true;
      return path.basename(target).startsWith(".agentic-component-manifest.json.");
    },
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let pending: string | undefined;

  const fire = async (): Promise<void> => {
    if (running) return; // an active run will pick up `pending` when it finishes
    running = true;
    try {
      while (pending !== undefined) {
        const trigger = pending;
        pending = undefined;
        log(`acm-analyzer: change detected (${trigger}); re-analyzing`);
        await cycle(trigger);
      }
    } finally {
      running = false;
    }
  };

  const schedule = (trigger: string): void => {
    pending = trigger;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void fire(), DEBOUNCE_MS);
  };

  watcher.on("add", schedule);
  watcher.on("change", schedule);
  watcher.on("unlink", schedule);

  const ready = new Promise<void>((resolve) => watcher.once("ready", () => resolve()));

  return {
    ready,
    async close() {
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
