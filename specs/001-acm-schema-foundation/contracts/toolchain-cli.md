# Contract: Reference Toolchain CLI

Single binary `acm` (from `packages/toolchain`), library API mirrors commands 1:1.
All commands: deterministic, offline, exit 0 on success. Machine output on stdout,
diagnostics on stderr, `--json` for structured diagnostics.

| Command | Input | Output | Exit codes |
|---|---|---|---|
| `acm validate <file>` | manifest (.json/.yml) | diagnostics | 0 valid · 1 invalid (each error names node + rule) · 2 unreadable/out-of-profile input |
| `acm canonicalize <file>` | manifest JSON | ACM Canonical JSON on stdout | 0 · 1 invalid input; `--check` mode: 3 when input ≠ canonical form (drift) |
| `acm compile <file.yml>` | YAML authoring input | ACM Canonical JSON on stdout | 0 · 1 invalid result · 2 authoring-profile violation (names the profile rule) |
| `acm agent-view <file>` | canonical JSON | Agent View YAML on stdout | 0 · 1 invalid input · 3 input not canonical |
| `acm coverage` | schema + witness fixtures | node × paradigm-class matrix (`--json` or table) | 0 all cells witnessed/annotated · 4 unwitnessed unannotated cell(s) |
| `acm drift` | repo state | list of stale generated artifacts | 0 fresh · 3 drift detected |

Contract rules:

1. **Byte-stability**: identical input ⇒ byte-identical stdout, across platforms
   (SC-002). No timestamps, no environment data, no color codes in `--json`/piped mode.
2. **Error identification**: every diagnostic carries a JSON Pointer to the failing
   node and a stable rule id (e.g. `ACM-V-DEPTH`, `ACM-P-YAMLTAG`) — rule ids are part
   of this contract and listed in the Normative Spec traceability table.
3. **One-way Agent View**: no command parses Agent View YAML back; there is
   deliberately no `acm import-view` (ADR 0001).
4. **Untrusted input**: all commands apply structural limits before deep processing;
   over-limit input exits 1 with the limit rule id, never crashes or hangs (SC-006).
