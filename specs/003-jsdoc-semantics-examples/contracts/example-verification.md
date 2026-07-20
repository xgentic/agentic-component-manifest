# Contract: example compile-verification sandbox

Defines the hermetic type-check that gates whether an extracted `@example` reaches the core
`examples[]` array. Implemented by `examples-verify.ts`, invoked from `run.ts` after the
engine and before emit. This is the mechanism that makes examples true Tier-2 content
(mechanically verified, Principle IV) while preserving determinism (Principle V).

## Inputs

- The analyzed source set: `ModuleContextInternal[]`, each with its parsed `ts.SourceFile`.
- Per candidate example: the owning module's relative path, the component's exported name
  (from the entry's identity `export` facet), the example `source`, and `lang`.

Examples whose owning entry has **no export facet** (e.g. a vanilla component identified only
by `tagName`) are verified against the component's module by side-effect import
(`import '<module>'; <source>`), since there is no export to name.

## Compiler configuration (pinned, hermetic)

```ts
const OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],                 // no @types/* ambient pollution
  noEmitOnError: false,
};
```

- **No external `node_modules` resolution.** The custom `CompilerHost` resolves only:
  (1) the analyzed source `SourceFile`s (overlaid, keyed by their paths), (2) the synthetic
  example modules, (3) the pinned TypeScript `lib.*.d.ts` files. Any other import fails.
- Pinned `lib`/`target`/`module` make the gate a pure function of the analyzed sources —
  independent of the host's installed dependencies or TS lib, which is what protects SC-003
  (byte-identical output across machines).

## Synthetic module

One in-memory module per example, named deterministically:

```
__acm_example_<moduleIndex>_<entryIndex>_<exampleIndex>.<ext>
```

(`ext` = `tsx` for `lang: "tsx"`, else `ts`; `html` examples are **not** compiled — see below).
Contents:

```ts
import { <ComponentExport> } from '<relative path to owning module, no extension>';
<example source>
```

(or `import '<module>'; <source>` when the entry has no export facet).

## Decision

- One `ts.Program` per analysis run over the host above; obtain
  `getSemanticDiagnostics(file) ∪ getSyntacticDiagnostics(file)` **scoped to each synthetic
  file only**.
- **Keep** the example ⇔ its synthetic file has zero diagnostics. Otherwise **drop** it and
  emit `ACM-A-EXCOMPILE` (severity `warning`) whose message names the owning source file and
  the first TypeScript error text.
- `lang: "html"` examples are **not** type-checked (there is no TS program for HTML); they are
  kept as-is (extraction-validated only). This is a documented limitation — HTML usage
  snippets are surfaced verbatim, not compiled.

## Determinism requirements

- No timestamps, no environment reads, no randomness. Synthetic file names derive only from
  stable indices. Diagnostics affect **inclusion**, never emitted text (emitted `source` is
  always the verbatim slice).
- Same sources ⇒ same keep/drop set ⇒ byte-identical `examples[]`. Pinned by a double-run
  byte-identity assertion in the conformance suite (SC-003).

## Performance

- Exactly one `ts.Program` construction + one checker pass per analysis run (not per example).
- Synthetic modules are tiny and share the component `SourceFile`s. Target: within the
  existing SC-007 ceiling (100-component bench < 30 s).

## Failure isolation

- A non-compiling example affects **only itself**: other examples on the same declaration,
  the declaration's `semantics`, and every other component are unaffected (FR-008).
- Verification never writes to disk and never aborts the manifest; it only prunes optional
  content and adds warnings (exit 3 when any fire, exit 0 when all clean).
