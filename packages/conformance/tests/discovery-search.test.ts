import { describe, expect, it } from "vitest";
import { search } from "../../toolchain/src/api.js";
import { DISCOVERY_CORPUS, readFixture, runAcm } from "./helpers.js";

/**
 * US1 gates: ranked search over the discovery corpus (spec 004 FR-001/002,
 * SC-002). Ranking tiers are contract; exact text layout is pinned by goldens.
 */

const PROJECT = { project: DISCOVERY_CORPUS };

describe("acm search — ranking (FR-001)", () => {
  it("ranks name matches above prose-only mentions", async () => {
    const { data } = await search("button", PROJECT);
    expect(data.results[0]!.name).toBe("Button"); // name-exact beats everything
    const names = data.results.map((r) => r.name);
    // Chip mentions "button" only in description prose — it must come last.
    expect(names.at(-1)).toBe("Chip");
    expect(data.results.at(-1)!.source).toBe("@acme/mixed");
  });

  it("finds a component through its Identity Facet (tag name)", async () => {
    const { data } = await search("acme-button", PROJECT);
    expect(data.results[0]!.name).toBe("AcmeButton");
    expect(data.results[0]!.source).toBe("@acme/lit-buttons");
  });

  it("places a single-char typo in the top three (SC-002)", async () => {
    const { data } = await search("buttn", PROJECT);
    expect(data.results.slice(0, 3).map((r) => r.name)).toContain("Button");
  });

  it("finds components through controlled semantic terms alone (US1-AS3)", async () => {
    const { data } = await search("badge", PROJECT);
    expect(data.results.length).toBe(2);
    expect(data.results.every((r) => r.name === "Chip")).toBe(true);
  });

  it("treats regex/glob metacharacters as literal text", async () => {
    const { data } = await search(".*", PROJECT);
    expect(data.total).toBe(0);
    const bracket = await search("[component]", PROJECT);
    expect(bracket.data.total).toBe(0);
  });

  it("every result carries name, verbatim one-liner, domain tag, and follow-up (FR-001)", async () => {
    const { data } = await search("button", PROJECT);
    for (const result of data.results) {
      expect(result.name).toBeTruthy();
      expect(result.domain).toBe("component");
      expect(typeof result.description).toBe("string");
      expect(result.followUp).toMatch(/^acm component /);
    }
  });

  it("follow-up commands are qualified exactly when the bare name is ambiguous", async () => {
    const { data } = await search("button", PROJECT);
    const byName = Object.fromEntries(
      data.results.map((r) => [`${r.name}@${r.source}`, r.followUp]),
    );
    expect(byName["Button@@acme/react-buttons"]).toBe("acm component Button");
    expect(byName["AcmeButton@@acme/lit-buttons"]).toBe(
      "acm component AcmeButton --from @acme/lit-buttons",
    );
  });
});

describe("acm search — options (FR-002)", () => {
  it("caps results at --limit while total reports the uncapped count", async () => {
    const { data } = await search("button", { ...PROJECT, limit: 2 });
    expect(data.results.length).toBe(2);
    expect(data.total).toBe(5);
  });

  it("reports zero matches as an explicitly empty, successful result set", async () => {
    const { data } = await search("nonexistentquery", PROJECT);
    expect(data.total).toBe(0);
    expect(data.results).toEqual([]);
  });

  it("a zero-result search carries the broaden-and-scan followUps (tier-3 signal)", async () => {
    const { data } = await search("zzznomatch", PROJECT);
    expect(data.followUps).toEqual(["acm component --dense"]);
    // A non-empty search does not carry followUps — the field is the miss signal.
    const hit = await search("button", PROJECT);
    expect(hit.data.followUps).toBeUndefined();
  });

  it("adds source and match reason at --detail full", async () => {
    const { data } = await search("button", { ...PROJECT, detail: "full" });
    const top = data.results[0]!;
    expect(top.score).toBeGreaterThan(0);
    expect(top.matches![0]).toEqual({ token: "button", tier: "name-exact" });
  });

  it("rejects an unknown domain value, listing supported domains", async () => {
    await expect(search("x", { ...PROJECT, type: "hook" })).rejects.toMatchObject({
      code: "ACM-D-USAGE",
      message: expect.stringContaining("component"),
    });
  });
});

describe("acm search — golden-pinned text output (FR-012)", () => {
  it("compact search output is byte-identical to the golden", () => {
    const { stdout, exitCode } = runAcm(["search", "button", "--project", DISCOVERY_CORPUS]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe(readFixture("discovery/search-button-compact.golden.txt"));
  });

  it("full-detail search output is byte-identical to the golden", () => {
    const { stdout, exitCode } = runAcm([
      "search",
      "button",
      "--project",
      DISCOVERY_CORPUS,
      "--detail",
      "full",
      "--limit",
      "3",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe(readFixture("discovery/search-button-full.golden.txt"));
  });
});
