#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { renderDiagnostics } from "./diagnostics.js";
import { validateManifest } from "./validate.js";
import { checkCanonical } from "./canonicalize.js";
import { compileYaml } from "./compile.js";
import { agentViewFromText } from "./agent-view.js";
import { computeCoverage, loadWitnessFixtures, renderMatrix } from "./coverage.js";
import { checkDrift } from "./drift.js";

const argv = process.argv.slice(2);
const command = argv[0];
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const files = argv.slice(1).filter((a) => !a.startsWith("--"));
const asJson = flags.has("--json");

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

async function main(): Promise<void> {
  switch (command) {
    case "validate": {
      const text = readInput(files[0]);
      const isYaml = /\.ya?ml$/.test(files[0]!);
      if (isYaml) {
        const result = compileYaml(text);
        if (result.ok) break;
        process.stderr.write(renderDiagnostics(result.diagnostics, asJson) + "\n");
        process.exit(result.stage === "profile" ? 2 : 1);
      }
      let doc: unknown;
      try {
        doc = JSON.parse(text);
      } catch {
        fail(2, `${files[0]}: not parseable JSON`);
      }
      const result = validateManifest(doc);
      if (!result.valid) {
        process.stderr.write(renderDiagnostics(result.diagnostics, asJson) + "\n");
        process.exit(1);
      }
      break;
    }
    case "canonicalize": {
      const text = readInput(files[0]);
      let parsed: { canonical: boolean; expected: string };
      try {
        parsed = checkCanonical(text);
      } catch {
        fail(1, `${files[0]}: not parseable JSON`);
      }
      if (flags.has("--check")) {
        if (!parsed.canonical)
          fail(3, `ACM-C-DRIFT at /: ${files[0]} is not in canonical form (NS-CANON-5)`);
        break;
      }
      process.stdout.write(parsed.expected);
      break;
    }
    case "compile": {
      const result = compileYaml(readInput(files[0]));
      if (!result.ok) {
        process.stderr.write(renderDiagnostics(result.diagnostics, asJson) + "\n");
        process.exit(result.stage === "profile" ? 2 : 1);
      }
      process.stdout.write(result.canonical!);
      break;
    }
    case "agent-view": {
      const text = readInput(files[0]);
      let result: ReturnType<typeof agentViewFromText>;
      try {
        result = agentViewFromText(text);
      } catch {
        fail(1, `${files[0]}: not parseable JSON`);
      }
      if (!result.ok) {
        process.stderr.write(renderDiagnostics(result.diagnostics, asJson) + "\n");
        process.exit(3);
      }
      process.stdout.write(result.view!);
      break;
    }
    case "coverage": {
      const result = computeCoverage(loadWitnessFixtures());
      process.stdout.write(
        (asJson ? JSON.stringify(result, null, 2) : renderMatrix(result)) + "\n",
      );
      if (result.gaps.length > 0) {
        process.stderr.write(
          result.gaps
            .map((g) => `ACM-G-COVERAGE: node "${g.node}" unwitnessed in class "${g.paradigmClass}"`)
            .join("\n") + "\n",
        );
        process.exit(4);
      }
      break;
    }
    case "drift": {
      const report = await checkDrift(flags.has("--write"));
      if (flags.has("--write")) {
        process.stdout.write(
          report.stale.length > 0 ? `regenerated: ${report.stale.join(", ")}\n` : "fresh\n",
        );
        break;
      }
      if (report.stale.length > 0)
        fail(3, `stale generated artifacts (run \`pnpm generate\`): ${report.stale.join(", ")}`);
      process.stdout.write("fresh\n");
      break;
    }
    default:
      fail(2, `unknown command: ${command ?? "(none)"}`);
  }
}

await main();
