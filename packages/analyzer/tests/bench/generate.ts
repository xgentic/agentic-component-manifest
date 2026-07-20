/**
 * Deterministic bench-corpus generator for the SC-007 performance spot-check.
 *
 * Materializes N distinct vanilla web components so the analyzer does real discovery +
 * parse + collect work at scale, without checking a hundred near-identical source files
 * into the tree. Used by `perf.test.ts` (into an OS temp dir) and runnable directly for
 * the quickstart perf spot-check:
 *
 *   tsx packages/analyzer/tests/bench/generate.ts <dir> [count]   # defaults: ./ , 100
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** One deterministic vanilla web component, unique per index (tag, class, members). */
export function componentSource(i: number): string {
  const n = String(i).padStart(3, "0");
  const cls = `Acme${n}`;
  const tag = `acme-c${n}`;
  return (
    [
      `/** Bench component ${n}. */`,
      `export class ${cls} extends HTMLElement {`,
      `  /** A text label. */`,
      `  label = "";`,
      `  /** Whether the control is disabled. */`,
      `  disabled = false;`,
      `  /** Visual size of the control. */`,
      `  size: "small" | "medium" | "large" = "medium";`,
      `  static get observedAttributes(): string[] {`,
      `    return ["label", "disabled"];`,
      `  }`,
      `  /** Run the control's primary action. */`,
      `  run(times: number): number {`,
      `    return times;`,
      `  }`,
      `}`,
      `customElements.define("${tag}", ${cls});`,
    ].join("\n") + "\n"
  );
}

/** Materialize `count` bench components into `<dir>/src`. Returns the project dir. */
export function generateBench(dir: string, count: number): string {
  const src = path.join(dir, "src");
  mkdirSync(src, { recursive: true });
  writeFileSync(path.join(dir, "package.json"), `{ "name": "@acme/bench", "version": "0.0.0" }\n`);
  for (let i = 0; i < count; i++) {
    writeFileSync(path.join(src, `c${String(i).padStart(3, "0")}.ts`), componentSource(i), "utf8");
  }
  return dir;
}

// Runnable directly: `tsx generate.ts <dir> [count]`.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  const dir = process.argv[2] ?? ".";
  const count = Number(process.argv[3] ?? "100");
  const out = generateBench(dir, count);
  process.stderr.write(`bench: wrote ${count} components to ${path.join(out, "src")}\n`);
}
