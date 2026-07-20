/**
 * US3 watch-mode integration (T039, optional layer).
 *
 * Proves the watch cycle: an initial run writes the manifest, a source change
 * regenerates it (SC-007), a change that introduces a parse error is reported without
 * killing the watcher and leaves the last good manifest intact (never a partial write),
 * and a subsequent fix recovers — all through the real `chokidar` watcher.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runWatch, type WatchController } from "../src/watch.js";
import { defaultSettings } from "../src/types.js";
import type { AnalyzeOutcome } from "../src/run.js";

const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "acm-watch-"));
const controllers: WatchController[] = [];
afterAll(async () => {
  await Promise.all(controllers.map((c) => c.close()));
  rmSync(tmpRoot, { recursive: true, force: true });
});

/** A valid vanilla web component with a single `open` input, or a syntactically broken one. */
function widget(broken: boolean): string {
  if (broken) return `export class Widget extends HTMLElement { this is not valid ??? {{{ }`;
  return [
    `/** A widget. */`,
    `export class Widget extends HTMLElement {`,
    `  /** Whether it is open. */`,
    `  open = false;`,
    `}`,
    `customElements.define("x-widget", Widget);`,
  ].join("\n");
}

function project(): string {
  const dir = path.join(tmpRoot, `proj-${controllers.length}`);
  mkdirSync(path.join(dir, "src"), { recursive: true });
  writeFileSync(path.join(dir, "package.json"), `{ "name": "@acme/watched", "version": "0.0.0" }`);
  writeFileSync(path.join(dir, "src", "widget.ts"), widget(false), "utf8");
  return dir;
}

describe("watch mode: regenerate on change, survive a parse error, keep watching", () => {
  it("runs initially, regenerates on change, survives a parse error, and recovers", async () => {
    const dir = project();
    const outFile = path.join(dir, "agentic-component-manifest.json");

    const cycles: AnalyzeOutcome[] = [];
    let waiters: Array<{ n: number; resolve: () => void; timer: ReturnType<typeof setTimeout> }> =
      [];
    const onCycle = (outcome: AnalyzeOutcome): void => {
      cycles.push(outcome);
      for (const w of [...waiters]) {
        if (cycles.length >= w.n) {
          clearTimeout(w.timer);
          w.resolve();
          waiters = waiters.filter((x) => x !== w);
        }
      }
    };
    /** Resolve once at least `n` cycles have completed. */
    const untilCycle = (n: number, ms = 10_000): Promise<void> =>
      cycles.length >= n
        ? Promise.resolve()
        : new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`timed out waiting for cycle #${n} (have ${cycles.length})`)),
              ms,
            );
            waiters.push({ n, resolve, timer });
          });

    const settings = defaultSettings();
    const controller = await runWatch(settings, dir, { write: true, onCycle });
    controllers.push(controller);
    await controller.ready;

    // 1) Initial cycle: manifest written, valid (exit 0), and it has the `open` input.
    await untilCycle(1);
    const initial = cycles[0]!;
    expect(initial.exitCode).toBe(0);
    expect(initial.wrote).toBe(true);
    expect(existsSync(outFile)).toBe(true);
    expect(readFileSync(outFile, "utf8")).toContain('"open"');
    const afterInitial = readFileSync(outFile, "utf8");

    // 2) Change the source: add a second input; the manifest regenerates.
    writeFileSync(
      path.join(dir, "src", "widget.ts"),
      widget(false).replace("open = false;", "open = false;\n  /** Its size. */\n  size = 1;"),
      "utf8",
    );
    await untilCycle(2);
    const changed = cycles[1]!;
    expect(changed.wrote).toBe(true);
    expect(changed.exitCode).toBe(0);
    const afterChange = readFileSync(outFile, "utf8");
    expect(afterChange).not.toBe(afterInitial);
    expect(afterChange).toContain('"size"');

    // 3) Introduce a parse error: reported (exit 1), no write, watcher stays alive,
    //    and the last good manifest on disk is untouched (never a partial write).
    writeFileSync(path.join(dir, "src", "widget.ts"), widget(true), "utf8");
    await untilCycle(3);
    const broken = cycles[2]!;
    expect(broken.wrote).toBe(false);
    expect(broken.exitCode).toBe(1);
    expect(broken.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(readFileSync(outFile, "utf8")).toBe(afterChange); // last good output preserved

    // 4) Fix the source again: the still-alive watcher recovers and regenerates.
    writeFileSync(path.join(dir, "src", "widget.ts"), widget(false), "utf8");
    await untilCycle(4);
    const recovered = cycles[3]!;
    expect(recovered.exitCode).toBe(0);
    expect(recovered.wrote).toBe(true);
    expect(readFileSync(outFile, "utf8")).toContain('"open"');

    await controller.close();
  }, 30_000);
});
