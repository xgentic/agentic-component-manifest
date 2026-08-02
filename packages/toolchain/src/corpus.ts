import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { Diagnostic } from "./diagnostics.js";
import { resolveManifestPath } from "./discovery.js";
import { validateManifest } from "./validate.js";
import { AcmDiscoveryError } from "./envelope.js";

/**
 * Manifest Corpus assembly — the universe of one discovery invocation
 * (spec 004 R-03). Sources, in deterministic order: the project root, every
 * top-level `node_modules` package (lexicographic), then explicit paths in argv
 * order. Admission is validation-gated (NS-LIMIT enforced by the reference
 * validator); skip-vs-diagnose-vs-error:
 *   - no manifest in a non-explicit source        → silently absent
 *   - broken advertisement / unparseable / invalid → CorpusDiagnostic, excluded
 *   - failing explicit --manifest path             → ACM-D-BAD-MANIFEST (fatal)
 */

/**
 * True for an installed package directory inside `node_modules`. `readdir` reports link
 * entries by their own type, so a plain `isDirectory()` would skip every symlinked
 * package — which is how npm, pnpm, and yarn all install workspace packages, and exactly
 * the case where a monorepo's own component library lives. Dangling links resolve to
 * false rather than throwing.
 */
function isPackageDir(
  parent: string,
  dirent: { name: string; isDirectory(): boolean; isSymbolicLink(): boolean },
): boolean {
  if (dirent.name.startsWith(".")) return false;
  if (dirent.isDirectory()) return true;
  if (!dirent.isSymbolicLink()) return false;
  try {
    return statSync(path.join(parent, dirent.name)).isDirectory();
  } catch {
    return false;
  }
}

export interface CorpusSource {
  kind: "project-root" | "installed-package" | "explicit-path";
  package?: string;
  resolution: "acm-field" | "conventional" | "well-known" | "explicit";
}

export interface CorpusEntry {
  source: CorpusSource;
  /** Project-root-relative, `/`-separated (determinism: never absolute). */
  path: string;
  /** The validated document, held verbatim (unknown and `x-*` fields preserved). */
  manifest: unknown;
}

export interface CorpusDiagnostic extends Diagnostic {
  path: string;
}

/** The searchable index record for one component entry. */
export interface ComponentRef {
  name: string;
  /** NFC-lowercased name, for case-insensitive resolution. */
  nameLower: string;
  source: CorpusSource;
  /** Manifest path of the owning CorpusEntry (project-root-relative). */
  manifestPath: string;
  /** Populated Identity Facets only. */
  facets: { tagName?: string; module?: string; export?: string; selector?: string };
  /** Controlled-vocabulary terms, if classified. */
  semantics: string[];
  /** Verbatim first line of the description, for list/search rendering. */
  description: string;
  /** NFC-lowercased prose haystack: full description, semantics notes, example titles. */
  prose: string;
  /** Locator of the full entry inside the owning manifest. */
  entryPointer: string;
}

export interface Corpus {
  entries: CorpusEntry[];
  components: ComponentRef[];
  diagnostics: CorpusDiagnostic[];
}

export interface CorpusOptions {
  project?: string;
  manifests?: string[];
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function normalize(text: string): string {
  return text.normalize("NFC").toLowerCase();
}

function firstLine(text: string): string {
  const index = text.indexOf("\n");
  return index === -1 ? text : text.slice(0, index);
}

function inferResolution(packageDir: string, manifestPath: string): CorpusSource["resolution"] {
  if (manifestPath === path.join(packageDir, "agentic-component-manifest.json"))
    return "conventional";
  if (manifestPath === path.join(packageDir, ".well-known", "agentic-component-manifest.json"))
    return "well-known";
  return "acm-field";
}

function extractComponents(entry: CorpusEntry): ComponentRef[] {
  const refs: ComponentRef[] = [];
  const doc = entry.manifest as { modules?: unknown };
  const modules = Array.isArray(doc?.modules) ? doc.modules : [];
  modules.forEach((mod: any, mi: number) => {
    const declarations = Array.isArray(mod?.declarations) ? mod.declarations : [];
    declarations.forEach((decl: any, di: number) => {
      if (typeof decl?.name !== "string") return;
      const identity = decl.identity ?? {};
      const facets: ComponentRef["facets"] = {};
      if (typeof identity.tagName === "string") facets.tagName = identity.tagName;
      if (typeof identity.module === "string") facets.module = identity.module;
      if (typeof identity.export === "string") facets.export = identity.export;
      if (typeof identity.selector === "string") facets.selector = identity.selector;
      const semantics = typeof decl.semantics?.term === "string" ? [decl.semantics.term] : [];
      const description = typeof decl.description === "string" ? decl.description : "";
      const proseParts = [
        description,
        typeof decl.semantics?.notes === "string" ? decl.semantics.notes : "",
        ...(Array.isArray(decl.examples)
          ? decl.examples.map((ex: any) => (typeof ex?.title === "string" ? ex.title : ""))
          : []),
      ];
      refs.push({
        name: decl.name,
        nameLower: normalize(decl.name),
        source: entry.source,
        manifestPath: entry.path,
        facets,
        semantics,
        description: firstLine(description),
        prose: normalize(proseParts.filter(Boolean).join("\n")),
        entryPointer: `/modules/${mi}/declarations/${di}`,
      });
    });
  });
  return refs;
}

/** The corpus-facing identifier of a component's origin: package name, else manifest path. */
export function sourceKey(ref: Pick<ComponentRef, "source" | "manifestPath">): string {
  return ref.source.package ?? ref.manifestPath;
}

/** Resolve a ComponentRef back to its verbatim Manifest entry via its pointer. */
export function entryFor(corpus: Corpus, ref: ComponentRef): unknown {
  const entry = corpus.entries.find((e) => e.path === ref.manifestPath);
  if (!entry) throw new Error(`corpus entry not found for ${ref.manifestPath}`);
  let node: any = entry.manifest;
  for (const segment of ref.entryPointer.split("/").slice(1)) {
    node = node?.[/^\d+$/.test(segment) ? Number(segment) : segment];
  }
  return node;
}

export function assembleCorpus(options: CorpusOptions = {}): Corpus {
  const projectDir = path.resolve(options.project ?? process.cwd());
  const entries: CorpusEntry[] = [];
  const diagnostics: CorpusDiagnostic[] = [];

  const rel = (p: string): string => toPosix(path.relative(projectDir, p));

  function admit(
    manifestPath: string,
    source: CorpusSource,
  ): { entry?: CorpusEntry; reason?: string } {
    let text: string;
    try {
      text = readFileSync(manifestPath, "utf8");
    } catch {
      return { reason: "cannot read file" };
    }
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      return { reason: "not parseable JSON" };
    }
    const result = validateManifest(doc);
    if (!result.valid) {
      const first = result.diagnostics[0]!;
      return {
        reason: `not a valid Manifest (${result.diagnostics.length} diagnostic${
          result.diagnostics.length === 1 ? "" : "s"
        }, first: ${first.ruleId})`,
      };
    }
    return { entry: { source, path: rel(manifestPath), manifest: doc } };
  }

  function admitPackageDir(packageDir: string, source: CorpusSource): void {
    const resolved = resolveManifestPath(packageDir);
    if (resolved.path === undefined) {
      // NS-DISC-4: silence for "no manifest at all"; a broken advertisement is a diagnostic.
      if (resolved.error !== undefined && resolved.error.includes("advertised")) {
        diagnostics.push({
          ruleId: "ACM-D-BAD-MANIFEST",
          pointer: "",
          path: rel(packageDir),
          message: `${rel(packageDir) || "."}: ${resolved.error}`,
        });
      }
      return;
    }
    const admitted = admit(resolved.path, {
      ...source,
      resolution: inferResolution(packageDir, resolved.path),
    });
    if (admitted.entry) {
      entries.push(admitted.entry);
    } else {
      diagnostics.push({
        ruleId: "ACM-D-BAD-MANIFEST",
        pointer: "",
        path: rel(resolved.path),
        message: `${rel(resolved.path)}: ${admitted.reason} — excluded from the corpus`,
      });
    }
  }

  // 1. Project root.
  let projectPackageName: string | undefined;
  const projectPackageJson = path.join(projectDir, "package.json");
  if (existsSync(projectPackageJson)) {
    try {
      const pkg = JSON.parse(readFileSync(projectPackageJson, "utf8"));
      if (typeof pkg.name === "string") projectPackageName = pkg.name;
    } catch {
      // an unreadable project package.json only costs the package label
    }
  }
  admitPackageDir(projectDir, {
    kind: "project-root",
    ...(projectPackageName !== undefined ? { package: projectPackageName } : {}),
    resolution: "conventional",
  });

  // 2. Installed packages, lexicographic by name (scoped included).
  const nodeModules = path.join(projectDir, "node_modules");
  if (existsSync(nodeModules)) {
    const packageNames: string[] = [];
    for (const dirent of readdirSync(nodeModules, { withFileTypes: true })) {
      if (!isPackageDir(nodeModules, dirent)) continue;
      if (dirent.name.startsWith("@")) {
        const scopeDir = path.join(nodeModules, dirent.name);
        for (const inner of readdirSync(scopeDir, { withFileTypes: true })) {
          if (isPackageDir(scopeDir, inner)) packageNames.push(`${dirent.name}/${inner.name}`);
        }
      } else {
        packageNames.push(dirent.name);
      }
    }
    packageNames.sort();
    for (const name of packageNames) {
      admitPackageDir(path.join(nodeModules, name), {
        kind: "installed-package",
        package: name,
        resolution: "conventional",
      });
    }
  }

  // 3. Explicit paths, argv order — failures are fatal (ACM-D-BAD-MANIFEST).
  for (const explicit of options.manifests ?? []) {
    const absolute = path.resolve(explicit);
    const admitted = admit(absolute, { kind: "explicit-path", resolution: "explicit" });
    if (admitted.entry === undefined) {
      throw new AcmDiscoveryError(
        "ACM-D-BAD-MANIFEST",
        `${explicit}: ${existsSync(absolute) ? admitted.reason : "no such file"}`,
      );
    }
    entries.push(admitted.entry);
  }

  return { entries, components: entries.flatMap(extractComponents), diagnostics };
}

/** Throw the empty-corpus error every corpus-querying command shares. */
export function requireNonEmpty(corpus: Corpus): void {
  if (corpus.entries.length === 0)
    throw new AcmDiscoveryError(
      "ACM-D-EMPTY-CORPUS",
      "no ACM Manifests were discovered in this project (checked the project root, installed packages, and explicit paths)",
    );
}
