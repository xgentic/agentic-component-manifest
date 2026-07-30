/**
 * Source discovery and parse (T012).
 *
 * Deterministic `tinyglobby` include/exclude, lexicographic order, POSIX-relative
 * paths, and syntax-only `ts.createSourceFile` (no program, no checker, no
 * `node_modules` resolution). A per-file parse error is a diagnostic and the file is
 * skipped; zero matches is fatal (never a silent empty manifest).
 */

import { readFileSync } from "node:fs";
import { glob } from "tinyglobby";
import ts from "typescript";
import type { Diagnostic } from "./diagnostics.js";
import type { AnalyzerPlugin } from "./plugin.js";
import type { SourceModule } from "./types.js";

function scriptKindOf(path: string): ts.ScriptKind {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".cjs"))
    return ts.ScriptKind.JS;
  // .vue script blocks and plain .ts/.mts/.cts parse as TS.
  return ts.ScriptKind.TS;
}

export interface DiscoverResult {
  modules: SourceModule[];
  diagnostics: Diagnostic[];
  /** Every path the include/exclude globs matched, sorted — parsed or not (`--dev`). */
  matched: string[];
}

/**
 * Glob, preprocess (container formats), and parse. `cwd` is the invocation directory;
 * returned module paths are project-relative with POSIX separators.
 */
export async function discover(
  globs: string[],
  exclude: string[],
  cwd: string,
  plugins: AnalyzerPlugin[],
): Promise<DiscoverResult> {
  const diagnostics: Diagnostic[] = [];
  const matches = await glob(globs, { cwd, ignore: exclude, dot: false, absolute: false });
  const paths = [...matches].sort();

  if (paths.length === 0) {
    const excluded = exclude.length ? `, excluding ${JSON.stringify(exclude)}` : "";
    diagnostics.push({
      code: "ACM-A-NOFILES",
      severity: "error",
      message:
        `no source files matched ${JSON.stringify(globs)}${excluded} under ${cwd} — ` +
        `check that the run directory is the package root, or pass --globs`,
    });
    return { modules: [], diagnostics, matched: paths };
  }

  const modules: SourceModule[] = [];
  for (const path of paths) {
    let raw: string;
    try {
      raw = readFileSync(`${cwd}/${path}`, "utf8");
    } catch (err) {
      diagnostics.push({
        code: "ACM-A-READ",
        severity: "warning",
        file: path,
        message: `could not read file: ${(err as Error).message}`,
      });
      continue;
    }

    // Container-format unwrap: first plugin whose preprocess claims the file wins.
    let text = raw;
    let container: "ts" | "sfc" = "ts";
    let remap = (offset: number): number => offset;
    for (const plugin of plugins) {
      const result = plugin.preprocess?.({ path, text: raw });
      if (result) {
        text = result.text;
        container = "sfc";
        if (result.remap) remap = result.remap;
        break;
      }
    }

    const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKindOf(path));
    const parseErrors = (ast as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics ?? [];
    if (parseErrors.length > 0) {
      diagnostics.push({
        code: "ACM-A-PARSE",
        severity: "warning",
        file: path,
        message: `parse error; file skipped (${parseErrors.length} syntax diagnostic(s))`,
      });
      continue;
    }

    modules.push({ path, text, ast, container, remap });
  }

  if (modules.length === 0) {
    diagnostics.push({
      code: "ACM-A-NOFILES",
      severity: "error",
      message: `every matched file failed to parse (${paths.length}); no manifest produced`,
    });
  }

  return { modules, diagnostics, matched: paths };
}
