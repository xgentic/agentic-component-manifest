# Agent-facing YAML is a derived view, not the wire format

Agents reading manifests pay per token, and YAML costs roughly 15–25% fewer tokens than
formatted JSON — which prompted a proposal to distribute manifests as YAML. We decided
the distributed, authoritative artifact stays ACM Canonical JSON; the spec instead
defines the **Agent View**, a deterministic one-way YAML projection (fixed emitter
rules, no anchors, schema-declared key order) that consumers derive locally when
surfacing a manifest to an agent. Making YAML the wire format would have required
inventing a canonical-YAML spec (none exists; emitters disagree on quoting), enlarged
the untrusted-input attack surface (alias-expansion bombs), and broken CEM-ecosystem
interop — while the token savings are actually captured at context-insertion time,
where a mechanical JSON→YAML projection gets all of them.

## Considered Options

- **YAML as authoritative interchange** — rejected for the reasons above.
- **JSON-only, no defined projection** — rejected: every agent tool would invent its own
  inconsistent YAML rendering, and determinism would be lost exactly where agents read.

## Consequences

- The Normative Spec owns the Agent View emitter rules; a golden JSON→YAML fixture pair
  gates emitter conformance.
- The Agent View is never authoritative, never parsed back, never distributed as the
  manifest.
