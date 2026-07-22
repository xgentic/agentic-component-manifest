import type { SearchResultSet } from "./search.js";
import type { ComponentListData, ComponentDetailData } from "./component.js";
import type { CapabilityManifest } from "./capability.js";

/**
 * Typed-envelope contract of the discovery surface: response-type discriminators,
 * `ACM-D-*` error codes, and the consumer utilities for parsing CLI output.
 *
 * Everything here is public contract under the repo's standing `ACM-*` stability
 * rule (specs/004-component-discovery-cli/contracts/envelope.md): discriminators
 * and codes are never renamed or reused; evolution is additive only.
 */

/** The `ACM-D-*` registry: code → one-line meaning + exit status. Append-only. */
export const ERROR_CODES = {
  "ACM-D-EMPTY-CORPUS": {
    exit: 1,
    description: "no ACM Manifests were discovered in the assembled corpus",
  },
  "ACM-D-UNKNOWN-COMPONENT": {
    exit: 1,
    description: "the requested name matches no component in the corpus",
  },
  "ACM-D-AMBIGUOUS-COMPONENT": {
    exit: 1,
    description:
      "the requested name matches more than one component; qualify with --from (and --module for intra-package duplicates)",
  },
  "ACM-D-BAD-MANIFEST": {
    exit: 1,
    description:
      "an explicitly provided manifest path failed admission (missing, unparseable, invalid, or over the structural limits)",
  },
  "ACM-D-USAGE": {
    exit: 2,
    description:
      "invalid invocation: unknown command or option, unsupported enum value, or malformed number",
  },
  "ACM-D-UNKNOWN": {
    exit: 1,
    description: "unclassified failure; no more specific code applies",
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Dot-namespaced response-type discriminators. Append-only. */
export const RESPONSE_TYPES = [
  "search",
  "component.list",
  "component.detail",
  "capabilities",
] as const;

export type ResponseType = (typeof RESPONSE_TYPES)[number];

export interface Suggestion {
  name: string;
  reason: string;
  source?: string;
  followUp?: string;
}

export interface ErrorEnvelope {
  error: string;
  code: ErrorCode;
  suggestions?: Suggestion[];
}

export interface SearchResponse {
  type: "search";
  data: SearchResultSet;
}

export interface ComponentListResponse {
  type: "component.list";
  data: ComponentListData;
}

export interface ComponentDetailResponse {
  type: "component.detail";
  data: ComponentDetailData;
}

export interface CapabilitiesResponse {
  type: "capabilities";
  data: CapabilityManifest;
}

export type SuccessEnvelope =
  SearchResponse | ComponentListResponse | ComponentDetailResponse | CapabilitiesResponse;

/** One parsed machine-output document: success or coded error. */
export type CLIResult = SuccessEnvelope | ErrorEnvelope;

/**
 * Thrown by the programmatic API where the CLI emits an error envelope — same
 * `code` and `suggestions` values (contracts/api.md). Branch on `code`, never on
 * `message`.
 */
export class AcmDiscoveryError extends Error {
  readonly code: ErrorCode;
  readonly suggestions?: Suggestion[];

  constructor(code: ErrorCode, message: string, suggestions?: Suggestion[]) {
    super(message);
    this.name = "AcmDiscoveryError";
    this.code = code;
    if (suggestions !== undefined) this.suggestions = suggestions;
  }
}

export function toErrorEnvelope(error: AcmDiscoveryError): ErrorEnvelope {
  const envelope: ErrorEnvelope = { error: error.message, code: error.code };
  if (error.suggestions !== undefined && error.suggestions.length > 0)
    envelope.suggestions = error.suggestions;
  return envelope;
}

/** Exit status for a code; `ACM-D-UNKNOWN`'s 1 is the fallback for unknown codes. */
export function exitStatusFor(code: string): number {
  return (ERROR_CODES as Record<string, { exit: number }>)[code]?.exit ?? 1;
}

/**
 * Parse raw CLI stdout into exactly one typed envelope. Non-JSON or
 * shape-invalid input throws naming the problem — it never guesses.
 */
export function parseResponse(stdout: string): CLIResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("not a typed envelope: stdout is not parseable JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("not a typed envelope: expected a single JSON object");
  const doc = parsed as Record<string, unknown>;
  if (typeof doc.error === "string") {
    if (typeof doc.code !== "string")
      throw new Error("not a typed envelope: error envelope is missing its code");
    return doc as unknown as ErrorEnvelope;
  }
  if (typeof doc.type === "string") {
    if (!("data" in doc))
      throw new Error("not a typed envelope: success envelope is missing its data");
    return doc as unknown as SuccessEnvelope;
  }
  throw new Error('not a typed envelope: neither "type" nor "error" is present');
}

export function isError(result: CLIResult): result is ErrorEnvelope {
  return typeof (result as ErrorEnvelope).error === "string" && "code" in result;
}

/**
 * Parse and assert a specific success discriminator. An error envelope throws
 * `AcmDiscoveryError`; a different success type throws a mismatch error —
 * never a silent pass.
 */
export function assertResponse<T extends ResponseType>(
  stdout: string,
  expected: T,
): Extract<SuccessEnvelope, { type: T }> {
  const result = parseResponse(stdout);
  if (isError(result)) throw new AcmDiscoveryError(result.code, result.error, result.suggestions);
  if (result.type !== expected)
    throw new Error(`expected response type "${expected}", got "${result.type}"`);
  return result as Extract<SuccessEnvelope, { type: T }>;
}
