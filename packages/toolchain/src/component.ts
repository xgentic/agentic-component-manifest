import type { ComponentRef, Corpus } from "./corpus.js";
import { entryFor, sourceKey } from "./corpus.js";
import { damerauLevenshtein, fuzzyThreshold } from "./search.js";
import type { DetailLevel } from "./registry.js";
import type { Suggestion } from "./envelope.js";
import { AcmDiscoveryError } from "./envelope.js";

/**
 * Name resolution, disambiguation, and listing (spec 004 R-05). Resolution is
 * case-insensitive over (source package, name); `--from` scopes by package,
 * `--module` scopes by the module Identity Facet — the intra-package
 * disambiguator. Bare-name requests never silently pick one of several.
 */

export interface ComponentListData {
  total: number;
  packages: Array<{
    package: string;
    components: Array<{ name: string; tagName?: string; description?: string; entry?: unknown }>;
  }>;
}

export interface ComponentDetailData {
  name: string;
  source: { package?: string; path: string };
  entry: unknown;
}

/**
 * The runnable invocation that unambiguously reaches `ref` in this corpus:
 * qualified with `--from` iff the bare name is ambiguous, plus `--module` for
 * intra-package duplicates.
 */
export function followUpFor(ref: ComponentRef, all: ComponentRef[]): string {
  const sameName = all.filter((c) => c.nameLower === ref.nameLower);
  let invocation = `acm component ${ref.name}`;
  if (sameName.length > 1) {
    invocation += ` --from ${sourceKey(ref)}`;
    const samePackage = sameName.filter((c) => sourceKey(c) === sourceKey(ref));
    if (samePackage.length > 1 && ref.facets.module !== undefined)
      invocation += ` --module ${ref.facets.module}`;
  }
  return invocation;
}

export interface ResolveOptions {
  from?: string;
  module?: string;
}

/** Resolve a name to exactly one component or throw the coded error an agent branches on. */
export function resolveComponent(
  corpus: Corpus,
  name: string,
  options: ResolveOptions = {},
): ComponentRef {
  const needle = name.normalize("NFC").toLowerCase();
  let candidates = corpus.components.filter((c) => c.nameLower === needle);
  if (options.from !== undefined)
    candidates = candidates.filter((c) => sourceKey(c) === options.from);
  if (options.module !== undefined)
    candidates = candidates.filter((c) => c.facets.module === options.module);

  if (candidates.length === 1) return candidates[0]!;

  if (candidates.length === 0) {
    const scope =
      options.from !== undefined || options.module !== undefined
        ? ` in the requested scope (${[
            options.from !== undefined ? `--from ${options.from}` : "",
            options.module !== undefined ? `--module ${options.module}` : "",
          ]
            .filter(Boolean)
            .join(" ")})`
        : "";
    throw new AcmDiscoveryError(
      "ACM-D-UNKNOWN-COMPONENT",
      `"${name}" does not match any component in the corpus${scope}`,
      closestNames(corpus, needle),
    );
  }

  const suggestions: Suggestion[] = candidates.map((c) => ({
    name: c.name,
    reason: disambiguationReason(c, candidates),
    source: sourceKey(c),
    followUp: followUpFor(c, corpus.components),
  }));
  throw new AcmDiscoveryError(
    "ACM-D-AMBIGUOUS-COMPONENT",
    `"${name}" matches more than one component; qualify the request to pick one`,
    suggestions,
  );
}

function disambiguationReason(ref: ComponentRef, candidates: ComponentRef[]): string {
  const samePackage = candidates.filter((c) => sourceKey(c) === sourceKey(ref));
  return samePackage.length > 1 && ref.facets.module !== undefined
    ? `${sourceKey(ref)} (module ${ref.facets.module})`
    : sourceKey(ref);
}

/** Top-3 closest names within the fuzzy threshold, as unknown-name suggestions. */
export function closestNames(corpus: Corpus, needle: string): Suggestion[] | undefined {
  const byName = new Map<string, ComponentRef>();
  for (const ref of corpus.components)
    if (!byName.has(ref.nameLower)) byName.set(ref.nameLower, ref);
  const scored = [...byName.values()]
    .map((ref) => ({ ref, distance: damerauLevenshtein(ref.nameLower, needle) }))
    .filter(
      ({ ref, distance }) =>
        distance <= Math.max(fuzzyThreshold(needle), fuzzyThreshold(ref.nameLower)),
    )
    .sort((a, b) =>
      a.distance !== b.distance ? a.distance - b.distance : a.ref.name < b.ref.name ? -1 : 1,
    )
    .slice(0, 3);
  if (scored.length === 0) return undefined;
  return scored.map(({ ref }) => ({
    name: ref.name,
    reason: "similar name",
    source: sourceKey(ref),
    followUp: followUpFor(ref, corpus.components),
  }));
}

/** The `component.list` payload: package-grouped, fields per the active detail level. */
export function listComponents(corpus: Corpus, detail: DetailLevel): ComponentListData {
  const groups = new Map<string, ComponentRef[]>();
  for (const ref of corpus.components) {
    const key = sourceKey(ref);
    const group = groups.get(key);
    if (group) group.push(ref);
    else groups.set(key, [ref]);
  }
  return {
    total: corpus.components.length,
    packages: [...groups.entries()].map(([pkg, refs]) => ({
      package: pkg,
      components: refs.map((ref) => ({
        name: ref.name,
        ...(detail !== "brief" && ref.facets.tagName !== undefined
          ? { tagName: ref.facets.tagName }
          : {}),
        ...(detail !== "brief" ? { description: ref.description } : {}),
        ...(detail === "full" ? { entry: entryFor(corpus, ref) } : {}),
      })),
    })),
  };
}

/** The `component.detail` payload: the Manifest entry, verbatim. */
export function detailFor(corpus: Corpus, ref: ComponentRef): ComponentDetailData {
  return {
    name: ref.name,
    source: {
      ...(ref.source.package !== undefined ? { package: ref.source.package } : {}),
      path: ref.manifestPath,
    },
    entry: entryFor(corpus, ref),
  };
}
