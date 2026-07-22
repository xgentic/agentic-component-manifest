# Contract: capability manifest (`acm capabilities`)

The CLI's structured self-description — how an agent learns the whole surface from
one call, with no help-text scraping (spec US4 / FR-008).

## Invocation

```sh
acm capabilities --json     # envelope type: "capabilities"
acm capabilities            # human-readable rendering of the same payload
```

## Payload shape

```jsonc
{
  "type": "capabilities",
  "data": {
    "apiVersion": 1,                    // capability-manifest shape version; additive bumps only
    "name": "acm",
    "version": "0.1.0",                 // from the toolchain package
    "description": "ACM reference toolchain CLI …",
    "globalOptions": [                  // OptionSpec[], serialized
      { "flag": "--json", "type": "boolean", "description": "…" },
      { "flag": "--detail <level>", "type": "enum",
        "choices": ["brief", "compact", "full"], "description": "…" }
      // …
    ],
    "commands": [                       // one entry per registry command — ALL acm commands
      {
        "name": "search",
        "description": "Find components across discovered Manifests…",
        "arguments": [
          { "name": "query", "required": true, "variadic": true, "description": "…" }
        ],
        "options": [
          { "flag": "--type <domain>", "type": "enum", "choices": ["component"], "description": "…" },
          { "flag": "--limit <n>", "type": "number", "default": 20, "description": "…" }
        ],
        "json": true,
        "responseTypes": ["search"],
        "examples": ["acm search button --json"]
      }
      // … component, capabilities, validate, compile, canonicalize, agent-view, coverage, drift
    ],
    "jsonSupported": ["search", "component", "capabilities"],
    "responseTypes": { "search": ["search"], "component": ["component.list", "component.detail"], "capabilities": ["capabilities"] },
    "errorCodes": [                     // the ACM-D-* registry, so agents can pre-wire branches
      { "code": "ACM-D-UNKNOWN-COMPONENT", "description": "…" }
      // …
    ]
  }
}
```

## Derivation and drift guarantees

- The payload is a **pure projection of the command registry**
  ([research R-01](../research.md#r-01--command-definition-declarative-registry-not-a-cli-framework)):
  the same data drives argv parsing and dispatch, so a command or option that
  exists but is undescribed is structurally impossible — there is no second place
  to define one.
- The residual hand-declared facts (descriptions, examples, `responseTypes`) are
  guarded by the conformance drift gate: every registry entry must carry a
  non-empty description, at least one example, and non-empty `responseTypes` when
  `json` is true; the full payload is pinned by a golden fixture so any surface
  change is an intentional, reviewable diff. A seeded proof blanks a description
  and must fail the gate (`pnpm test:seeded` pattern).
- **Legacy `--json` is described, not conflated**: the pre-existing commands
  (`validate`, `compile`, `agent-view`, `coverage`) carry `json: false` — they
  emit no envelope — while their own `--json` option appears in their `options`
  list with its actual meaning, "render diagnostics as JSON on stderr"
  ([envelope.md](./envelope.md)). `jsonSupported` lists envelope-emitting commands
  only.
- **Accuracy obligation**: any invocation composed strictly from the capability
  manifest (command, required arguments, declared options/choices) is accepted,
  and its response carries one of the declared response types — gated per command
  in the Conformance Suite.

## Stability

- `apiVersion` starts at 1 and bumps only for additive shape changes; consumers
  ignore unknown fields.
- `commands[].name`, option flags, enum choices, defaults, `responseTypes`, and
  `errorCodes[].code` are public contract once shipped — removals or meaning
  changes are breaking and out of scope for this feature.
- `version` mirrors the toolchain package version: deterministic for a given
  checkout, expected to change across releases (goldens compare the payload with
  `version` normalized).
