import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "apm_modules/",
      "packages/conformance/fixtures/",
      "packages/spec/generated/",
      // Build output: bundled third-party code, not ours to lint.
      "dist/",
      "*.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/*/src/**/*.ts", "packages/*/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Build and verification scripts: plain Node ESM, not part of the TS program.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
);
