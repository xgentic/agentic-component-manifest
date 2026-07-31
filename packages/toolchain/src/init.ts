import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildSkillFiles } from "./agent-docs.js";
import { assembleCorpus } from "./corpus.js";

/**
 * `acm init` — wire the Discovery Skill into a consuming project.
 *
 * Two halves, deliberately kept apart:
 *
 *  1. **Install.** Write the skill verbatim from `buildSkillFiles()` into the location
 *     the detected host reads. No new rendering path exists here: the installed bytes
 *     equal the `agent-docs` target's bytes, so the G3 fidelity gate keeps meaning what
 *     it says. Nothing project-specific — no corpus data, no invocation prefix — is ever
 *     interpolated into the file. Generation stays corpus-agnostic (ADR 0004,
 *     architecture §8) precisely so hostile Manifest text cannot ride into an agent's
 *     resident context by way of a generated file.
 *
 *  2. **Preflight.** Report whether discovery will actually work in this project: is the
 *     corpus non-empty, are any Manifests broken, is the `acm` binary reachable. This is
 *     transient stdout, never written anywhere, and carries only counts, package
 *     identifiers, filesystem paths, and `ACM-*` rule ids — never Manifest prose
 *     (NS-DATA-1).
 */

/**
 * The installable targets. `skills-package` is deliberately absent: it is a *source*
 * directory an external installer (`npx skills`) is pointed at, not a destination
 * inside a project. It remains an `agent-docs` target.
 */
export const INIT_TARGETS = ["claude-skill", "agents-md", "rules"] as const;
export type InitTarget = (typeof INIT_TARGETS)[number];

/** Project-relative destination of each target, `/`-separated. */
export const INIT_DESTINATIONS: Record<InitTarget, string> = {
  "claude-skill": ".claude/skills/acm-discovery/SKILL.md",
  "agents-md": "AGENTS.md",
  rules: ".cursor/rules/acm-discovery.md",
};

/** Managed-region markers for the `agents-md` target — everything outside is untouched. */
export const REGION_START = "<!-- acm:skill start -->";
export const REGION_END = "<!-- acm:skill end -->";

export type InitAction = "created" | "updated" | "fresh" | "blocked";

export interface InitInstall {
  target: InitTarget;
  /** Project-relative, `/`-separated (determinism: never absolute). */
  path: string;
  action: InitAction;
  /** Present on `blocked`: why the write was refused. */
  reason?: string;
}

export interface PreflightSource {
  /** Package name where known, else the manifest's project-relative path. */
  name: string;
  components: number;
}

export interface InitPreflight {
  manifests: number;
  components: number;
  sources: PreflightSource[];
  /** Rule id + path only — never the offending Manifest's text. */
  diagnostics: Array<{ ruleId: string; path: string }>;
}

export interface InitReport {
  /** Absolute project directory the skill was installed into. */
  project: string;
  dryRun: boolean;
  installs: InitInstall[];
  preflight: InitPreflight;
  /** Whether an agent can invoke a bare `acm` from this project. */
  cliResolvable: boolean;
}

export interface InitOptions {
  project?: string;
  /** Explicit targets; omitted means detect from the project. */
  targets?: InitTarget[];
  force?: boolean;
  dryRun?: boolean;
}

/**
 * Host detection: every match installs, so a project with both `.claude/` and an
 * `AGENTS.md` gets both. Order is fixed for deterministic output. A project with no
 * recognizable host gets the Claude Code skill, creating the directory.
 */
export function detectTargets(project: string): InitTarget[] {
  const isDir = (rel: string): boolean => {
    const full = path.join(project, rel);
    return existsSync(full) && statSync(full).isDirectory();
  };
  const detected: InitTarget[] = [];
  if (isDir(".claude")) detected.push("claude-skill");
  if (existsSync(path.join(project, "AGENTS.md"))) detected.push("agents-md");
  if (isDir(".cursor")) detected.push("rules");
  return detected.length > 0 ? detected : ["claude-skill"];
}

/** The skill body each target installs, keyed by target — verbatim `agent-docs` output. */
function targetContents(): Record<InitTarget, string> {
  const { files, targets } = buildSkillFiles();
  const contentOf = (name: string): string => {
    const rel = targets[name]!;
    return files.find(([p]) => p === rel)![1];
  };
  return {
    "claude-skill": contentOf("claude-skill"),
    "agents-md": contentOf("agents-md"),
    rules: contentOf("rules"),
  };
}

/** Replace the managed region in an existing `AGENTS.md`, or append one. */
export function applyRegion(existing: string | null, fragment: string): string {
  const region = `${REGION_START}\n${fragment.trim()}\n${REGION_END}\n`;
  if (existing === null || existing.trim() === "") return region;
  const start = existing.indexOf(REGION_START);
  const end = existing.indexOf(REGION_END);
  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + REGION_END.length).replace(/^\n/, "");
    return `${before}${region}${after}`;
  }
  return `${existing.replace(/\n*$/, "")}\n\n${region}`;
}

function installOne(
  project: string,
  target: InitTarget,
  content: string,
  options: { force: boolean; dryRun: boolean },
): InitInstall {
  const relative = INIT_DESTINATIONS[target];
  const absolute = path.join(project, relative);
  const current = existsSync(absolute) ? readFileSync(absolute, "utf8") : null;

  // `agents-md` owns a marked region inside a file the project also writes, so a
  // difference outside the region is not a conflict — it is simply not ours.
  const desired = target === "agents-md" ? applyRegion(current, content) : content;

  if (current === desired) return { target, path: relative, action: "fresh" };
  if (current !== null && target !== "agents-md" && !options.force) {
    return {
      target,
      path: relative,
      action: "blocked",
      reason: "file exists with different content; rerun with --force to overwrite",
    };
  }
  if (!options.dryRun) {
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, desired);
  }
  return { target, path: relative, action: current === null ? "created" : "updated" };
}

/**
 * Can an agent invoke a bare `acm` from this project? A local install (the documented
 * `@acm/toolchain` devDependency) or anything on PATH counts.
 */
function cliIsResolvable(project: string): boolean {
  if (existsSync(path.join(project, "node_modules/.bin/acm"))) return true;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (dir !== "" && existsSync(path.join(dir, "acm"))) return true;
  }
  return false;
}

/**
 * Corpus preflight. Counts and identifiers only — a Manifest's descriptions, notes, and
 * example captions are untrusted data and never enter this report (NS-DATA-1).
 */
export function preflight(project: string): InitPreflight {
  const corpus = assembleCorpus({ project });
  const perEntry = new Map<string, number>();
  for (const entry of corpus.entries) perEntry.set(entry.path, 0);
  for (const component of corpus.components)
    perEntry.set(component.manifestPath, (perEntry.get(component.manifestPath) ?? 0) + 1);

  return {
    manifests: corpus.entries.length,
    components: corpus.components.length,
    sources: corpus.entries.map((entry) => ({
      name: entry.source.package ?? entry.path,
      components: perEntry.get(entry.path) ?? 0,
    })),
    diagnostics: corpus.diagnostics.map((d) => ({ ruleId: d.ruleId, path: d.path })),
  };
}

export function runInit(options: InitOptions = {}): InitReport {
  const project = path.resolve(options.project ?? process.cwd());
  const targets = options.targets ?? detectTargets(project);
  const contents = targetContents();
  const installOptions = { force: options.force === true, dryRun: options.dryRun === true };

  return {
    project,
    dryRun: installOptions.dryRun,
    installs: targets.map((target) =>
      installOne(project, target, contents[target], installOptions),
    ),
    preflight: preflight(project),
    cliResolvable: cliIsResolvable(project),
  };
}

/** Exit status: 3 when any write was refused, 0 otherwise (usage errors exit 2 in the CLI). */
export function exitStatusForInit(report: InitReport): number {
  return report.installs.some((i) => i.action === "blocked") ? 3 : 0;
}
