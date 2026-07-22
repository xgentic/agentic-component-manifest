# Contract: programmatic API and consumer utilities

The subprocess-free surface (spec US5 / FR-009, FR-010). Exported from
`@acm/toolchain` (re-exported through the package's public `index.ts`; deep imports
remain non-contractual, matching the toolchain's existing export policy).

## Discovery functions

```ts
import { search, component, capabilities, AcmDiscoveryError } from "@acm/toolchain";

// Same result as: acm search button --json
const hits = await search("button", { project, manifests, type, limit, detail });
hits.type;          // "search"
hits.data.results;  // ranked, capped, deterministic

// Same result as: acm component --json           (list)
// Same result as: acm component Button --json    (detail)
const list = await component(undefined, { project, detail });
list.type;          // "component.list"
const btn = await component("Button", { project, from });
btn.type;           // "component.detail"
btn.data.entry;     // the Manifest entry, verbatim

// Same result as: acm capabilities --json
const cap = await capabilities();
cap.type;           // "capabilities"
```

- Each function returns **exactly the success envelope** its CLI counterpart
  prints with `--json` — same `type`, same `data`, same ordering. Options mirror
  the CLI flags one-to-one (`project` ↔ `--project`, `manifests` ↔ repeated
  `--manifest`, `from` ↔ `--from`, `limit`, `type`, `detail`).
- Failures throw `AcmDiscoveryError`:

```ts
try {
  await component("Buttn");
} catch (e) {
  if (e instanceof AcmDiscoveryError) {
    e.code;         // "ACM-D-UNKNOWN-COMPONENT" — branch on this, never on message
    e.suggestions;  // [{ name: "Button", reason: "similar name", … }]
    e.message;      // wording changes freely; not contract
  }
}
```

Codes and suggestion shapes are identical to the error envelope
([envelope.md](./envelope.md)) — one registry serves both surfaces.

## Thin-wrapper guarantee

CLI handlers parse argv per the registry, call these functions, and render the
returned envelope (JSON: serialize it; text: format from the same object). There
is no CLI-only data path, so API ⇄ CLI divergence is structurally impossible for
data ([research R-08](../research.md#r-08--programmatic-api-and-parity-strategy)).
The Conformance Suite additionally spawns the real CLI per operation — including
one forced failure per error code — and deep-equals stdout against the API result
(SC-007), guarding the wrapper seam (argv parsing, stream discipline) itself.

## Consumer utilities

For consumers that spawn the CLI rather than import it:

```ts
import { parseResponse, isError, assertResponse } from "@acm/toolchain";
import type { CLIResult, SearchResponse, ComponentDetailResponse } from "@acm/toolchain";

const result = parseResponse(stdout);   // parse + envelope-shape validation
if (isError(result)) {
  result.code;                          // stable ACM-D-* code
} else if (result.type === "component.detail") {
  result.data.entry;                    // narrowed by discriminant
}

const detail = assertResponse(stdout, "component.detail"); // throws on error or type mismatch
```

- `parseResponse` accepts exactly one envelope; non-JSON or shape-invalid input
  throws with a message naming the problem (it never guesses).
- `isError` narrows on the `error`/`code` keys; `assertResponse` throws
  `AcmDiscoveryError` when given an error envelope, and a type-mismatch error when
  given a different success discriminator — never a silent pass.
- Response payload types are exported per discriminator so `switch` narrowing
  works without casts.
