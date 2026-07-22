import { cpSync, rmSync } from "node:fs";
import { defineConfig } from "tsup";

// Two entries: the library surface (`index`) that @xgentic/acm-analyzer imports, and the
// `acm` CLI (its `#!/usr/bin/env node` shebang is preserved and the file is marked
// executable). Declared dependencies (ajv, yaml, json-schema-to-typescript,
// @xgentic/acm-spec) are left external and resolved at runtime from node_modules.
//
// onSuccess bundles the generated Claude-skill target into `skill/` so it ships in the
// published tarball (package.json `files`) and `acm init` can copy it into a consumer's
// `.claude/skills/`. The copy is generated, never committed (see .gitignore).
export default defineConfig({
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  shims: false,
  onSuccess: async () => {
    const src = "../discovery-skill/generated/targets/claude-skill/acm-discovery";
    const dest = "skill/acm-discovery";
    rmSync("skill", { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
  },
});
