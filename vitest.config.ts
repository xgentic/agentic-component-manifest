import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Published packages resolve `@xgentic/acm` to built `dist/` (the `default` export
// condition); in-repo tests must resolve it to TypeScript source instead. The anchored
// alias matches the bare specifier exactly, leaving `@xgentic/acm-spec` and
// `@xgentic/acm-analyzer` to resolve normally.
const toolchainSrc = fileURLToPath(new URL("./packages/toolchain/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@xgentic\/acm$/, replacement: toolchainSrc }],
  },
  test: {
    include: ["packages/*/tests/**/*.test.ts"],
    watch: false,
  },
});
