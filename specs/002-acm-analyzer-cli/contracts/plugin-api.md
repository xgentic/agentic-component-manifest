# Contract: public plugin interface

Exported from `@acm/analyzer` (`plugin.ts`). Built-in framework plugins consume
exactly this interface — there is no privileged internal seam (SC-005 by
construction). Phase names inherit the CEM analyzer's lifecycle vocabulary
(Principle VIII: no new names for shared concepts).

## Interface

```ts
export interface AnalyzerPlugin {
  /** Unique per session; diagnostics are attributed to it. */
  name: string;

  /** Extra extensions merged into the DEFAULT globs (never into user-supplied globs). */
  fileExtensions?: string[];

  /**
   * Optional container-format unwrap (e.g. Vue SFC -> script text + offset map).
   * Pure function of the file contents; must not read other files or execute code.
   */
  preprocess?(file: { path: string; text: string }): PreprocessResult | undefined;

  /** Per-module pre-pass: gather cross-declaration facts before analysis. */
  collect?(module: ModuleContext, ctx: SessionContext): void;

  /** Per-declaration extraction: fill EntryDraft members from the syntax node. */
  analyze?(node: import('typescript').Node, module: ModuleContext, ctx: SessionContext): void;

  /** Per-module post-pass: exports, re-export deduplication. */
  moduleLink?(module: ModuleContext, ctx: SessionContext): void;

  /** Whole-manifest post-pass: final ordering-safe contributions. */
  packageLink?(manifest: ManifestDraft, ctx: SessionContext): void;
}
```

`SessionContext` exposes: resolved read-only settings, `addDiagnostic()`, the
`EntryDraft` factory (the only way to create entries), and the TypeMapping service
(the only way to produce `{ structured, raw }` type nodes). `ModuleContext` exposes
the module's path, verbatim text, syntax-only `ts.SourceFile`, and its entry drafts.

## Contribution rules (enforced, not trusted)

1. **Tier 1 or `x-*`.** Core fields accept only values traceable to the analyzed
   source through the draft API (verbatim doc-comment spans, source type slices).
   Free-form or framework-specific data goes under namespaced `x-*` keys; the draft
   API rejects unnamespaced unknown keys.
2. **Descriptions cannot be synthesized.** The draft API takes description *spans*,
   not strings — a plugin cannot invent prose into core fields (FR-008). `x-*` takes
   arbitrary JSON.
3. **Validation is the backstop.** After `packageLink`, the manifest must pass the
   reference validator (schema + NS-LIMIT structural limits). A plugin contribution
   that invalidates the manifest aborts emission with a diagnostic attributed to that
   plugin; nothing is written (US4 scenario 4).
4. **Determinism.** Hooks must be pure with respect to session inputs: no clocks, no
   randomness, no network, no environment reads. Plugin execution order is fixed:
   framework plugin, then user plugins in `plugins[]` array order.
5. **Identity discipline.** One `EntryDraft` per implementation artifact; the draft
   factory requires `paradigmClass` plus at least one identity facet and rejects
   merged cross-framework surfaces.

## Registration

- **Built-in frameworks**: selected via `framework: '<name>'` — resolved to the
  bundled plugin implementing this same interface.
- **External plugins**: instantiated in the settings file and passed in `plugins[]`.
  A complete external *framework* is `plugins: [myFramework()]` with `framework`
  unset (the vanilla default pass is inert on non-matching sources) — this is the
  configuration the SC-005 demonstration test uses.
