/**
 * Emit pipeline (T014): assemble → validate → canonicalize → atomic write.
 *
 * The manifest is validated by the toolchain reference validator and serialized by the
 * reference canonicalizer before ever touching disk. A schema or structural-limit
 * violation aborts the write with a diagnostic — the analyzer never writes an invalid,
 * over-limit, or non-canonical manifest, and never truncates (truncation would forge
 * Tier-1 verbatimness). Writes are atomic (temp file + rename) so no partial manifest
 * is ever observable.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize, validateManifest } from "@acm/toolchain";
import {
  buildProvenance,
  outputModules,
  serializeModule,
  type ModuleContextInternal,
  type ProvenanceRecord,
} from "./context.js";
import type { Diagnostic } from "./diagnostics.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Manifest schema version, self-declared from the spec package (plan Principle VII). */
export const SCHEMA_VERSION: string = JSON.parse(
  readFileSync(path.resolve(here, "../../spec/package.json"), "utf8"),
).version;

/** Assemble the schema-shaped manifest from analyzed modules (declaration modules only). */
export function assemble(moduleContexts: ModuleContextInternal[]): Record<string, unknown> {
  const modules = outputModules(moduleContexts).map(serializeModule);
  return { schemaVersion: SCHEMA_VERSION, modules };
}

/**
 * The plugin whose contribution owns `pointer`, by longest-prefix match against the
 * provenance map — a member-level or `x-*` contribution beats the entry-level owner, so
 * an enrichment plugin's bad field is blamed on it, not on the entry's creator.
 */
function attributePlugin(
  provenance: ProvenanceRecord[],
  pointer: string | undefined,
): string | undefined {
  if (!pointer) return undefined;
  let best: ProvenanceRecord | undefined;
  for (const rec of provenance) {
    const matches = pointer === rec.prefix || pointer.startsWith(rec.prefix + "/");
    if (matches && (best === undefined || rec.prefix.length > best.prefix.length)) best = rec;
  }
  return best?.plugin;
}

export interface EmitResult {
  /** Whether a manifest file was written. */
  wrote: boolean;
  /** Canonical manifest text when valid; `null` when emission was aborted. */
  text: string | null;
  diagnostics: Diagnostic[];
}

export interface EmitOptions {
  outdir: string;
  cwd: string;
  /** When false, validate and canonicalize but do not touch disk (used by tests). */
  write?: boolean;
}

/** Validate, canonicalize, and (optionally) atomically write `<outdir>/agentic-component-manifest.json`. */
export function emit(moduleContexts: ModuleContextInternal[], options: EmitOptions): EmitResult {
  const diagnostics: Diagnostic[] = [];
  const manifest = assemble(moduleContexts);

  const { valid, diagnostics: validation } = validateManifest(manifest);
  if (!valid) {
    // A plugin contribution that invalidates the manifest aborts the write, with the
    // failure attributed to the offending plugin (US4 scenario 4). Nothing is written.
    const provenance = buildProvenance(moduleContexts);
    for (const d of validation) {
      const plugin = attributePlugin(provenance, d.pointer);
      diagnostics.push({
        code: d.ruleId,
        severity: "error",
        ...(plugin ? { plugin } : {}),
        message: `${d.message}${d.pointer ? ` (at ${d.pointer})` : ""}`,
      });
    }
    return { wrote: false, text: null, diagnostics };
  }

  const text = canonicalize(manifest);

  if ((manifest.modules as unknown[]).length === 0) {
    diagnostics.push({
      code: "ACM-A-EMPTY",
      severity: "warning",
      message: "no components found; wrote a valid empty manifest",
    });
  }

  if (options.write === false) return { wrote: false, text, diagnostics };

  const dir = path.resolve(options.cwd, options.outdir);
  mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.agentic-component-manifest.json.${process.pid}.tmp`);
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, path.join(dir, "agentic-component-manifest.json"));

  return { wrote: true, text, diagnostics };
}
