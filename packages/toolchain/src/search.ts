import type { ComponentRef } from "./corpus.js";

/**
 * Tiered, deterministic search over the Manifest Corpus (spec 004 R-04).
 * Queries are literal text — regex/glob metacharacters have no meaning. The
 * ordinal tier order is contract; the numeric weights are implementation,
 * pinned by golden fixtures.
 */

export const MATCH_TIERS = [
  "name-exact",
  "facet-exact",
  "name-prefix",
  "name-substring",
  "name-fuzzy",
  "semantic-exact",
  "facet-substring",
  "prose-substring",
] as const;

export type MatchTier = (typeof MATCH_TIERS)[number];

const TIER_WEIGHTS: Record<MatchTier, number> = {
  "name-exact": 100,
  "facet-exact": 90,
  "name-prefix": 80,
  "name-substring": 70,
  "name-fuzzy": 60,
  "semantic-exact": 50,
  "facet-substring": 40,
  "prose-substring": 30,
};

export interface SearchMatch {
  token: string;
  tier: MatchTier;
}

/** One ranked hit, pre-envelope: the ref plus its score and match reasons. */
export interface RankedHit {
  ref: ComponentRef;
  score: number;
  matches: SearchMatch[];
}

/** The `search` envelope payload shape (serialized form built in api.ts). */
export interface SearchResultSet {
  query: string;
  total: number;
  /**
   * Runnable next commands, present only when `total === 0`: the deterministic
   * signal that retrieval missed and the agent should broaden (list the whole
   * corpus and pick by reading). Additive; consumers ignore it when absent.
   */
  followUps?: string[];
  results: Array<{
    name: string;
    source: string;
    description: string;
    domain: string;
    followUp: string;
    score?: number;
    matches?: SearchMatch[];
  }>;
}

/** NFC-normalized, lower-cased, whitespace-split literal tokens. */
export function tokenize(raw: string): string[] {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .split(/\s+/u)
    .filter((t) => t.length > 0);
}

/**
 * Damerau-Levenshtein distance (optimal string alignment): insertions,
 * deletions, substitutions, and adjacent transpositions.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const rows: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) rows[i]![0] = i;
  for (let j = 0; j <= n; j++) rows[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      rows[i]![j] = best;
    }
  }
  return rows[m]![n]!;
}

/** Length-scaled fuzzy threshold: ≤ 1 edit for tokens of ≤ 5 chars, else ≤ 2. */
export function fuzzyThreshold(token: string): number {
  return token.length <= 5 ? 1 : 2;
}

function facetValues(ref: ComponentRef): string[] {
  return Object.values(ref.facets)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.normalize("NFC").toLowerCase());
}

/** Best-matching tier for one token against one component, or undefined. */
export function matchToken(token: string, ref: ComponentRef): MatchTier | undefined {
  const name = ref.nameLower;
  const facets = facetValues(ref);
  if (name === token) return "name-exact";
  if (facets.includes(token)) return "facet-exact";
  if (name.startsWith(token)) return "name-prefix";
  if (name.includes(token)) return "name-substring";
  if (damerauLevenshtein(name, token) <= fuzzyThreshold(token)) return "name-fuzzy";
  if (ref.semantics.some((term) => term.normalize("NFC").toLowerCase() === token))
    return "semantic-exact";
  if (facets.some((f) => f.includes(token))) return "facet-substring";
  if (ref.prose.includes(token)) return "prose-substring";
  return undefined;
}

/**
 * Rank the corpus for a query: a component matches if at least one token
 * matches; its score is the sum over tokens of the best tier's weight.
 * Ordering: score desc → name asc (code point) → source package asc.
 */
export function rank(components: ComponentRef[], rawQuery: string): RankedHit[] {
  const tokens = tokenize(rawQuery);
  const hits: RankedHit[] = [];
  for (const ref of components) {
    const matches: SearchMatch[] = [];
    let score = 0;
    for (const token of tokens) {
      const tier = matchToken(token, ref);
      if (tier !== undefined) {
        matches.push({ token, tier });
        score += TIER_WEIGHTS[tier];
      }
    }
    if (matches.length > 0) hits.push({ ref, score, matches });
  }
  hits.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.ref.name !== b.ref.name) return a.ref.name < b.ref.name ? -1 : 1;
    const pa = a.ref.source.package ?? a.ref.manifestPath;
    const pb = b.ref.source.package ?? b.ref.manifestPath;
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });
  return hits;
}
