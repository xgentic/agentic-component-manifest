# Contract: doc-comment tags `@acmSemantic` and `@example`

The analyzer's authoring surface for Tier-2 content. These sit alongside the existing
CEM doc-comment tags (`@fires`/`@event`, `@slot`, `@cssprop`/`@cssproperty`, `@csspart`)
and the leading description, in a **component declaration's** doc comment. Both are
optional; a component with neither is fully conformant.

This is a **producer** contract (how the reference analyzer reads source), not part of
the ACM Normative Spec — the emitted `semantics`/`examples` fields are the schema's, and
are unchanged.

## `@acmSemantic` — semantic classification

```
@acmSemantic <term> - <notes>
```

- **`<term>`** (required): everything before the first ` - `, trimmed. MUST be one of the
  controlled-vocabulary terms (the `semanticClassification.term` enum in the schema, 45
  values such as `button`, `dialog`, `tabs`, `combobox`, `grid`, `switch`). Case-sensitive
  match against the enum.
- **`<notes>`** (optional): everything after the first ` - `, trimmed, emitted verbatim as
  `semantics.notes` (≤ 2048 chars).
- Matching is case-insensitive on the tag name (`@acmSemantic` == `@acmsemantic`).
- **One per declaration.** A second `@acmSemantic` is ignored; the first in source order
  wins (`ACM-A-SEMDUP`).

**Emitted**: `"semantics": { "term": "<term>", "notes": "<notes>" }` (notes omitted when absent).

| Situation | Result |
|-----------|--------|
| valid term, no notes | `semantics: { term }` |
| valid term + notes | `semantics: { term, notes }` |
| term not in vocabulary | **no `semantics`** + `ACM-A-SEMTERM` (warning) |
| empty term (`@acmSemantic` alone, or `@acmSemantic - notes`) | **no `semantics`** + `ACM-A-SEMTERM` |
| notes > 2048 chars | notes dropped to stay in-limit + `ACM-A-EXLIMIT`; term still emitted |
| duplicate tag | first wins; extras → `ACM-A-SEMDUP` |

**Example**

```ts
/**
 * A themable on/off toggle rendered as a custom element.
 * @acmSemantic switch - Reflects an on/off state; the label names the action.
 */
export class AcmeToggle extends HTMLElement { /* … */ }
```

→ `"semantics": { "term": "switch", "notes": "Reflects an on/off state; the label names the action." }`

## `@example` — usage example

```
@example [caption]
[```lang]
<source>
[```]
```

- Standard JSDoc/TSDoc `@example`. **One `examples[]` entry per block**, in source order.
- **Title**: if the block's first line is plain prose (not a fence, not code), it becomes
  `title` (≤ 256 chars); the rest is `source`.
- **`lang`**: from a fenced code block info string — `html` → `html`, `tsx`/`jsx` → `tsx`,
  `ts`/`js`/none → `ts`. An unsupported fence language → example dropped (`ACM-A-EXLANG`).
- **`source`**: the verbatim code (fence markers stripped), ≤ 8192 chars.
- Each example MUST **compile against the component** (see
  [example-verification.md](./example-verification.md)); non-compiling examples are dropped
  with `ACM-A-EXCOMPILE` and never reach the manifest.
- ≤ 32 examples per declaration; extras dropped (`ACM-A-EXLIMIT`).

**Emitted**: `"examples": [ { "title"?, "lang", "source" }, … ]` (in source order; omitted when empty).

| Situation | Result |
|-----------|--------|
| compiling example, no caption | `{ lang, source }` |
| compiling example + first-line caption | `{ title, lang, source }` |
| ```` ```html ```` fenced block | `{ lang: "html", source }` |
| empty body | dropped + `ACM-A-EXEMPTY` |
| unsupported fence language | dropped + `ACM-A-EXLANG` |
| does not compile against the component | dropped + `ACM-A-EXCOMPILE` |
| > 32 examples | first 32 kept; extras → `ACM-A-EXLIMIT` |

**Example**

```ts
/**
 * @example Basic usage
 * ```ts
 * const t = document.createElement('acme-toggle');
 * t.checked = true;
 * document.body.append(t);
 * ```
 */
export class AcmeToggle extends HTMLElement { checked = false; }
```

→ `"examples": [ { "title": "Basic usage", "lang": "ts", "source": "const t = document.createElement('acme-toggle');\nt.checked = true;\ndocument.body.append(t);" } ]`

## Determinism & framework-blindness

The same doc comment yields byte-identical `semantics`/`examples` on every run and every
platform, and identical output whether the component is vanilla, Lit, Angular, or React —
extraction happens in the analyzer's shared doc-comment layer, before any framework-specific
handling.
