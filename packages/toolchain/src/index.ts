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
