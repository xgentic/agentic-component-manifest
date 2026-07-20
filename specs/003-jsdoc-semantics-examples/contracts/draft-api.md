# Contract: draft-API additions (`EntryDraft`)

Additive extension of the public plugin interface in
[`plugin.ts`](../../../packages/analyzer/src/plugin.ts). No existing signature changes, so
every current framework and external plugin keeps working unchanged (Principle VII).

## New draft types

```ts
export interface SemanticDraft {
  /** Controlled-vocabulary term; the analyzer validates membership before this is set. */
  term: string;
  /** Optional verbatim notes span (accompanies, never replaces, the term). */
  notes?: Span;
}

export interface ExampleDraft {
  lang: "ts" | "tsx" | "html";
  /** Verbatim example source (fence markers stripped). */
  source: Span;
  title?: string;
}
```

Both use the existing `Span` type for verbatim source content — consistent with `describe(span)`
and the member drafts (Tier-1-style provenance for authored content).

## New `EntryDraft` methods

```ts
export interface EntryDraft {
  // … existing describe / addInput / addEvent / addSlot / addMethod / addCssProperty /
  //   addCssPart / set …

  /** Set the declaration's semantic classification (at most one; last call wins at the API
   *  level — callers enforce first-wins + ACM-A-SEMDUP before calling). */
  setSemantics(semantic: SemanticDraft): void;

  /** Append a usage example, preserving source order. Verified before emit. */
  addExample(example: ExampleDraft): void;
}
```

## Provenance & serialization

- `setSemantics` records provenance path `/semantics`; `addExample` records `/examples/<n>`
  (mirrors the existing `record()` calls for `inputs`/`events`). Keeps emit-time attribution
  (`buildProvenance` in [`context.ts`](../../../packages/analyzer/src/context.ts)) correct if a
  value ever trips the reference validator.
- `EntryDraftImpl.toEntry()` serializes `semantics` and `examples` in schema key order
  (after `cssParts`, before `x-*` extensions), omitting them when empty.

## Internal-only (not on the public interface)

```ts
// EntryDraftImpl only — used by the core verification pass, never exposed to plugins:
pruneExamples(keep: boolean[]): void;   // drop examples whose keep flag is false, order-stable
```

Verification is a **core** concern (like emit-time validation), so the pruning handle is
internal to `context.ts`; plugins receive the read-only `ManifestDraft` view and cannot
mutate examples.

## Invariants

- Adding these methods MUST NOT change the behavior of any existing draft method.
- `semantics` is emitted only with a valid `term`; `examples` only after verification.
- Absent-when-empty: no `semantics`/`examples` key when the declaration has none (FR-006).
