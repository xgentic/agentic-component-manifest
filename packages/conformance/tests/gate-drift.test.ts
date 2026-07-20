import { describe, expect, it } from "vitest";
import { checkDrift } from "../../toolchain/src/drift.js";

/**
 * gate-drift: the checked-in generated artifacts (`packages/spec/generated/types.ts`
 * and `reference.md`) are byte-fresh against the schema (Principle VI, SC-002). This is
 * the same check `pnpm drift` runs on the CLI, wired into `pnpm test` so a local run of
 * the suite catches schema/artifact drift without a separate command. Regenerate with
 * `pnpm generate` when this fails.
 */
describe("gate-drift: generated artifacts are fresh (constitution VI)", () => {
  it("types.ts and reference.md match the schema (no `pnpm generate` pending)", async () => {
    const { stale } = await checkDrift(false);
    expect(stale).toEqual([]);
  });
});
