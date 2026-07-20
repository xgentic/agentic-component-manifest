# Contract: settings file `acm-analyzer.config.{js,mjs}`

Auto-discovered at the project root (invocation cwd), or given explicitly via
`--config <path>`. Loaded with native dynamic `import()`; the default export is the
configuration object. The file is the operator's own trusted code (CEM/ESLint/Vite
model) — analyzed *sources* are never executed, the settings file is.

## Shape

```js
// acm-analyzer.config.js
import { myPlugin } from './tools/my-plugin.js';

export default {
  /** Include patterns. Default: ['src/**/*.{js,ts,jsx,tsx}'] (+ plugin extensions, e.g. .vue) */
  globs: ['src/**/*.ts'],
  /** Exclude patterns. Default: [] */
  exclude: ['**/*.test.ts'],
  /** Output directory for agentic-component-manifest.json. Default: '.' */
  outdir: 'dist',
  /** Framework plugin: 'lit' | 'stencil' | 'angular' | 'react' | 'vue'. Default: undefined → vanilla */
  framework: 'lit',
  /** Verbose diagnostics. Default: false */
  dev: false,
  /** Suppress progress output. Default: false */
  quiet: false,
  /** Re-analyze on change. Default: false */
  watch: false,
  /** Additional plugins (settings-file only), run after the framework plugin in array order */
  plugins: [myPlugin()],
};
```

## Rules

1. Every key is optional; unknown keys are a fatal configuration error (exit 2) —
   config typos must not silently no-op.
2. CLI flags override file values field-by-field; list-valued options (`globs`,
   `exclude`) are *replaced*, never merged.
3. A malformed file — unparseable, throwing on import, non-object default export,
   type-invalid field, unknown `framework` name — is a fatal error naming the file
   and the problem (exit 2). Never a silent fallback to defaults (spec edge case).
4. `plugins` entries must satisfy the [plugin interface](./plugin-api.md) shape
   (`name` string + at least one hook); violations are fatal config errors naming the
   offending index.
5. The settings file has no side channel into output: nothing from it (paths, names)
   is written into the manifest, preserving determinism and Tier 1 provenance.

## CEM analyzer migration map (SC-006)

| CEM analyzer | ACM analyzer |
|--------------|--------------|
| `globs` / `exclude` / `outdir` / `dev` / `quiet` / `watch` / `plugins` | same name, same meaning |
| `--litelement` | `framework: 'lit'` |
| `--stencil` | `framework: 'stencil'` |
| `--fast` / `--catalyst` | not shipped in v1 (plugin seam available; documented gap, not silent) |
| `overrideModuleCreation` | not in v1 (the `preprocess` hook covers container formats; revisit on demand) |
