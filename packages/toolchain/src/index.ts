/**
 * Public integration surface of the ACM reference toolchain.
 *
 * This is the single entry the analyzer (`@acm/analyzer`) imports — the toolchain's
 * validator, canonicalizer, diagnostics renderer, and Agent View emitter are the
 * reference implementations a Producer must go through (Principle I & V). Everything
 * re-exported here is stable for downstream packages; deep imports into other modules
 * are not part of the contract.
 */

export { validateManifest, acmSchema, MAX_DEPTH } from "./validate.js";
export { canonicalize, checkCanonical, serializeNumber } from "./canonicalize.js";
export { renderDiagnostics } from "./diagnostics.js";
export type { Diagnostic } from "./diagnostics.js";
export { agentViewFromValue, agentViewFromText } from "./agent-view.js";

// Discovery surface (spec 004): the programmatic API returns exactly the
// envelopes the CLI prints with --json; the consumer utilities parse and
// assert on spawned-CLI output. Codes and discriminators are public contract.
export { search, component, capabilities } from "./api.js";
export type { SearchOptions, ComponentOptions } from "./api.js";
export {
  AcmDiscoveryError,
  parseResponse,
  isError,
  assertResponse,
  ERROR_CODES,
  RESPONSE_TYPES,
} from "./envelope.js";
export type {
  CLIResult,
  ErrorCode,
  ErrorEnvelope,
  ResponseType,
  SuccessEnvelope,
  Suggestion,
  SearchResponse,
  ComponentListResponse,
  ComponentDetailResponse,
  CapabilitiesResponse,
} from "./envelope.js";
export type { SearchResultSet, MatchTier } from "./search.js";
export type { ComponentListData, ComponentDetailData } from "./component.js";
export { buildCapabilityManifest } from "./capability.js";
export type { CapabilityManifest } from "./capability.js";
