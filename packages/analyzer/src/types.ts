/**
 * Analyzer runtime model (data-model.md). These are the analyzer's own types — the
 * emitted Manifest is defined by the schema in `@xgentic/acm-spec`, never redefined here.
 */

import type ts from "typescript";
import type { AnalyzerPlugin } from "./plugin.js";
import type { Diagnostic } from "./diagnostics.js";

/**
 * Built-in framework names selectable via the generic `framework` option. `vanilla` is
 * both the default (when none is named) and an explicit choice, so a project that mixes
 * plain custom elements with a framework can select both.
 */
export const BUILTIN_FRAMEWORKS = ["vanilla", "lit", "stencil", "angular", "react"] as const;
export type BuiltinFramework = (typeof BUILTIN_FRAMEWORKS)[number];

/** Default include globs when the user supplies none (plugins may extend, not replace). */
export const DEFAULT_GLOBS = ["src/**/*.{js,ts,jsx,tsx}"] as const;

/** Resolved configuration: the merge of CLI flags > settings file > defaults. */
export interface AnalyzerSettings {
  /** Include patterns; plugin `fileExtensions` extend the DEFAULT globs only. */
  globs: string[];
  /** Exclude patterns. */
  exclude: string[];
  /** Output directory; the manifest is always written as `<outdir>/agentic-component-manifest.json`. */
  outdir: string;
  /**
   * Built-in framework names, in the order their plugins run. Empty selects the vanilla
   * default; more than one analyzes a mixed-framework project in a single pass.
   */
  frameworks: BuiltinFramework[];
  /** Verbose diagnostics to stderr. */
  dev: boolean;
  /** Suppress progress (errors still print). Mutually exclusive with `dev`. */
  quiet: boolean;
  /** Re-analyze on change. */
  watch: boolean;
  /** External plugins (settings-file only), run after the framework plugin, in order. */
  plugins: AnalyzerPlugin[];
  /** Explicit settings-file path (auto-discovered when absent). */
  config: string | undefined;
}

/** Default resolved settings; the base every merge starts from. */
export function defaultSettings(): AnalyzerSettings {
  return {
    globs: [...DEFAULT_GLOBS],
    exclude: [],
    outdir: ".",
    frameworks: [],
    dev: false,
    quiet: false,
    watch: false,
    plugins: [],
    config: undefined,
  };
}

/** One parsed source module (data-model.md). */
export interface SourceModule {
  /** Project-relative path, POSIX separators (determinism across OS). */
  path: string;
  /** Raw UTF-8 text of the parsed script; source of all verbatim extraction. */
  text: string;
  /** Syntax-only AST (no program, no checker). */
  ast: ts.SourceFile;
  /** `sfc` modules carry an offset remap so diagnostics point into the original file. */
  container: "ts" | "sfc";
  /** Map an offset in `text` back to the original file (identity for `ts`). */
  remap(offset: number): number;
}

/** One run of the engine (one-shot, or one watch cycle). */
export interface AnalysisSession {
  settings: AnalyzerSettings;
  plugins: AnalyzerPlugin[];
  modules: SourceModule[];
  diagnostics: Diagnostic[];
  /** Canonical manifest text, or `null` when no valid manifest could be produced. */
  result: string | null;
}
