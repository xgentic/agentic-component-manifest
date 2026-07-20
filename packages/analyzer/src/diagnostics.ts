/**
 * Analyzer diagnostics (`ACM-A-*`) and the exit-status mapping (data-model.md, R-11).
 *
 * The analyzer owns a diagnostic shape richer than the toolchain's validator
 * diagnostic (it carries a file/span and plugin attribution); it is rendered for the
 * terminal through the toolchain's `renderDiagnostics` by projecting onto the
 * validator diagnostic shape.
 */

import { renderDiagnostics, type Diagnostic as ToolchainDiagnostic } from "@acm/toolchain";

/** A source location, remapped to the ORIGINAL file for SFC containers. */
export interface Span {
  /** 1-based line. */
  line: number;
  /** 1-based column. */
  col: number;
}

export interface Diagnostic {
  /** `ACM-A-*` namespace (analyzer-owned; distinct from the validator's `ACM-V-*`). */
  code: string;
  severity: "error" | "warning";
  /** Project-relative POSIX path, when the diagnostic is about a specific file. */
  file?: string;
  span?: Span;
  message: string;
  /** Attribution when raised by or about a plugin. */
  plugin?: string;
}

/**
 * Doc-metadata diagnostic codes (feature 003, research R-07). All are `warning` severity
 * (exit 3, manifest still written): `semantics`/`examples` are optional Tier-2 content, so
 * a malformed annotation degrades to "field absent + diagnostic", never a failed build.
 * Kept here as the single reference registry; call sites emit the string literal.
 */
export const DOC_METADATA_CODES = {
  /** `@acmSemantic` term missing or not in the controlled vocabulary; semantics dropped. */
  SEMTERM: "ACM-A-SEMTERM",
  /** More than one `@acmSemantic` on a declaration; first wins, extras dropped. */
  SEMDUP: "ACM-A-SEMDUP",
  /** `@example` fence declares an unsupported language; example dropped. */
  EXLANG: "ACM-A-EXLANG",
  /** `@example` block has no code body; example dropped. */
  EXEMPTY: "ACM-A-EXEMPTY",
  /** Example failed to compile against the component; example dropped. */
  EXCOMPILE: "ACM-A-EXCOMPILE",
  /** A notes/example value exceeds a structural limit (or > 32 examples); item dropped. */
  EXLIMIT: "ACM-A-EXLIMIT",
} as const;

/** Analyzer exit codes (contract cli.md). */
export const EXIT = {
  /** Success, no diagnostics. */
  SUCCESS: 0,
  /** Failure — no valid manifest could be produced. */
  FAILURE: 1,
  /** Usage or configuration error. */
  USAGE: 2,
  /** Completed with warnings; manifest written. */
  WARNINGS: 3,
} as const;

export class UsageError extends Error {
  readonly code = EXIT.USAGE;
}

export function isError(d: Diagnostic): boolean {
  return d.severity === "error";
}

/**
 * Map an analysis outcome to a process exit code. `produced` is whether a valid
 * manifest was produced (independent of whether it was written to disk). Usage/config
 * errors (exit 2) are raised as `UsageError` before analysis and handled by the CLI.
 */
export function exitStatusFor(diagnostics: Diagnostic[], produced: boolean): number {
  if (diagnostics.some(isError)) return EXIT.FAILURE;
  if (!produced) return EXIT.FAILURE;
  if (diagnostics.length > 0) return EXIT.WARNINGS;
  return EXIT.SUCCESS;
}

function toToolchain(d: Diagnostic): ToolchainDiagnostic {
  const loc = d.file ? (d.span ? `${d.file}:${d.span.line}:${d.span.col}` : d.file) : "";
  const prefix = d.plugin ? `[${d.plugin}] ` : "";
  return { ruleId: d.code, pointer: loc, message: `${prefix}${d.message}` };
}

/** Render analyzer diagnostics for the terminal via the toolchain renderer. */
export function render(diagnostics: Diagnostic[], asJson = false): string {
  return renderDiagnostics(diagnostics.map(toToolchain), asJson);
}
