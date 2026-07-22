import { defineConfig } from "tsup";

// `plugin` is the public library entry (the plugin author surface); `cli` is the
// `acm-analyzer` binary. @xgentic/acm, @xgentic/acm-spec, typescript, and the framework
// deps stay external and resolve at runtime from node_modules.
export default defineConfig({
  entry: { plugin: "src/plugin.ts", cli: "src/cli.ts" },
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  shims: false,
});
