/**
 * The reusable single-run core: engine → emit.
 *
 * Shared by the CLI (one-shot runs and every watch cycle) and the conformance harness.
 * Kept separate from `cli.ts` so `watch.ts` can drive an analysis without importing the
 * CLI entry — that would form a `cli ↔ watch` import cycle.
 */

import { runEngine } from "./analyzer.js";
import { exitStatusFor, type Diagnostic } from "./diagnostics.js";
import { emit } from "./emit.js";
import { verifyExamples } from "./examples-verify.js";
import { resolvePlugins } from "./config.js";
import type { AnalyzerSettings } from "./types.js";

export interface AnalyzeOutcome {
  diagnostics: Diagnostic[];
  wrote: boolean;
  /** Canonical manifest text when produced; `null` when emission was aborted. */
  text: string | null;
  exitCode: number;
}

/** Run one analysis: engine → emit. The reusable core shared with the conformance harness. */
export async function analyzeProject(
  settings: AnalyzerSettings,
  cwd: string,
  opts: { write?: boolean } = {},
): Promise<AnalyzeOutcome> {
  const plugins = resolvePlugins(settings);
  const { diagnostics, moduleContexts } = await runEngine(settings, plugins, cwd);

  if (moduleContexts.length === 0) {
    return { diagnostics, wrote: false, text: null, exitCode: exitStatusFor(diagnostics, false) };
  }

  // Compile-verify examples before emit: non-compiling ones are pruned from the drafts and
  // reported (feature 003). A core gate, so one-shot and watch cycles both verify.
  const exampleDiagnostics = verifyExamples(moduleContexts);

  const emitted = emit(moduleContexts, { outdir: settings.outdir, cwd, write: opts.write });
  const all = [...diagnostics, ...exampleDiagnostics, ...emitted.diagnostics];
  const produced = emitted.text !== null;
  return {
    diagnostics: all,
    wrote: emitted.wrote,
    text: emitted.text,
    exitCode: exitStatusFor(all, produced),
  };
}
