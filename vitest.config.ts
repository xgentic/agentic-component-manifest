import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/tests/**/*.test.ts"],
    watch: false,
    /**
     * The conformance gates drive the real `acm` CLI as a subprocess (helpers.ts
     * `runAcm`), so a single test can pay a dozen tsx cold starts. That start-up
     * costs ~0.1s on an idle machine but ~0.5s when several spawn-heavy files run
     * in parallel — enough for the 8-spawn determinism gate to exceed vitest's 5s
     * default on a loaded box or CI runner. Performance budgets are asserted
     * explicitly in the tests that own them (SC-002), never via this timeout.
     */
    testTimeout: 30_000,
  },
});
