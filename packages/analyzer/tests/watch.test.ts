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

    const source = path.join(dir, "src", "widget.ts");
    const cycles: AnalyzeOutcome[] = [];
    const onCycle = (outcome: AnalyzeOutcome): void => void cycles.push(outcome);
    const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

    /**
     * Write `text` to the watched source, then return the cycle the watcher runs for it.
     *
     * Filesystem notification is best-effort: under the IO and CPU contention of a shared
     * CI runner an inotify/FSEvents event can be coalesced away or arrive seconds late, so
     * the write is re-applied every `nudgeMs` until a cycle lands rather than betting the
     * test on one event surviving. Re-writing identical bytes is idempotent for the
     * analyzer: every cycle reads the file fresh, so a late or duplicated event can only
     * ever re-derive the manifest from the newest content, never resurrect older output.
     *
     * The watcher is then left to quiesce for `quietMs`, because one write can produce
     * more than one cycle (truncate + write, or a nudge racing a delivered event) and a
     * cycle still in flight when the next step writes would otherwise be mistaken for
     * that step's own cycle. The last cycle observed is the one returned.
     */
    const writeAndSettle = async (
      text: string,
      { nudgeMs = 1_000, quietMs = 250, deadlineMs = 20_000 } = {},
    ): Promise<AnalyzeOutcome> => {
      const before = cycles.length;
      const deadline = Date.now() + deadlineMs;
      do {
        writeFileSync(source, text, "utf8");
        const nudgeAt = Date.now() + nudgeMs;
        while (cycles.length === before && Date.now() < nudgeAt) await sleep(25);
      } while (cycles.length === before && Date.now() < deadline);
      if (cycles.length === before) throw new Error(`watcher never re-analyzed ${source}`);
      for (let seen = -1; seen !== cycles.length && Date.now() < deadline;) {
        seen = cycles.length;
        await sleep(quietMs);
      }
      return cycles.at(-1)!;
    };

    const settings = defaultSettings();
    const controller = await runWatch(settings, dir, { write: true, onCycle });
    controllers.push(controller);
    await controller.ready;

    // 1) Initial cycle: manifest written, valid (exit 0), and it has the `open` input.
    //    `runWatch` awaits it before returning, so it is already on the books here.
    const initial = cycles[0]!;
    expect(cycles).toHaveLength(1);
    expect(initial.exitCode).toBe(0);
    expect(initial.wrote).toBe(true);
    expect(existsSync(outFile)).toBe(true);
    expect(readFileSync(outFile, "utf8")).toContain('"open"');
    const afterInitial = readFileSync(outFile, "utf8");

    // 2) Change the source: add a second input; the manifest regenerates.
    const changed = await writeAndSettle(
      widget(false).replace("open = false;", "open = false;\n  /** Its size. */\n  size = 1;"),
    );
    expect(changed.wrote).toBe(true);
    expect(changed.exitCode).toBe(0);
    const afterChange = readFileSync(outFile, "utf8");
    expect(afterChange).not.toBe(afterInitial);
    expect(afterChange).toContain('"size"');

    // 3) Introduce a parse error: reported (exit 1), no write, watcher stays alive,
    //    and the last good manifest on disk is untouched (never a partial write).
    const broken = await writeAndSettle(widget(true));
    expect(broken.wrote).toBe(false);
    expect(broken.exitCode).toBe(1);
    expect(broken.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(readFileSync(outFile, "utf8")).toBe(afterChange); // last good output preserved

    // 4) Fix the source again: the still-alive watcher recovers and regenerates.
    const recovered = await writeAndSettle(widget(false));
    expect(recovered.exitCode).toBe(0);
    expect(recovered.wrote).toBe(true);
    expect(readFileSync(outFile, "utf8")).toContain('"open"');

    await controller.close();
    // Three `writeAndSettle` steps, each allowed its own 20s deadline for a slow runner.
  }, 75_000);
});
