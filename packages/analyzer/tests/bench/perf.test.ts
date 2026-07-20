/**
 * Performance spot-check (T048, SC-007).
 *
 * Not a micro-benchmark — a generous ceiling that fails only on a real regression:
 *  - a full analysis of 100 components completes in < 30 s, and
 *  - a single-file change in watch mode is reflected in < 5 s.
 *
 * The corpus is generated deterministically into an OS temp dir (see `generate.ts`), so
 * nothing is checked in and the timings measure discover → parse → collect → emit at
 * scale. Real numbers are orders of magnitude under these ceilings; the margin absorbs
 * slow CI hardware without turning perf into a flaky gate.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { analyzeProject, type AnalyzeOutcome } from "../../src/run.js";
import { runWatch, type WatchController } from "../../src/watch.js";
import { defaultSettings } from "../../src/types.js";
import { componentSource, generateBench } from "./generate.js";

const COMPONENTS = 100;
const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "acm-bench-"));
const controllers: WatchController[] = [];

afterAll(async () => {
  await Promise.all(controllers.map((c) => c.close()));
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("perf spot-check: analysis scales within SC-007 ceilings", () => {
  it(`analyzes ${COMPONENTS} components in < 30 s`, async () => {
    const dir = generateBench(path.join(tmpRoot, "full"), COMPONENTS);
    const settings = defaultSettings();

    const t0 = performance.now();
    const outcome = await analyzeProject(settings, dir, { write: false });
    const ms = performance.now() - t0;

    expect(outcome.exitCode).toBe(0);
    expect(outcome.text).not.toBeNull();
    // One module → one declaration per generated component.
    expect(JSON.parse(outcome.text!).modules.length).toBe(COMPONENTS);
    expect(ms).toBeLessThan(30_000);
  }, 60_000);

  it("reflects a single-file change in < 5 s (watch, SC-007)", async () => {
    const dir = generateBench(path.join(tmpRoot, "watch"), COMPONENTS);
    const target = path.join(dir, "src", "c000.ts");

    // Robust cycle waiter (mirrors watch.test.ts): resolve once >= n cycles have fired.
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
    await untilCycle(1); // initial full analysis

    // Change one file and measure time until the regeneration cycle completes.
    const t0 = performance.now();
    writeFileSync(target, componentSource(0).replace('label = "";', 'label = "changed";'), "utf8");
    await untilCycle(2);
    const ms = performance.now() - t0;

    expect(cycles[1]!.exitCode).toBe(0);
    expect(cycles[1]!.wrote).toBe(true);
    expect(ms).toBeLessThan(5_000);

    await controller.close();
  }, 30_000);
});
