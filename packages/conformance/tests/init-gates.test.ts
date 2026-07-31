import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { REGISTRY } from "../../toolchain/src/registry.js";
import {
  INIT_DESTINATIONS,
  INIT_TARGETS,
  REGION_END,
  REGION_START,
  applyRegion,
  detectTargets,
  type InitTarget,
} from "../../toolchain/src/init.js";
import { buildCapabilityManifest } from "../../toolchain/src/capability.js";
import { FIXTURES, runAcm } from "./helpers.js";

/**
 * Gates over `acm init` (spec 006, contracts/init-cli.md):
 *  G-I1 — the registry's `--target` enum is exactly the installable target set
 *  G-I2 — installed bytes equal the `agent-docs` target's bytes (no second renderer)
 *  G-I3 — idempotent: fresh · blocked · --force, and a refusal never writes
 *  G-I4 — the `agents-md` managed region replaces itself and never touches its neighbours
 *  G-I5 — host detection is deterministic and total
 *  G-I6 — the preflight carries counts, identifiers, and rule ids — never Manifest prose
 *  G-I7 — `init` stays out of the discovery subset, so the Skill body is unaffected
 */

const scratch: string[] = [];
function tempProject(seed?: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "acm-init-"));
  scratch.push(dir);
  if (seed !== undefined) cpSync(path.join(FIXTURES, seed), dir, { recursive: true });
  return dir;
}
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const spec = REGISTRY.find((c) => c.name === "init")!;
const read = (project: string, target: InitTarget): string =>
  readFileSync(path.join(project, INIT_DESTINATIONS[target]), "utf8");

describe("G-I1 — the declared targets are the installable targets", () => {
  it("the registry enum equals INIT_TARGETS", () => {
    const option = spec.options.find((o) => o.flag.startsWith("--target"))!;
    expect(option.choices).toEqual([...INIT_TARGETS]);
  });

  it("every target has a project-relative destination", () => {
    for (const target of INIT_TARGETS) {
      expect(INIT_DESTINATIONS[target]).toBeTruthy();
      expect(path.isAbsolute(INIT_DESTINATIONS[target])).toBe(false);
    }
  });

  it("an unknown target is a usage error, not a silent skip", () => {
    const result = runAcm(["init", "--dir", tempProject(), "--target", "vscode"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("unknown target: vscode");
  });
});

describe("G-I2 — installed bytes are the agent-docs bytes (FR-006 fidelity)", () => {
  // `init` must not own a second rendering path: if it did, the block-fidelity gate
  // over the generated targets would stop describing what agents actually read.
  for (const target of INIT_TARGETS) {
    it(`${target} installs its target verbatim`, () => {
      const project = tempProject();
      expect(runAcm(["init", "--dir", project, "--target", target]).exitCode).toBe(0);
      const expected = runAcm(["agent-docs", "--target", target]).stdout;
      const installed = read(project, target);
      // `agents-md` wraps the fragment in its managed region; the fragment is verbatim.
      const body =
        target === "agents-md"
          ? installed.slice(
              installed.indexOf(REGION_START) + REGION_START.length,
              installed.indexOf(REGION_END),
            )
          : installed;
      expect(body.trim()).toBe(expected.trim());
    });
  }

  it("no corpus content reaches the installed skill (corpus-agnostic generation)", () => {
    // The hostile fixture's injection prose is in the corpus this init runs against;
    // none of it may appear in the file the agent will read as resident context.
    const project = tempProject("discovery-corpus");
    expect(runAcm(["init", "--dir", project, "--target", "claude-skill"]).exitCode).toBe(0);
    const installed = read(project, "claude-skill");
    const hostile = readFileSync(
      path.join(
        FIXTURES,
        "discovery-corpus/node_modules/hostile-pkg/agentic-component-manifest.json",
      ),
      "utf8",
    );
    const names: string[] = JSON.parse(hostile).modules.flatMap((m: any) =>
      m.declarations.map((d: any) => d.name),
    );
    for (const name of names) expect(installed).not.toContain(name);
  });
});

describe("G-I3 — idempotency and the overwrite refusal", () => {
  it("a second run is fresh and byte-identical", () => {
    const project = tempProject();
    runAcm(["init", "--dir", project, "--target", "claude-skill"]);
    const first = read(project, "claude-skill");
    const second = runAcm(["init", "--dir", project, "--target", "claude-skill"]);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("fresh");
    expect(read(project, "claude-skill")).toBe(first);
  });

  it("a modified file is refused with exit 3, and the refusal writes nothing", () => {
    const project = tempProject();
    runAcm(["init", "--dir", project, "--target", "claude-skill"]);
    const destination = path.join(project, INIT_DESTINATIONS["claude-skill"]);
    writeFileSync(destination, "hand-written\n");
    const blocked = runAcm(["init", "--dir", project, "--target", "claude-skill"]);
    expect(blocked.exitCode).toBe(3);
    expect(blocked.stdout).toContain("blocked");
    expect(readFileSync(destination, "utf8")).toBe("hand-written\n");
  });

  it("--force overwrites and returns to success", () => {
    const project = tempProject();
    runAcm(["init", "--dir", project, "--target", "claude-skill"]);
    const pristine = read(project, "claude-skill");
    writeFileSync(path.join(project, INIT_DESTINATIONS["claude-skill"]), "hand-written\n");
    const forced = runAcm(["init", "--dir", project, "--target", "claude-skill", "--force"]);
    expect(forced.exitCode).toBe(0);
    expect(forced.stdout).toContain("updated");
    expect(read(project, "claude-skill")).toBe(pristine);
  });

  it("--dry-run writes nothing", () => {
    const project = tempProject();
    const result = runAcm(["init", "--dir", project, "--target", "claude-skill", "--dry-run"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("dry run");
    expect(existsSync(path.join(project, INIT_DESTINATIONS["claude-skill"]))).toBe(false);
  });
});

describe("G-I4 — the AGENTS.md managed region", () => {
  const surrounding = "# My project\n\nExisting guidance.\n";

  it("appends once and preserves the surrounding content byte-for-byte", () => {
    const project = tempProject();
    const agentsMd = path.join(project, "AGENTS.md");
    writeFileSync(agentsMd, surrounding);
    runAcm(["init", "--dir", project, "--target", "agents-md"]);
    const written = readFileSync(agentsMd, "utf8");
    expect(written.startsWith(surrounding)).toBe(true);
    expect(written.split(REGION_START).length - 1).toBe(1);
    expect(written.split(REGION_END).length - 1).toBe(1);
  });

  it("replaces the region in place rather than appending a second one", () => {
    const stale = `${surrounding}\n${REGION_START}\nold content\n${REGION_END}\n\n## Tail\n`;
    const updated = applyRegion(stale, "new content");
    expect(updated.split(REGION_START).length - 1).toBe(1);
    expect(updated).toContain("new content");
    expect(updated).not.toContain("old content");
    expect(updated.startsWith(surrounding)).toBe(true);
    expect(updated.endsWith("## Tail\n")).toBe(true);
  });

  it("creates the file when the project has no AGENTS.md", () => {
    expect(applyRegion(null, "body")).toBe(`${REGION_START}\nbody\n${REGION_END}\n`);
  });
});

describe("G-I5 — host detection is deterministic and total", () => {
  it("detects each host, and every combination in a fixed order", () => {
    const project = tempProject();
    expect(detectTargets(project)).toEqual(["claude-skill"]); // no host → the default
    writeFileSync(path.join(project, "AGENTS.md"), "# p\n");
    expect(detectTargets(project)).toEqual(["agents-md"]);
    cpSync(path.join(project, "AGENTS.md"), path.join(project, ".cursor/rules/keep.md"), {
      recursive: true,
    });
    expect(detectTargets(project)).toEqual(["agents-md", "rules"]);
  });

  it("installs into every detected host in one run", () => {
    const project = tempProject();
    writeFileSync(path.join(project, "AGENTS.md"), "# p\n");
    cpSync(path.join(project, "AGENTS.md"), path.join(project, ".claude/settings.json"), {
      recursive: true,
    });
    const result = runAcm(["init", "--dir", project]);
    expect(result.exitCode).toBe(0);
    expect(existsSync(path.join(project, INIT_DESTINATIONS["claude-skill"]))).toBe(true);
    expect(readFileSync(path.join(project, "AGENTS.md"), "utf8")).toContain(REGION_START);
  });
});

describe("G-I6 — the preflight is inert (NS-DATA-1)", () => {
  const project = tempProject("discovery-corpus");
  const report = runAcm(["init", "--dir", project, "--target", "claude-skill"]);
  const machine = runAcm(["init", "--dir", project, "--target", "claude-skill", "--json"]);

  it("reports the corpus it found, with per-source component counts", () => {
    expect(report.exitCode).toBe(0);
    const data = JSON.parse(machine.stdout);
    expect(data.preflight.manifests).toBeGreaterThan(0);
    expect(data.preflight.components).toBeGreaterThan(0);
    expect(data.preflight.sources.map((s: any) => s.name)).toContain("@acme/lit-buttons");
  });

  it("names excluded Manifests by rule id and path, never by their content", () => {
    const data = JSON.parse(machine.stdout);
    expect(data.preflight.diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of data.preflight.diagnostics) {
      expect(Object.keys(diagnostic).sort()).toEqual(["path", "ruleId"]);
      expect(diagnostic.ruleId).toMatch(/^ACM-/);
    }
  });

  it("carries no Manifest prose — the report is counts and identifiers only", () => {
    const hostile = JSON.parse(
      readFileSync(
        path.join(
          FIXTURES,
          "discovery-corpus/node_modules/hostile-pkg/agentic-component-manifest.json",
        ),
        "utf8",
      ),
    );
    const prose: string[] = hostile.modules.flatMap((m: any) =>
      m.declarations.flatMap((d: any) => [d.description, d.semantics?.notes].filter(Boolean)),
    );
    expect(prose.length).toBeGreaterThan(0);
    for (const text of prose) {
      expect(report.stdout).not.toContain(text);
      expect(machine.stdout).not.toContain(text);
    }
  });

  it("human output contains no raw C0/C1 control byte", () => {
    // eslint-disable-next-line no-control-regex
    expect(report.stdout).not.toMatch(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/);
  });

  it("reports an empty corpus as a workable state, not a failure", () => {
    const empty = runAcm(["init", "--dir", tempProject(), "--target", "claude-skill"]);
    expect(empty.exitCode).toBe(0);
    expect(empty.stdout).toContain("no ACM Manifests found");
    expect(empty.stdout).toContain("acm-analyzer analyze");
  });
});

describe("G-I7 — init stays out of the agent-facing discovery subset", () => {
  it("is described but not envelope-emitting, so the Skill body is unaffected", () => {
    const cap = buildCapabilityManifest();
    expect(cap.commands.map((c) => c.name)).toContain("init");
    expect(cap.jsonSupported).not.toContain("init");
    expect(spec.responseTypes).toEqual([]);
  });
});
