# Contract: Manifest Discovery

Constitution "Distribution & Discovery" section, made concrete.

- **npm packages**: top-level `"acm"` field in `package.json`, a package-relative path
  to the canonical JSON manifest. Conventional filename and default value: `agentic-component-manifest.json`
  at package root.
- **Fallback (non-npm / URL distribution)**: `/.well-known/agentic-component-manifest.json` relative to the
  distribution root (RFC 8615 pattern).
- **Resolution order for consumers**: explicit `acm` field → `./agentic-component-manifest.json` → well-known
  path. First hit wins; consumers MUST NOT merge multiple sources.
- **Self-declaration**: a discovered manifest missing `schemaVersion` is invalid —
  consumers resolve capability from the declaration, never from guesswork.
- **Conformance coverage**: fixtures include a package advertising via field, one via
  conventional filename only, and one advertising a missing/invalid file (consumer must
  surface a clean error, not crash).
