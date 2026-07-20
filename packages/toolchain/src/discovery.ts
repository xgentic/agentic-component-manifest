import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** NS-DISC-1..4: acm field → ./agentic-component-manifest.json → /.well-known/agentic-component-manifest.json; first hit wins. */
export function resolveManifestPath(packageDir: string): { path?: string; error?: string } {
  const packageJsonPath = path.join(packageDir, "package.json");
  if (existsSync(packageJsonPath)) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (typeof pkg.acm === "string") {
      const advertised = path.join(packageDir, pkg.acm);
      return existsSync(advertised)
        ? { path: advertised }
        : { error: `manifest advertised at "${pkg.acm}" does not exist (NS-DISC-4)` };
    }
  }
  const conventional = path.join(packageDir, "agentic-component-manifest.json");
  if (existsSync(conventional)) return { path: conventional };
  const wellKnown = path.join(packageDir, ".well-known", "agentic-component-manifest.json");
  if (existsSync(wellKnown)) return { path: wellKnown };
  return { error: "no ACM manifest found (NS-DISC-4)" };
}
