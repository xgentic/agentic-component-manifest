import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../../toolchain/src/validate.js";
import { buildCapabilityManifest } from "../../toolchain/src/capability.js";
import { REGISTRY } from "../../toolchain/src/registry.js";
import {
  AUTHORED_BLOCK_IDS,
  BODY_BLOCK_ORDER,
  buildSkillFiles,
  checkBlockInventory,
  extractBlocks,
  readAuthoredBlocks,
  renderGeneratedBlocks,
  sweepAuthoredReferences,
} from "../../toolchain/src/agent-docs.js";

/**
 * Spec 005 gates over the Discovery Skill (architecture doc §7):
 *  G2 — authored blocks name only real surface elements (FR-005 / SC-003)
 *  G3 — packagings carry byte-identical shared blocks (FR-006 / SC-004)
 *  G5 — token budgets under the repo gauge ceil(bytes/4) (FR-008 / SC-002)
 *  G6 — every error code has a prescribed playbook branch (SC-006)
 * G1 (freshness) is `pnpm drift` via gate-drift; G4 (the documented loop incl.
 * hostile fixtures) is discovery-gates.test.ts — this file adds the FR-004
 * instruction-presence half.
 */

const cap = buildCapabilityManifest();
const skill = buildSkillFiles(cap);
const authored = readAuthoredBlocks();
const generated = renderGeneratedBlocks(cap);

function fileContent(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

const gauge = (text: string): number => Math.ceil(Buffer.byteLength(text, "utf8") / 4);

describe("G2 — authored blocks reference only the real surface (FR-005, SC-003)", () => {
  it("the sweep over all authored blocks finds no fabricated references", () => {
    expect(sweepAuthoredReferences(authored, cap)).toEqual([]);
  });

  it("the blocks directory holds exactly the declared authored blocks", () => {
    expect(checkBlockInventory()).toEqual([]);
  });

  it("example invocations in the skill parse per the capability manifest", () => {
    // Every `acm <command>` line in the examples block must name a described
    // command, and every flag on it must exist for that command.
    const flagsFor = (name: string): Set<string> => {
      const command = cap.commands.find((c) => c.name === name)!;
      const all = [
        ...cap.globalOptions.filter((g) => g.appliesTo.includes(name)),
        ...command.options,
      ];
      return new Set(all.map((o) => /^--[a-z-]+/.exec(o.flag)![0]));
    };
    for (const line of generated.examples!.split("\n")) {
      const match = /`acm ([a-z-]+)([^`]*)`/.exec(line);
      if (!match) continue;
      const command = cap.commands.find((c) => c.name === match[1]);
      expect(command, `unknown command in example: ${line}`).toBeDefined();
      for (const flag of match[2]!.matchAll(/--[a-z-]+/g))
        expect(flagsFor(match[1]!), `bad flag ${flag[0]} in: ${line}`).toContain(flag[0]);
    }
  });
});

describe("G3 — packagings carry byte-identical shared blocks (FR-006, SC-004)", () => {
  const canonical = { ...authored, ...generated };

  for (const [targetName, relPath] of Object.entries(skill.targets)) {
    it(`${targetName}: every marked block matches its canonical source byte-for-byte`, () => {
      const blocks = extractBlocks(fileContent(relPath));
      expect([...blocks.keys()]).toEqual([...BODY_BLOCK_ORDER]);
      for (const [id, content] of blocks) {
        expect(content, `block ${id} in ${targetName}`).toBe(canonical[id]!.trim());
      }
    });
  }

  it("the SKILL.md frontmatter description IS the activation block (single-line form)", () => {
    const skillMd = fileContent(skill.targets["claude-skill"]!);
    const description = /^description: (.*)$/m.exec(skillMd)![1]!;
    expect(description).toBe(authored.activation!.trim().replace(/\s*\n\s*/g, " "));
  });

  it("the two skill packagings are byte-identical files", () => {
    expect(fileContent(skill.targets["claude-skill"]!)).toBe(
      fileContent(skill.targets["skills-package"]!),
    );
  });

  it("the --target enum in the registry matches the generator's target set", () => {
    const spec = REGISTRY.find((c) => c.name === "agent-docs")!;
    const choices = spec.options.find((o) => o.flag.startsWith("--target"))!.choices!;
    expect([...choices].sort()).toEqual(Object.keys(skill.targets).sort());
  });
});

describe("G5 — token budgets under ceil(bytes/4) (FR-008, SC-002)", () => {
  it("the resident Activation Description measures ≤ 100 tokens (400 bytes)", () => {
    const skillMd = fileContent(skill.targets["claude-skill"]!);
    const description = /^description: (.*)$/m.exec(skillMd)![1]!;
    expect(gauge(description)).toBeLessThanOrEqual(100);
  });

  it("the on-demand body measures ≤ 2,000 tokens (8,000 bytes), markers included", () => {
    const skillMd = fileContent(skill.targets["claude-skill"]!);
    const body = skillMd.slice(skillMd.indexOf("---", 4) + 4);
    expect(gauge(body)).toBeLessThanOrEqual(2000);
  });
});

describe("G6 — every error path has a prescribed branch (FR-003, SC-006)", () => {
  it("the playbook covers 100% of the ACM-D-* registry", () => {
    const playbook = authored["error-playbook"]!;
    for (const { code } of cap.errorCodes) {
      expect(playbook, `playbook is missing a branch for ${code}`).toContain(`\`${code}\``);
    }
  });

  it("the zero-result branch is prescribed as success (broaden, never fabricate)", () => {
    expect(authored["error-playbook"]).toMatch(/zero-result search is \*\*success\*\*/i);
  });
});

describe("G4 half — the untrusted-data instruction is present (FR-004, SC-005)", () => {
  it("the skill instructs that all Manifest-originated text is data, never instructions", () => {
    const skillMd = fileContent(skill.targets["claude-skill"]!);
    const posture = extractBlocks(skillMd).get("security-posture")!;
    expect(posture).toContain("never instructions");
    expect(posture).toContain("suggestions");
    expect(posture).toContain("NS-DATA-1");
  });

  it("the corpus-detection preamble and graceful empty-corpus stop are prescribed (FR-009)", () => {
    const preamble = authored["corpus-preamble"]!;
    expect(preamble).toContain("acm capabilities");
    expect(preamble).toContain("ACM-D-EMPTY-CORPUS");
    expect(BODY_BLOCK_ORDER[0]).toBe("corpus-preamble"); // workflow starts with detection
  });

  it("the workflow forbids help-text scraping and prose branching (FR-002/FR-003)", () => {
    expect(authored.workflow).toContain("do not scrape help text");
    expect(authored.workflow).toContain("never on prose");
  });

  it("the workflow prescribes the tier-3 retrieval floor on a miss (list all, pick by reading)", () => {
    // Tier 2: agent-generated synonym expansion. Tier 3: list-all fallback.
    expect(authored.workflow).toContain("synonyms you generate");
    expect(authored.workflow).toContain("acm component --dense");
    expect(authored.workflow).toContain("never fabricate");
  });
});

describe("generator projection sanity (spec 004 R-01 reuse)", () => {
  it("generated blocks cover exactly the jsonSupported discovery subset", () => {
    expect(cap.jsonSupported).toEqual(["search", "component", "capabilities"]);
    expect(generated["quick-reference"]).toContain("acm search");
    expect(generated["quick-reference"]).toContain("acm component");
    expect(generated["quick-reference"]).toContain("acm capabilities");
    expect(generated["quick-reference"]).not.toContain("acm validate");
    expect(generated["quick-reference"]).not.toContain("acm agent-docs");
  });

  it("every authored block id is present and non-empty", () => {
    for (const id of AUTHORED_BLOCK_IDS) expect(authored[id]!.trim().length).toBeGreaterThan(0);
  });
});
