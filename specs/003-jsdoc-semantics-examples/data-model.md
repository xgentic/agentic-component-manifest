# Data Model: Doc-Comment Semantics & Examples Extraction

The manifest shape is unchanged — `semantics` and `examples` already exist in
[`acm.schema.json`](../../packages/spec/schema/acm.schema.json) as Tier-2 fields on a
component declaration. This document defines the **analyzer-internal draft model** that
produces them and the **verification model** that gates examples. Nothing here is a new
manifest field.

## Emitted shape (existing schema — for reference)

```jsonc
// componentDeclaration (excerpt)
"semantics": { "term": "button", "notes": "Triggers the action named by its label." },
"examples": [
  { "title": "Basic", "lang": "ts", "source": "const b = document.createElement('acme-button');\n…" }
]
```

Limits (from the schema, enforced by the reference validator at emit): `semantics.term` ∈ the 45-term controlled vocabulary enum; `notes` ≤ 2048 chars; each `example.source` ≤ 8192; `example.title` ≤ 256; `example.lang` ∈ `{ts, tsx, html}`; ≤ 32 examples per declaration.

## Draft entities (analyzer-internal, in `plugin.ts`)

### SemanticDraft

| Field | Type | Notes |
|-------|------|-------|
| `term` | `string` | REQUIRED. Validated against `acmSchema.$defs.semanticClassification.term.enum` at extraction; an out-of-vocabulary or empty term is rejected (no draft produced) with `ACM-A-SEMTERM`. |
| `notes` | `Span?` | OPTIONAL. Verbatim source slice (Tier-1-style provenance, same `Span` type as descriptions). Emitted as `semantics.notes`. Never emitted without a valid `term`. |

Exactly one SemanticDraft per declaration. A second `@acmSemantic` is ignored with `ACM-A-SEMDUP` (first in source order wins — deterministic).

### ExampleDraft

| Field | Type | Notes |
|-------|------|-------|
| `lang` | `"ts" \| "tsx" \| "html"` | Detected from the fenced code block's info string; default `ts`. An unsupported fence language → `ACM-A-EXLANG`, example dropped. |
| `source` | `Span` | REQUIRED. Verbatim code region of the `@example` block (fence markers stripped). Empty body → `ACM-A-EXEMPTY`, dropped. |
| `title` | `string?` | OPTIONAL. The block's leading prose caption when present. |

Zero or more per declaration, **in source order**. Only examples that pass verification (below) survive into the emitted `examples[]`.

### EntryDraft additions (`EntryDraft` interface)

```ts
setSemantics(semantic: SemanticDraft): void;   // records provenance "/semantics"
addExample(example: ExampleDraft): void;        // records provenance "/examples/<n>"
```

Additive to the existing `describe`/`addInput`/…/`set` surface — no existing signature changes, so external plugins are unaffected. `EntryDraftImpl` also gains an **internal** `pruneExamples(keep: boolean[])` used only by the core verification pass (not on the public interface).

## Serialization (`context.ts` → schema shape)

`toEntry()` gains, in schema key order (after `cssParts`, before `x-*` extensions):

- `semantics` → `omitUndefined({ term, notes: notes?.text })` when a SemanticDraft is present.
- `examples` → `examples.map(e => omitUndefined({ title: e.title, lang: e.lang, source: e.source.text }))` when the (post-verification) list is non-empty.

Absent when empty (faithful absence, FR-006). `omitUndefined` + span→`.text` follow the existing member serializers exactly.

## Verification model (`examples-verify.ts`)

A pure function over the analyzed source set — no disk writes, no network.

| Element | Definition |
|---------|-----------|
| **Input** | The analyzed `ModuleContextInternal[]` (each carries a parsed `SourceFile`) and, per entry, its pending `ExampleDraft[]` with the owning module path + component export name. |
| **Synthetic module** | Per example: `import { <ComponentExport> } from '<relative module path>';` followed by the example `source`. Named deterministically (e.g. `__acm_example_<moduleIndex>_<entryIndex>_<exampleIndex>.ts`). |
| **Program** | One `ts.Program` per run over an in-memory `CompilerHost` overlaying the analyzed `SourceFile`s + all synthetic modules; pinned hermetic `CompilerOptions` (see [contracts/example-verification.md](./contracts/example-verification.md)); no external `node_modules`. |
| **Decision** | Example kept ⇔ its synthetic file has **zero** syntactic + semantic diagnostics. Otherwise dropped + `ACM-A-EXCOMPILE` (message: file + first TS error text). |
| **Output** | For each entry, the surviving `ExampleDraft[]` (order preserved) + accumulated diagnostics. Deterministic: identical sources → identical keep/drop set. |

State transition for a single example: `extracted → (verify) → kept | dropped(+diagnostic)`. Semantics has no verification step beyond vocabulary membership (checked at extraction).

## Relationships

- `ComponentDeclaration 1—0..1 SemanticClassification` (optional, one).
- `ComponentDeclaration 1—0..* UsageExample` (optional, ordered, each independently verified).
- `SemanticClassification.term → ControlledVocabulary` (enum membership; the vocabulary is owned by the schema, consumed read-only).
- Both attach only at the **declaration** level in v1 (no member-level semantics/examples).
