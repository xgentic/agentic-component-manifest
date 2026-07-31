/**
 * Framework census: which frameworks the analyzed sources actually import.
 *
 * Purely diagnostic — it never selects a plugin (that stays an explicit operator
 * decision, so a run is reproducible from its flags alone). Its job is to answer the
 * one question a silent, empty manifest cannot: *"you asked for X, but these files are
 * written in Y"*. Recognition is syntactic (import/export specifiers on the already-parsed
 * AST), so it costs nothing extra and never resolves `node_modules`.
 */

import ts from "typescript";
import { BUILTIN_FRAMEWORKS, type BuiltinFramework } from "./types.js";

/**
 * The package specifiers that identify a framework. `vanilla` has no signature — plain
 * custom elements import nothing — so it never appears in a census.
 */
const SIGNATURES: ReadonlyArray<{ framework: BuiltinFramework; prefixes: readonly string[] }> = [
  { framework: "lit", prefixes: ["lit", "lit-element", "lit-html", "@lit/", "@lit-labs/"] },
  { framework: "stencil", prefixes: ["@stencil/"] },
  { framework: "angular", prefixes: ["@angular/"] },
  { framework: "react", prefixes: ["react", "react-dom"] },
];

/** One framework's footprint in the analyzed sources. */
export interface FrameworkSighting {
  framework: BuiltinFramework;
  /** The specifier that matched first, for the diagnostic message (e.g. `@stencil/core`). */
  specifier: string;
  /** Project-relative paths that import it, in module order. */
  files: string[];
}

/** True when `spec` is the package `prefix` names, or a subpath of it. */
function matches(spec: string, prefix: string): boolean {
  if (prefix.endsWith("/")) return spec.startsWith(prefix);
  return spec === prefix || spec.startsWith(prefix + "/");
}

/** Every module specifier a source module imports from or re-exports from. */
function specifiersOf(ast: ts.SourceFile): string[] {
  const out: string[] = [];
  for (const statement of ast.statements) {
    const spec =
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : undefined;
    if (spec !== undefined) out.push(spec);
  }
  return out;
}

/**
 * Take the framework census over parsed modules, in `BUILTIN_FRAMEWORKS` order.
 * Frameworks with no sighting are omitted.
 */
export function detectFrameworks(
  modules: ReadonlyArray<{ path: string; ast: ts.SourceFile }>,
): FrameworkSighting[] {
  const sightings = new Map<BuiltinFramework, FrameworkSighting>();
  for (const module of modules) {
    for (const spec of specifiersOf(module.ast)) {
      for (const { framework, prefixes } of SIGNATURES) {
        if (!prefixes.some((p) => matches(spec, p))) continue;
        const seen = sightings.get(framework);
        if (seen) {
          if (seen.files.at(-1) !== module.path) seen.files.push(module.path);
        } else {
          sightings.set(framework, { framework, specifier: spec, files: [module.path] });
        }
      }
    }
  }
  return BUILTIN_FRAMEWORKS.map((f) => sightings.get(f)).filter(
    (s): s is FrameworkSighting => s !== undefined,
  );
}

/**
 * The sightings whose framework is not among the active selection — the actionable part
 * of a census. `active` empty means the vanilla default, which no signature matches, so
 * every sighting is a mismatch.
 */
export function unselected(
  sightings: readonly FrameworkSighting[],
  active: readonly BuiltinFramework[],
): FrameworkSighting[] {
  return sightings.filter((s) => !active.includes(s.framework));
}
