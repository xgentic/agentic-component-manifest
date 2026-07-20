/**
 * Example compile-verification (T013, feature 003, contracts/example-verification.md).
 *
 * A core, framework-blind gate: before emit, each extracted `@example` is type-checked
 * against its component in a **hermetic** in-memory `ts.Program` — one program per run, no
 * external `node_modules`, pinned compiler options — so the keep/drop decision is a pure
 * function of the analyzed sources (determinism, Principle V). Non-compiling examples are
 * pruned from the draft and reported as `ACM-A-EXCOMPILE`; the manifest is never aborted
 * (semantics/examples are optional). HTML examples are surfaced verbatim, not compiled.
 */

import ts from "typescript";
import path from "node:path";
import type { Diagnostic } from "./diagnostics.js";
import type { ModuleContextInternal } from "./context.js";

/** A virtual root keeps program paths independent of the real cwd (determinism). */
const ROOT = "/__acm__";

/** Pinned, hermetic compiler options — a pure function of the analyzed sources. */
const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  strict: false, // API-misuse errors (missing property, wrong type) fire regardless; avoid strict-null false rejections
  noEmit: true,
  skipLibCheck: true,
  types: [],
  allowJs: true,
  checkJs: false,
};

function scriptKindOf(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx") || file.endsWith(".jsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs"))
    return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** Strip a module path's extension for use in a relative import specifier. */
function stripExt(p: string): string {
  return p.replace(/\.(tsx?|jsx?|mts|cts|vue)$/, "");
}

interface Candidate {
  /** Absolute virtual path of the synthetic example module. */
  file: string;
  /** Owning module (project-relative) for the diagnostic. */
  ownerPath: string;
  entry: ModuleContextInternal["_entries"][number];
  /** Index of this example within the entry's `exampleDrafts`. */
  exampleIndex: number;
}

/**
 * Compile-verify every extracted example across the analyzed modules, pruning any that do
 * not compile against their component. Returns the `ACM-A-EXCOMPILE` diagnostics raised.
 */
export function verifyExamples(moduleContexts: ModuleContextInternal[]): Diagnostic[] {
  const overlay = new Map<string, string>();
  const candidates: Candidate[] = [];

  // Overlay every analyzed module at its virtual path.
  moduleContexts.forEach((module) => {
    overlay.set(`${ROOT}/${module.path}`, module.text);
  });

  // One synthetic module per non-HTML example, as a sibling of its component module.
  moduleContexts.forEach((module, mi) => {
    const dir = path.posix.dirname(module.path);
    const spec = `./${path.posix.basename(stripExt(module.path))}`;
    module._entries.forEach((entry, di) => {
      entry.exampleDrafts.forEach((example, xi) => {
        if (example.lang === "html") return; // not compiled (contract)
        const ext = example.lang === "tsx" ? "tsx" : "ts";
        const rel =
          dir === "."
            ? `__acm_example_${mi}_${di}_${xi}.${ext}`
            : `${dir}/__acm_example_${mi}_${di}_${xi}.${ext}`;
        const file = `${ROOT}/${rel}`;
        const importLine = entry.exportName
          ? `import { ${entry.exportName} } from '${spec}';\n`
          : `import '${spec}';\n`;
        overlay.set(file, `${importLine}${example.source.text}\n`);
        candidates.push({ file, ownerPath: module.path, entry, exampleIndex: xi });
      });
    });
  });

  if (candidates.length === 0) return [];

  const base = ts.createCompilerHost(OPTIONS);
  const host: ts.CompilerHost = {
    ...base,
    getCurrentDirectory: () => ROOT,
    getSourceFile: (fileName, languageVersionOrOptions, onError) => {
      const text = overlay.get(fileName);
      if (text !== undefined) {
        return ts.createSourceFile(
          fileName,
          text,
          languageVersionOrOptions,
          true,
          scriptKindOf(fileName),
        );
      }
      return base.getSourceFile(fileName, languageVersionOrOptions, onError);
    },
    fileExists: (fileName) => overlay.has(fileName) || base.fileExists(fileName),
    readFile: (fileName) => overlay.get(fileName) ?? base.readFile(fileName),
    // Virtual dirs must "exist" or module resolution bails before probing overlay files.
    directoryExists: (dir) => dir.startsWith(ROOT) || (base.directoryExists?.(dir) ?? false),
    realpath: (p) => (p.startsWith(ROOT) ? p : (base.realpath?.(p) ?? p)),
    getDirectories: (dir) => (dir.startsWith(ROOT) ? [] : (base.getDirectories?.(dir) ?? [])),
    writeFile: () => {},
  };

  const program = ts.createProgram(
    candidates.map((c) => c.file),
    OPTIONS,
    host,
  );

  // Per entry, accumulate keep-flags for its examples (default true — HTML/kept).
  const keepByEntry = new Map<Candidate["entry"], boolean[]>();
  const ensure = (entry: Candidate["entry"]): boolean[] => {
    let flags = keepByEntry.get(entry);
    if (!flags) {
      flags = entry.exampleDrafts.map(() => true);
      keepByEntry.set(entry, flags);
    }
    return flags;
  };

  const diagnostics: Diagnostic[] = [];
  for (const c of candidates) {
    const sf = program.getSourceFile(c.file)!;
    const errs = [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)];
    if (errs.length > 0) {
      ensure(c.entry)[c.exampleIndex] = false;
      const first = ts.flattenDiagnosticMessageText(errs[0]!.messageText, " ");
      diagnostics.push({
        code: "ACM-A-EXCOMPILE",
        severity: "warning",
        file: c.ownerPath,
        message: `example does not compile against the component; excluded (${first})`,
      });
    }
  }

  // Prune each entry that had at least one failing example.
  for (const [entry, keep] of keepByEntry) {
    if (keep.some((k) => !k)) entry.pruneExamples(keep);
  }

  return diagnostics;
}
