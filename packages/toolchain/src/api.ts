import { assembleCorpus, requireNonEmpty, sourceKey, type CorpusDiagnostic } from "./corpus.js";
import { followUpFor, detailFor, listComponents, resolveComponent } from "./component.js";
import { rank, type SearchResultSet } from "./search.js";
import { buildCapabilityManifest } from "./capability.js";
import {
  AcmDiscoveryError,
  type CapabilitiesResponse,
  type ComponentDetailResponse,
  type ComponentListResponse,
  type SearchResponse,
} from "./envelope.js";
import { DETAIL_LEVELS, SEARCH_DOMAINS, type DetailLevel } from "./registry.js";

/**
 * The programmatic discovery API (spec 004 FR-009). Each function returns
 * exactly the success envelope its CLI counterpart prints with `--json`;
 * failures throw `AcmDiscoveryError` carrying the same stable code and
 * suggestions the error envelope would. CLI handlers are thin wrappers over
 * the `*WithDiagnostics` variants, so the two surfaces cannot diverge.
 */

export interface SearchOptions {
  project?: string;
  manifests?: string[];
  type?: string;
  limit?: number;
  detail?: DetailLevel;
}

export interface ComponentOptions {
  project?: string;
  manifests?: string[];
  from?: string;
  module?: string;
  detail?: DetailLevel;
}

function checkDetail(detail: string | undefined): DetailLevel | undefined {
  if (detail === undefined) return undefined;
  if ((DETAIL_LEVELS as readonly string[]).includes(detail)) return detail as DetailLevel;
  throw new AcmDiscoveryError(
    "ACM-D-USAGE",
    `--detail: unsupported value "${detail}" (supported: ${DETAIL_LEVELS.join(", ")})`,
  );
}

export async function searchWithDiagnostics(
  query: string,
  options: SearchOptions = {},
): Promise<{ envelope: SearchResponse; diagnostics: CorpusDiagnostic[] }> {
  if (options.type !== undefined && !(SEARCH_DOMAINS as readonly string[]).includes(options.type))
    throw new AcmDiscoveryError(
      "ACM-D-USAGE",
      `--type: unsupported domain "${options.type}" (supported: ${SEARCH_DOMAINS.join(", ")})`,
    );
  const detail = checkDetail(options.detail) ?? "compact";
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1)
    throw new AcmDiscoveryError(
      "ACM-D-USAGE",
      `--limit: expected a positive integer, got "${String(options.limit)}"`,
    );

  const corpus = assembleCorpus({
    ...(options.project !== undefined ? { project: options.project } : {}),
    ...(options.manifests !== undefined ? { manifests: options.manifests } : {}),
  });
  requireNonEmpty(corpus);

  const hits = rank(corpus.components, query);
  const results = hits.slice(0, limit).map((hit) => ({
    name: hit.ref.name,
    source: sourceKey(hit.ref),
    description: hit.ref.description,
    domain: "component",
    followUp: followUpFor(hit.ref, corpus.components),
    ...(detail === "full" ? { score: hit.score, matches: hit.matches } : {}),
  }));
  // A zero-result search is success (contract), not an error. Carry the runnable
  // broaden-and-scan next step so the agent's retrieval floor is self-describing.
  const data: SearchResultSet =
    hits.length === 0
      ? { query, total: 0, followUps: ["acm component --dense"], results }
      : { query, total: hits.length, results };
  return { envelope: { type: "search", data }, diagnostics: corpus.diagnostics };
}

export async function search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  return (await searchWithDiagnostics(query, options)).envelope;
}

export async function componentWithDiagnostics(
  name?: string,
  options: ComponentOptions = {},
): Promise<{
  envelope: ComponentListResponse | ComponentDetailResponse;
  diagnostics: CorpusDiagnostic[];
}> {
  const detail = checkDetail(options.detail);
  const corpus = assembleCorpus({
    ...(options.project !== undefined ? { project: options.project } : {}),
    ...(options.manifests !== undefined ? { manifests: options.manifests } : {}),
  });
  requireNonEmpty(corpus);

  if (name === undefined) {
    return {
      envelope: { type: "component.list", data: listComponents(corpus, detail ?? "brief") },
      diagnostics: corpus.diagnostics,
    };
  }
  const ref = resolveComponent(corpus, name, {
    ...(options.from !== undefined ? { from: options.from } : {}),
    ...(options.module !== undefined ? { module: options.module } : {}),
  });
  return {
    envelope: { type: "component.detail", data: detailFor(corpus, ref) },
    diagnostics: corpus.diagnostics,
  };
}

export async function component(
  name?: string,
  options: ComponentOptions = {},
): Promise<ComponentListResponse | ComponentDetailResponse> {
  return (await componentWithDiagnostics(name, options)).envelope;
}

export async function capabilities(): Promise<CapabilitiesResponse> {
  return { type: "capabilities", data: buildCapabilityManifest() };
}
