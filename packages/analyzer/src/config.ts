/**
 * Framework resolution and (US3) settings-file loading + merge.
 *
 * The generic `framework` option resolves to one bundled plugin per named framework, in
 * the order named; an empty selection falls back to the vanilla default. User `plugins[]`
 * run after the framework plugins, in array order (deterministic).
 *
 * A committed `acm-analyzer.config.{js,mjs}` is discovered at the invocation cwd (or
 * given explicitly with `--config`) and loaded with native dynamic `import()` — it is
 * the operator's own trusted code (the CEM/ESLint/Vite model); analyzed *sources* are
 * never executed. Precedence is **CLI flag > settings file > built-in default**
 * (contracts/config-file.md); list options (`globs`/`exclude`) are replaced, never
 * merged. Any problem with the file is a fatal configuration error (exit 2, `UsageError`)
 * that names the file — never a silent fallback to defaults.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { UsageError } from "./diagnostics.js";
import type { AnalyzerPlugin } from "./plugin.js";
import {
  BUILTIN_FRAMEWORKS,
  defaultSettings,
  type AnalyzerSettings,
  type BuiltinFramework,
} from "./types.js";
import { vanillaPlugin } from "./frameworks/vanilla.js";
import { litPlugin } from "./frameworks/lit.js";
import { stencilPlugin } from "./frameworks/stencil.js";
import { reactPlugin } from "./frameworks/react.js";
import { angularPlugin } from "./frameworks/angular.js";

/** Map a built-in framework name to its bundled plugin. */
const BUILTIN_PLUGINS: Record<BuiltinFramework, () => AnalyzerPlugin> = {
  vanilla: vanillaPlugin,
  lit: litPlugin,
  stencil: stencilPlugin,
  angular: angularPlugin,
  react: reactPlugin,
};

/**
 * Validate, flatten (`a,b` → `a`, `b`), and de-duplicate a framework selection, keeping
 * the first occurrence of each name so plugin order stays exactly as the operator wrote
 * it. `where` names the origin (a flag or a settings file) in the fatal message.
 */
export function normalizeFrameworks(values: string[], where: string): BuiltinFramework[] {
  const out: BuiltinFramework[] = [];
  for (const raw of values.flatMap((v) => v.split(","))) {
    const name = raw.trim();
    if (name === "") continue;
    if (!(BUILTIN_FRAMEWORKS as readonly string[]).includes(name)) {
      throw new UsageError(
        `${where}: unknown framework "${name}"; supported: ${BUILTIN_FRAMEWORKS.join(", ")} (omit for vanilla)`,
      );
    }
    if (!out.includes(name as BuiltinFramework)) out.push(name as BuiltinFramework);
  }
  return out;
}

/**
 * Resolve the ordered plugin list: framework plugins in selection order, then user
 * plugins. An empty selection runs the vanilla plugin alone (the zero-config default).
 */
export function resolvePlugins(settings: AnalyzerSettings): AnalyzerPlugin[] {
  const frameworks = settings.frameworks.length
    ? settings.frameworks.map((name) => BUILTIN_PLUGINS[name]())
    : [vanillaPlugin()];
  return [...frameworks, ...settings.plugins];
}

// ---------------------------------------------------------------------------
// Settings-file loading (T035) + merge (T036)
// ---------------------------------------------------------------------------

/** Auto-discovered settings-file basenames, in precedence order. */
export const CONFIG_BASENAMES = ["acm-analyzer.config.js", "acm-analyzer.config.mjs"] as const;

/** The keys a settings file may declare; every other key is a fatal typo. */
const SETTINGS_KEYS = new Set([
  "globs",
  "exclude",
  "outdir",
  "framework",
  "frameworks",
  "dev",
  "quiet",
  "watch",
  "plugins",
]);

/** A plugin must define at least one of these lifecycle hooks (plus a `name`). */
const HOOK_KEYS = ["preprocess", "collect", "analyze", "moduleLink", "packageLink"] as const;

/** A validated settings-file object (subset of `AnalyzerSettings`; no `config`). */
export interface FileConfig {
  globs?: string[];
  exclude?: string[];
  outdir?: string;
  /** Normalized from either the `framework` or the `frameworks` key (never both). */
  frameworks?: BuiltinFramework[];
  dev?: boolean;
  quiet?: boolean;
  watch?: boolean;
  plugins?: AnalyzerPlugin[];
}

/** The explicitly-provided CLI values that override the file (`plugins` is file-only). */
export type CliOverrides = Partial<
  Pick<AnalyzerSettings, "globs" | "exclude" | "outdir" | "frameworks" | "dev" | "quiet" | "watch">
>;

/** Parsed CLI arguments: the explicit `--config` path and the explicit flag overrides. */
export interface CliArgs {
  configPath?: string;
  overrides: CliOverrides;
}

/** POSIX-relative label for a file, for stable cross-platform diagnostics. */
function rel(cwd: string, file: string): string {
  return path.relative(cwd, file).split(path.sep).join("/") || path.basename(file);
}

function asString(value: unknown, key: string, file: string): string {
  if (typeof value !== "string") {
    throw new UsageError(`settings file ${file}: "${key}" must be a string`);
  }
  return value;
}

function asBoolean(value: unknown, key: string, file: string): boolean {
  if (typeof value !== "boolean") {
    throw new UsageError(`settings file ${file}: "${key}" must be a boolean`);
  }
  return value;
}

function asStringArray(value: unknown, key: string, file: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new UsageError(`settings file ${file}: "${key}" must be an array of strings`);
  }
  return value as string[];
}

/**
 * Read a framework selection written as either a single name or a list of them. Both the
 * singular `framework` and the plural `frameworks` key accept both shapes; the caller
 * enforces that a file uses only one of the two keys.
 */
function asFrameworks(value: unknown, key: string, file: string): BuiltinFramework[] {
  const raw = Array.isArray(value) ? value : [value];
  if (!raw.every((v) => typeof v === "string")) {
    throw new UsageError(`settings file ${file}: "${key}" must be a string or an array of strings`);
  }
  return normalizeFrameworks(raw as string[], `settings file ${file}`);
}

function asPlugins(value: unknown, file: string): AnalyzerPlugin[] {
  if (!Array.isArray(value)) {
    throw new UsageError(`settings file ${file}: "plugins" must be an array`);
  }
  value.forEach((entry, i) => {
    if (entry === null || typeof entry !== "object") {
      throw new UsageError(`settings file ${file}: plugins[${i}] is not a plugin object`);
    }
    const plugin = entry as Record<string, unknown>;
    if (typeof plugin.name !== "string" || plugin.name.length === 0) {
      throw new UsageError(`settings file ${file}: plugins[${i}] is missing a string "name"`);
    }
    if (!HOOK_KEYS.some((hook) => typeof plugin[hook] === "function")) {
      throw new UsageError(
        `settings file ${file}: plugins[${i}] ("${plugin.name}") defines no lifecycle hook (one of ${HOOK_KEYS.join(", ")})`,
      );
    }
  });
  return value as AnalyzerPlugin[];
}

/** Validate a settings file's default export into a typed, key-checked `FileConfig`. */
export function validateFileConfig(raw: unknown, file: string): FileConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UsageError(
      `settings file ${file}: the default export must be a configuration object`,
    );
  }
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!SETTINGS_KEYS.has(key)) {
      throw new UsageError(
        `settings file ${file}: unknown key "${key}" (allowed: ${[...SETTINGS_KEYS].join(", ")})`,
      );
    }
  }

  if (obj.framework !== undefined && obj.frameworks !== undefined) {
    throw new UsageError(`settings file ${file}: set either "framework" or "frameworks", not both`);
  }

  const config: FileConfig = {};
  if (obj.globs !== undefined) config.globs = asStringArray(obj.globs, "globs", file);
  if (obj.exclude !== undefined) config.exclude = asStringArray(obj.exclude, "exclude", file);
  if (obj.outdir !== undefined) config.outdir = asString(obj.outdir, "outdir", file);
  if (obj.framework !== undefined) {
    config.frameworks = asFrameworks(obj.framework, "framework", file);
  }
  if (obj.frameworks !== undefined) {
    config.frameworks = asFrameworks(obj.frameworks, "frameworks", file);
  }
  if (obj.dev !== undefined) config.dev = asBoolean(obj.dev, "dev", file);
  if (obj.quiet !== undefined) config.quiet = asBoolean(obj.quiet, "quiet", file);
  if (obj.watch !== undefined) config.watch = asBoolean(obj.watch, "watch", file);
  if (obj.plugins !== undefined) config.plugins = asPlugins(obj.plugins, file);
  return config;
}

/** A loaded settings file: its validated config and the POSIX-relative path it came from. */
export interface LoadedConfig {
  config: FileConfig;
  path: string;
}

/**
 * Discover and load the settings file. Returns `undefined` when no file is present and
 * none was requested (auto-discovery is not an error). An explicit `--config` path that
 * is missing, an unreadable/throwing file, a non-object default export, or any invalid
 * field is a fatal `UsageError` (exit 2) — never a silent fallback to defaults.
 */
export async function loadConfigFile(
  cwd: string,
  explicitPath: string | undefined,
): Promise<LoadedConfig | undefined> {
  let file: string;
  if (explicitPath !== undefined) {
    file = path.resolve(cwd, explicitPath);
    if (!existsSync(file)) {
      throw new UsageError(`settings file not found: ${explicitPath}`);
    }
  } else {
    const found = CONFIG_BASENAMES.map((base) => path.join(cwd, base)).find((p) => existsSync(p));
    if (found === undefined) return undefined;
    file = found;
  }

  const label = rel(cwd, file);
  let mod: unknown;
  try {
    mod = await import(pathToFileURL(file).href);
  } catch (err) {
    throw new UsageError(`settings file ${label}: failed to load — ${(err as Error).message}`);
  }
  const raw = (mod as { default?: unknown }).default;
  if (raw === undefined) {
    throw new UsageError(`settings file ${label}: missing a default export`);
  }
  return { config: validateFileConfig(raw, label), path: label };
}

/**
 * Merge defaults ← settings file ← CLI overrides (field-by-field). List options
 * (`globs`/`exclude`/`frameworks`) are replaced by whichever layer sets them last, never
 * merged — a `--framework` flag selects the whole set, it does not add to the file's.
 */
export function mergeSettings(file: FileConfig | undefined, cli: CliOverrides): AnalyzerSettings {
  const s = defaultSettings();
  if (file) {
    if (file.globs !== undefined) s.globs = file.globs;
    if (file.exclude !== undefined) s.exclude = file.exclude;
    if (file.outdir !== undefined) s.outdir = file.outdir;
    if (file.frameworks !== undefined) s.frameworks = file.frameworks;
    if (file.dev !== undefined) s.dev = file.dev;
    if (file.quiet !== undefined) s.quiet = file.quiet;
    if (file.watch !== undefined) s.watch = file.watch;
    if (file.plugins !== undefined) s.plugins = file.plugins;
  }
  if (cli.globs !== undefined) s.globs = cli.globs;
  if (cli.exclude !== undefined) s.exclude = cli.exclude;
  if (cli.outdir !== undefined) s.outdir = cli.outdir;
  if (cli.frameworks !== undefined) s.frameworks = cli.frameworks;
  if (cli.dev !== undefined) s.dev = cli.dev;
  if (cli.quiet !== undefined) s.quiet = cli.quiet;
  if (cli.watch !== undefined) s.watch = cli.watch;
  return s;
}

/**
 * Resolve final settings from parsed CLI args and the (optional) settings file.
 * Applies precedence, records the resolved config path, and enforces the `dev`/`quiet`
 * mutual exclusion on the merged result (so a file that sets both is caught too).
 */
export async function resolveSettings(args: CliArgs, cwd: string): Promise<AnalyzerSettings> {
  const loaded = await loadConfigFile(cwd, args.configPath);
  const settings = mergeSettings(loaded?.config, args.overrides);
  settings.config = loaded?.path;
  if (settings.dev && settings.quiet) {
    throw new UsageError("`dev` and `quiet` are mutually exclusive");
  }
  return settings;
}
