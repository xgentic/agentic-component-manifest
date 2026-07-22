#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { renderDiagnostics } from "./diagnostics.js";
import { validateManifest } from "./validate.js";
import { checkCanonical } from "./canonicalize.js";
import { compileYaml } from "./compile.js";
import { agentViewFromText } from "./agent-view.js";
import { computeCoverage, loadWitnessFixtures, renderMatrix } from "./coverage.js";
import { checkDrift } from "./drift.js";
import { buildSkillFiles } from "./agent-docs.js";
import { REPO_ROOT } from "./validate.js";
import {
  applicableOptions,
  findCommand,
  optionName,
  type CommandSpec,
  type DetailLevel,
} from "./registry.js";
import {
  capabilities as capabilitiesApi,
  componentWithDiagnostics,
  searchWithDiagnostics,
} from "./api.js";
import { AcmDiscoveryError, exitStatusFor, toErrorEnvelope } from "./envelope.js";
import type { CorpusDiagnostic } from "./corpus.js";
import {
  renderCapabilities,
  renderComponentDetail,
  renderComponentList,
  renderError,
  renderSearch,
} from "./render.js";

/**
 * Registry-driven parse + dispatch: every command's arguments and options come
 * from REGISTRY (spec 004 R-01) — the same data the capability manifest
 * projects — so an undescribed command or option cannot exist. Handlers are
 * thin wrappers over the programmatic API (R-08); discovery commands follow
 * the envelope/exit contract (contracts/envelope.md), pre-existing commands
 * keep their historical flags, exit codes, and output.
 */

const argv = process.argv.slice(2);
const commandName = argv[0];
/** `--json` anywhere in argv — needed for envelope emission on parse-layer failures. */
const rawJson = argv.includes("--json");

function fail(code: number, message: string): never {
  process.stderr.write(message + "\n");
  process.exit(code);
}

function readInput(file: string | undefined): string {
  if (!file) fail(2, "usage: acm <command> <file> [--check] [--json] [--write]");
  try {
    return readFileSync(file, "utf8");
  } catch {
    fail(2, `cannot read ${file}`);
  }
}

interface Invocation {
  values: Record<string, unknown>;
  positionals: string[];
}

function parseInvocation(spec: CommandSpec, args: string[]): Invocation {
  const options: Record<string, { type: "string" | "boolean"; multiple?: boolean }> = {};
  for (const opt of applicableOptions(spec)) {
    options[optionName(opt.flag)] = {
      type: opt.type === "boolean" ? "boolean" : "string",
      ...(opt.repeatable === true ? { multiple: true } : {}),
    };
  }
  const { values, positionals } = parseArgs({
    args,
    options,
    strict: true,
    allowPositionals: true,
  });
  if (spec.jsonSupported) {
    // Discovery commands enforce arity from the registry; legacy handlers keep
    // their historical checks (and messages) themselves.
    const required = spec.arguments.filter((a) => a.required);
    if (positionals.length < required.length)
      throw new AcmDiscoveryError(
        "ACM-D-USAGE",
        `missing required argument <${required[positionals.length]!.name}>`,
      );
    const max = spec.arguments.some((a) => a.variadic === true)
      ? Number.POSITIVE_INFINITY
      : spec.arguments.length;
    if (positionals.length > max)
      throw new AcmDiscoveryError("ACM-D-USAGE", `unexpected argument "${positionals[max]!}"`);
  }
  return { values: values as Record<string, unknown>, positionals };
}

function emitCorpusDiagnostics(diagnostics: CorpusDiagnostic[]): void {
  if (diagnostics.length === 0) return;
  process.stderr.write(renderDiagnostics(diagnostics, false) + "\n");
}

function emitDiscoveryError(error: unknown): never {
  const coded =
    error instanceof AcmDiscoveryError
      ? error
      : new AcmDiscoveryError(
          "ACM-D-UNKNOWN",
          error instanceof Error ? error.message : String(error),
        );
  const envelope = toErrorEnvelope(coded);
  if (rawJson) process.stdout.write(JSON.stringify(envelope) + "\n");
  else process.stderr.write(renderError(envelope));
  process.exit(exitStatusFor(coded.code));
}

function parseLimit(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  const text = String(raw);
  if (!/^[0-9]+$/.test(text) || Number(text) < 1)
    throw new AcmDiscoveryError(
      "ACM-D-USAGE",
      `--limit: expected a positive integer, got "${text}"`,
    );
  return Number(text);
}

type Handler = (invocation: Invocation) => Promise<void>;

const HANDLERS: Record<string, Handler> = {
  async search({ values, positionals }) {
    try {
      const { envelope, diagnostics } = await searchWithDiagnostics(positionals.join(" "), {
        ...(values.project !== undefined ? { project: String(values.project) } : {}),
        ...(values.manifest !== undefined ? { manifests: values.manifest as string[] } : {}),
        ...(values.type !== undefined ? { type: String(values.type) } : {}),
        ...(values.limit !== undefined ? { limit: parseLimit(values.limit) } : {}),
        ...(values.detail !== undefined ? { detail: values.detail as DetailLevel } : {}),
      });
      emitCorpusDiagnostics(diagnostics);
      if (values.json === true) process.stdout.write(JSON.stringify(envelope) + "\n");
      else
        process.stdout.write(
          renderSearch(envelope.data, {
            detail: (values.detail as DetailLevel | undefined) ?? "compact",
            dense: values.dense === true,
          }),
        );
    } catch (error) {
      emitDiscoveryError(error);
    }
  },

  async component({ values, positionals }) {
    try {
      // A dense list is the retrieval floor (name/tag/one-liner per line), so it
      // needs at least compact data — names alone can't be read for fit.
      const listDetail =
        (values.detail as DetailLevel | undefined) ??
        (values.dense === true ? "compact" : undefined);
      const { envelope, diagnostics } = await componentWithDiagnostics(positionals[0], {
        ...(values.project !== undefined ? { project: String(values.project) } : {}),
        ...(values.manifest !== undefined ? { manifests: values.manifest as string[] } : {}),
        ...(values.from !== undefined ? { from: String(values.from) } : {}),
        ...(values.module !== undefined ? { module: String(values.module) } : {}),
        ...(listDetail !== undefined ? { detail: listDetail } : {}),
      });
      emitCorpusDiagnostics(diagnostics);
      if (values.json === true) {
        process.stdout.write(JSON.stringify(envelope) + "\n");
      } else if (envelope.type === "component.list") {
        process.stdout.write(
          renderComponentList(envelope.data, {
            detail: listDetail ?? "brief",
            dense: values.dense === true,
          }),
        );
      } else {
        process.stdout.write(
          renderComponentDetail(envelope.data, {
            detail: (values.detail as DetailLevel | undefined) ?? "full",
            dense: values.dense === true,
          }),
        );
      }
    } catch (error) {
      emitDiscoveryError(error);
    }
  },

  async capabilities({ values }) {
    try {
      const envelope = await capabilitiesApi();
      if (values.json === true) process.stdout.write(JSON.stringify(envelope) + "\n");
      else process.stdout.write(renderCapabilities(envelope.data));
    } catch (error) {
      emitDiscoveryError(error);
    }
  },

  async validate({ values, positionals }) {
    const file = positionals[0];
    const text = readInput(file);
    const asJson = values.json === true;
    const isYaml = /\.ya?ml$/.test(file!);
    if (isYaml) {
      const result = compileYaml(text);
      if (result.ok) return;
      process.stderr.write(renderDiagnostics(result.diagnostics, asJson) + "\n");
      process.exit(result.stage === "profile" ? 2 : 1);
    }
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      fail(2, `${file}: not parseable JSON`);
    }
    const result = validateManifest(doc);
    if (!result.valid) {
      process.stderr.write(renderDiagnostics(result.diagnostics, asJson) + "\n");
      process.exit(1);
    }
  },

  async canonicalize({ values, positionals }) {
    const file = positionals[0];
    const text = readInput(file);
    let parsed: { canonical: boolean; expected: string };
    try {
      parsed = checkCanonical(text);
    } catch {
      fail(1, `${file}: not parseable JSON`);
    }
    if (values.check === true) {
      if (!parsed.canonical)
        fail(3, `ACM-C-DRIFT at /: ${file} is not in canonical form (NS-CANON-5)`);
      return;
    }
    process.stdout.write(parsed.expected);
  },

  async compile({ values, positionals }) {
    const result = compileYaml(readInput(positionals[0]));
    if (!result.ok) {
      process.stderr.write(renderDiagnostics(result.diagnostics, values.json === true) + "\n");
      process.exit(result.stage === "profile" ? 2 : 1);
    }
    process.stdout.write(result.canonical!);
  },

  async "agent-view"({ values, positionals }) {
    const file = positionals[0];
    const text = readInput(file);
    let result: ReturnType<typeof agentViewFromText>;
    try {
      result = agentViewFromText(text);
    } catch {
      fail(1, `${file}: not parseable JSON`);
    }
    if (!result.ok) {
      process.stderr.write(renderDiagnostics(result.diagnostics, values.json === true) + "\n");
      process.exit(3);
    }
    process.stdout.write(result.view!);
  },

  async coverage({ values }) {
    const result = computeCoverage(loadWitnessFixtures());
    process.stdout.write(
      (values.json === true ? JSON.stringify(result, null, 2) : renderMatrix(result)) + "\n",
    );
    if (result.gaps.length > 0) {
      process.stderr.write(
        result.gaps
          .map((g) => `ACM-G-COVERAGE: node "${g.node}" unwitnessed in class "${g.paradigmClass}"`)
          .join("\n") + "\n",
      );
      process.exit(4);
    }
  },

  async drift({ values }) {
    const report = await checkDrift(values.write === true);
    if (values.write === true) {
      process.stdout.write(
        report.stale.length > 0 ? `regenerated: ${report.stale.join(", ")}\n` : "fresh\n",
      );
      return;
    }
    if (report.stale.length > 0)
      fail(3, `stale generated artifacts (run \`pnpm generate\`): ${report.stale.join(", ")}`);
    process.stdout.write("fresh\n");
  },

  async "agent-docs"({ values }) {
    const { files, targets } = buildSkillFiles();
    if (typeof values.target === "string") {
      const relPath = targets[values.target];
      if (relPath === undefined)
        fail(2, `unknown target: ${values.target} (supported: ${Object.keys(targets).join(", ")})`);
      const file = files.find(([p]) => p === relPath)!;
      process.stdout.write(file[1]);
      return;
    }
    const stale: string[] = [];
    for (const [relPath, content] of files) {
      const absolute = path.join(REPO_ROOT, relPath);
      const current = existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
      if (current !== content) {
        stale.push(relPath);
        if (values.write === true) {
          mkdirSync(path.dirname(absolute), { recursive: true });
          writeFileSync(absolute, content);
        }
      }
    }
    if (values.write === true) {
      process.stdout.write(stale.length > 0 ? `regenerated: ${stale.join(", ")}\n` : "fresh\n");
      return;
    }
    if (stale.length > 0)
      fail(3, `stale agent-docs artifacts (run \`pnpm generate\`): ${stale.join(", ")}`);
    process.stdout.write("fresh\n");
  },

  async init({ values }) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // The build bundles the generated skill under the package's `skill/` dir. In-repo,
    // before a build has run, fall back to the discovery-skill generated source so
    // `pnpm acm init` works without building first.
    const bundled = path.resolve(here, "../skill/acm-discovery");
    const source = existsSync(bundled)
      ? bundled
      : path.join(
          REPO_ROOT,
          "packages/discovery-skill/generated/targets/claude-skill/acm-discovery",
        );
    if (!existsSync(source)) fail(1, "bundled Discovery Skill not found; reinstall @xgentic/acm");
    const dest = path.join(process.cwd(), ".claude", "skills", "acm-discovery");
    const rel = path.relative(process.cwd(), dest);
    if (existsSync(dest) && values.force !== true) {
      fail(1, `${rel} already exists; pass --force to overwrite`);
    }
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(source, dest, { recursive: true });
    process.stdout.write(`installed Discovery Skill → ${rel}/\n`);
  },
};

async function main(): Promise<void> {
  const spec = findCommand(commandName);
  if (!spec) {
    const message = `unknown command: ${commandName ?? "(none)"}`;
    if (rawJson) {
      process.stdout.write(
        JSON.stringify(toErrorEnvelope(new AcmDiscoveryError("ACM-D-USAGE", message))) + "\n",
      );
      process.exit(2);
    }
    fail(2, message);
  }

  let invocation: Invocation;
  try {
    invocation = parseInvocation(spec, argv.slice(1));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (spec.jsonSupported && rawJson) {
      process.stdout.write(
        JSON.stringify(toErrorEnvelope(new AcmDiscoveryError("ACM-D-USAGE", message))) + "\n",
      );
      process.exit(2);
    }
    fail(2, message);
  }

  const handler = HANDLERS[spec.name];
  if (!handler) fail(2, `unknown command: ${spec.name}`);
  await handler(invocation);
}

await main();
