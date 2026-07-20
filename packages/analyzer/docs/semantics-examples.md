# Semantics & examples doc tags

How the analyzer derives the two Tier-2 agent-facing fields — `semantics` and `examples` —
from a component's source doc comment (feature 003). Both are **optional**: a component
with neither is fully conformant. Extraction happens in the shared doc-comment layer, so it
works identically for vanilla, Lit, Angular, and React components.

Provenance note (Principle IV): the term, notes, and example source are read **verbatim**
from the doc comment. Enrich by improving the comment and re-running the analyzer — never by
hand-editing the manifest.

## `@acmSemantic` — semantic classification

```
@acmSemantic <term> - <notes>
```

- `<term>` (required) — the text before the first ` - `, which MUST be one of the controlled
  vocabulary terms (the `semanticClassification.term` enum, ~45 Open-UI / WAI-ARIA-anchored
  values such as `button`, `dialog`, `tabs`, `combobox`, `grid`, `switch`).
- `<notes>` (optional) — free text after the first ` - `, emitted verbatim (≤ 2048 chars).
- One per component; a second `@acmSemantic` is ignored (first in source order wins).

```ts
/**
 * A themable on/off toggle rendered as a custom element.
 * @acmSemantic switch - Reflects an on/off state; the label names the action.
 */
export class AcmeToggle extends HTMLElement {}
```

→ `"semantics": { "term": "switch", "notes": "Reflects an on/off state; the label names the action." }`

An unknown term, an empty term, or a duplicate is a **warning** (`ACM-A-SEMTERM` /
`ACM-A-SEMDUP`) and the field is dropped — the manifest stays valid. Notes over the length
limit are dropped (`ACM-A-EXLIMIT`) while the term is kept.

## `@example` — compile-verified usage examples

Standard JSDoc/TSDoc `@example`. One `examples[]` entry per block, in source order:

- **`title`** — a leading caption line before the fenced code block (optional, ≤ 256 chars).
- **`lang`** — from the fence info string: `html` → `html`, `tsx`/`jsx` → `tsx`,
  `ts`/`js`/none → `ts`. An unsupported language is dropped (`ACM-A-EXLANG`).
- **`source`** — the verbatim code inside the fence (markers stripped, ≤ 8192 chars).

```ts
/**
 * @example Basic usage
 * ```ts
 * const t = new AcmeToggle();
 * t.checked = true;
 * ```
 */
export class AcmeToggle extends HTMLElement { checked = false; }
```

### Compile-verification (what makes examples trustworthy)

Every `ts`/`tsx` example is **type-checked against the component** before it reaches the
manifest, in a hermetic producer-side sandbox (one `ts.Program` per run, pinned compiler
options, no `node_modules` resolution). An example that does not compile is **excluded** from
`examples[]` with an `ACM-A-EXCOMPILE` warning naming the error — so a manifest never ships a
usage example that does not work.

- Examples must be expressible against **the component itself + standard DOM/JS globals**.
  An example importing an external package the analyzed source set does not include will fail
  the gate (documented limitation, not a silent drop — the diagnostic names the unresolved
  symbol).
- **HTML examples are surfaced verbatim, not compiled** (there is no TS program for HTML).
- More than 32 examples, or an over-limit source/title, degrade to "dropped + `ACM-A-EXLIMIT`".

The keep/drop decision is a pure function of the analyzed sources, so output is byte-identical
across runs and platforms (Principle V).

## Diagnostics

All doc-metadata diagnostics are `warning` severity (exit 3, manifest still written) —
optional Tier-2 content degrades to "absent + diagnostic", never a failed build.

| Code | Meaning |
|------|---------|
| `ACM-A-SEMTERM` | term missing or not in the controlled vocabulary; semantics dropped |
| `ACM-A-SEMDUP` | duplicate `@acmSemantic`; first wins, extras dropped |
| `ACM-A-EXLANG` | `@example` fence language unsupported; example dropped |
| `ACM-A-EXEMPTY` | `@example` block has no code body; example dropped |
| `ACM-A-EXCOMPILE` | example failed to compile against the component; example dropped |
| `ACM-A-EXLIMIT` | a notes/example value exceeds a structural limit (or > 32 examples); item dropped |

See the feature contracts for the full specification:
[doc-tags](../../../specs/003-jsdoc-semantics-examples/contracts/doc-tags.md),
[example-verification](../../../specs/003-jsdoc-semantics-examples/contracts/example-verification.md).
