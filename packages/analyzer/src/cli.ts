#!/usr/bin/env -S npx tsx
/**
 * `acm-analyzer` CLI entry (T016, extended for US2/US3).
 *
 * The `analyze` subcommand is parsed with `node:util` `parseArgs` into explicit flag
 * overrides, then merged with a settings file (CLI > file > defaults) by `config.ts`.
 * A single run wires the engine to the emit pipeline; `--watch` re-analyzes on change.
 * Progress and diagnostics go to stderr (stdout is reserved for future piping); the
 * outcome maps to the exit-code contract (0 success · 3 warnings · 1 failure · 2 usage).
 */

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { EXIT, UsageError, isError, render } from "./diagnostics.js";
import { analyzeProject, type AnalyzeOutcome } from "./run.js";
import { normalizeFrameworks, resolveSettings, type CliArgs, type CliOverrides } from "./config.js";
import { runWatch } from "./watch.js";
import type { AnalyzerSettings } from "./types.js";

// Re-exported so the conformance harness and any embedder can drive a run without the CLI.
export { analyzeProject, type AnalyzeOutcome } from "./run.js";

/** Parse `analyze` flags into the explicit `--config` path and per-field CLI overrides. */
export function parseCliArgs(argv: string[]): CliArgs {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        config: { type: "string" },
        globs: { type: "string", multiple: true },
        exclude: { type: "string", multiple: true },
        outdir: { type: "string" },
        framework: { type: "string", multiple: true },
        watch: { type: "boolean" },
        dev: { type: "boolean" },
        quiet: { type: "boolean" },
      },
    });
  } catch (err) {
    throw new UsageError((err as Error).message);
  }

  const [subcommand] = parsed.positionals;
  if (subcommand !== "analyze") {
    throw new UsageError(`unknown or missing subcommand "${subcommand ?? ""}"; expected "analyze"`);
  }

  const { values } = parsed;
  const overrides: CliOverrides = {};
  if (values.globs?.length) overrides.globs = values.globs;
  if (values.exclude?.length) overrides.exclude = values.exclude;
  if (values.outdir !== undefined) overrides.outdir = values.outdir;
  // `--framework` is repeatable and comma-separated: `--framework a --framework b` and
  // `--framework a,b` both select the same ordered pair.
  if (values.framework?.length) {
    overrides.frameworks = normalizeFrameworks(values.framework, "--framework");
  }
  if (values.watch) overrides.watch = true;
  if (values.dev) overrides.dev = true;
  if (values.quiet) overrides.quiet = true;
  return { configPath: values.config, overrides };
}

/** Print an outcome's diagnostics + write notice, honoring `--quiet`. */
function printOutcome(settings: AnalyzerSettings, outcome: AnalyzeOutcome): void {
  const printable = settings.quiet ? outcome.diagnostics.filter(isError) : outcome.diagnostics;
  if (printable.length) process.stderr.write(render(printable) + "\n");
  if (!settings.quiet && outcome.wrote) {
    process.stderr.write(
      `acm-analyzer: wrote ${settings.outdir}/agentic-component-manifest.json\n`,
    );
  }
}

/** One `--dev` trace line on stderr, under the tool's prefix. */
function devLog(line: string): void {
  process.stderr.write(`acm-analyzer: ${line}\n`);
}

/** Verbose (`--dev`) startup summary of the resolved configuration. */
function logResolved(settings: AnalyzerSettings, cwd: string): void {
  const from = settings.config ? `config ${settings.config}` : "defaults + flags";
  const frameworks = settings.frameworks.length
    ? settings.frameworks.join(", ")
    : "vanilla (default)";
  devLog(`cwd=${cwd}`);
  devLog(
    `frameworks=${frameworks} outdir=${settings.outdir} ` +
      `globs=${JSON.stringify(settings.globs)} exclude=${JSON.stringify(settings.exclude)} ` +
      `plugins=${settings.plugins.length} (from ${from})`,
  );
}

/** Watch loop: run until interrupted (SIGINT/SIGTERM), then close cleanly with exit 0. */
async function runWatchMode(settings: AnalyzerSettings, cwd: string): Promise<number> {
  if (!settings.quiet) {
    process.stderr.write(`acm-analyzer: watching ${cwd} (${settings.globs.join(", ")})\n`);
  }
  const controller = await runWatch(settings, cwd, {
    write: true,
    log: settings.quiet ? undefined : (line) => process.stderr.write(line + "\n"),
    trace: settings.dev ? devLog : undefined,
    onCycle: (outcome) => printOutcome(settings, outcome),
  });

  return await new Promise<number>((resolve) => {
    const stop = (): void => {
      void controller.close().then(() => resolve(EXIT.SUCCESS));
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

/** CLI main: returns the process exit code. */
export async function main(argv: string[]): Promise<number> {
  let settings: AnalyzerSettings;
  const cwd = process.cwd();
  try {
    settings = await resolveSettings(parseCliArgs(argv), cwd);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`error: ${err.message}\n`);
      return EXIT.USAGE;
    }
    throw err;
  }

  if (settings.dev) logResolved(settings, cwd);

  if (settings.watch) return runWatchMode(settings, cwd);

  if (!settings.quiet) process.stderr.write(`acm-analyzer: analyzing ${cwd}\n`);
  const outcome = await analyzeProject(settings, cwd, { write: true, log: devLog });
  printOutcome(settings, outcome);
  return outcome.exitCode;
}

/**
 * Run only when this module *is* the entry point — the conformance harness imports it
 * for `analyzeProject`. Compared through `realpath` because an installed CLI is invoked
 * via a `node_modules/.bin` symlink, whose path never equals `import.meta.url`.
 */
function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
