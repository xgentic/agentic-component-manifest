import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAcm } from "./helpers.js";

/**
 * `acm init` installs the bundled Discovery Skill into a consumer project's
 * `.claude/skills/` (spec 005 steering layer, packaged with the CLI). The skill file is
 * the generated Claude-skill target; the command is idempotent and gated by `--force`.
 */
describe("acm init — install the bundled Discovery Skill", () => {
  let project: string;
  const skillFile = () => path.join(project, ".claude", "skills", "acm-discovery", "SKILL.md");

  beforeEach(() => {
    project = mkdtempSync(path.join(tmpdir(), "acm-init-"));
  });
  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it("installs SKILL.md under .claude/skills/acm-discovery/ and exits 0", () => {
    const r = runAcm(["init"], { cwd: project });
    expect(r.exitCode).toBe(0);
    expect(existsSync(skillFile())).toBe(true);
    // The installed file is the skill's activation contract, not empty boilerplate.
    expect(readFileSync(skillFile(), "utf8")).toMatch(/acm/i);
  });

  it("refuses to overwrite an existing install without --force (exit 1)", () => {
    expect(runAcm(["init"], { cwd: project }).exitCode).toBe(0);
    const r = runAcm(["init"], { cwd: project });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/already exists/);
  });

  it("overwrites an existing install with --force (exit 0)", () => {
    expect(runAcm(["init"], { cwd: project }).exitCode).toBe(0);
    const r = runAcm(["init", "--force"], { cwd: project });
    expect(r.exitCode).toBe(0);
    expect(existsSync(skillFile())).toBe(true);
  });
});
