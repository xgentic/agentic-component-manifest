import { describe, expect, it } from "vitest";
import { encode } from "gpt-tokenizer";
import { component } from "../../toolchain/src/api.js";
import { AcmDiscoveryError, assertResponse } from "../../toolchain/src/envelope.js";
import { DISCOVERY_CORPUS, loadFixture, readFixture, runAcm } from "./helpers.js";

/**
 * US2 gates: component detail/list, suggestions, disambiguation, dense mode
 * (spec 004 FR-003/007, SC-008).
 */

const PROJECT = { project: DISCOVERY_CORPUS };

describe("acm component — detail (FR-003)", () => {
  it("returns the Manifest entry verbatim, every populated section included", async () => {
    const envelope = await component("AcmeButton", { ...PROJECT, from: "@acme/lit-buttons" });
    expect(envelope.type).toBe("component.detail");
    if (envelope.type !== "component.detail") return;
    const witness = loadFixture(
      "discovery-corpus/node_modules/@acme/lit-buttons/manifest/acm.json",
    );
    expect(envelope.data.entry).toEqual(witness.modules[0].declarations[0]);
    expect(envelope.data.source).toEqual({
      package: "@acme/lit-buttons",
      path: "node_modules/@acme/lit-buttons/manifest/acm.json",
    });
  });

  it("resolves names case-insensitively", async () => {
    const envelope = await component("acmebutton", { ...PROJECT, from: "@acme/lit-buttons" });
    expect(envelope.type).toBe("component.detail");
  });

  it("golden-pinned detail output", () => {
    const { stdout, exitCode } = runAcm([
      "component",
      "AcmeButton",
      "--from",
      "@acme/lit-buttons",
      "--project",
      DISCOVERY_CORPUS,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe(readFixture("discovery/component-detail-lit.golden.txt"));
  });
});

describe("acm component — list levels (FR-007)", () => {
  it("lists the whole corpus at brief by default (names only, package-grouped)", async () => {
    const envelope = await component(undefined, PROJECT);
    expect(envelope.type).toBe("component.list");
    if (envelope.type !== "component.list") return;
    expect(envelope.data.total).toBe(7);
    const lit = envelope.data.packages.find((p) => p.package === "@acme/lit-buttons")!;
    expect(lit.components).toEqual([{ name: "AcmeButton" }]);
  });

  it("compact adds the verbatim one-line description and the tag facet", async () => {
    const envelope = await component(undefined, { ...PROJECT, detail: "compact" });
    if (envelope.type !== "component.list") throw new Error("expected list");
    const lit = envelope.data.packages.find((p) => p.package === "@acme/lit-buttons")!;
    expect(lit.components[0]).toEqual({
      name: "AcmeButton",
      tagName: "acme-button",
      description: "A themable action button rendered as a custom element.",
    });
    // A component with no tag facet (react/vdom) carries no tagName.
    const react = envelope.data.packages.find((p) => p.package === "@acme/react-buttons")!;
    expect(react.components[0]).toEqual({
      name: "Button",
      description: "A themable action button as a JSX function component.",
    });
  });

  it("full embeds the verbatim entry per component", async () => {
    const envelope = await component(undefined, { ...PROJECT, detail: "full" });
    if (envelope.type !== "component.list") throw new Error("expected list");
    const lit = envelope.data.packages.find((p) => p.package === "@acme/lit-buttons")!;
    expect((lit.components[0] as { entry?: unknown }).entry).toBeDefined();
  });

  it("golden-pinned compact list output", () => {
    const { stdout, exitCode } = runAcm([
      "component",
      "--project",
      DISCOVERY_CORPUS,
      "--detail",
      "compact",
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe(readFixture("discovery/component-list-compact.golden.txt"));
  });
});

describe("acm component — suggestions and disambiguation (R-05)", () => {
  it("unknown names fail with closest-name suggestions", async () => {
    const error = await component("Buttn", PROJECT).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AcmDiscoveryError);
    const coded = error as AcmDiscoveryError;
    expect(coded.code).toBe("ACM-D-UNKNOWN-COMPONENT");
    expect(coded.suggestions![0]).toMatchObject({ name: "Button", reason: "similar name" });
  });

  it("cross-package ambiguity lists qualified candidates instead of picking one", async () => {
    const error = (await component("AcmeButton", PROJECT).catch(
      (e: unknown) => e,
    )) as AcmDiscoveryError;
    expect(error.code).toBe("ACM-D-AMBIGUOUS-COMPONENT");
    const followUps = error.suggestions!.map((s) => s.followUp);
    expect(followUps).toContain("acm component AcmeButton --from @acme/lit-buttons");
    expect(followUps).toContain("acm component AcmeButton --from @acme/vue-buttons");
    // Every candidate's follow-up resolves.
    for (const suggestion of error.suggestions!) {
      const envelope = await component("AcmeButton", { ...PROJECT, from: suggestion.source! });
      expect(envelope.type).toBe("component.detail");
    }
  });

  it("intra-package duplicates disambiguate by module facet — package scope never loops back", async () => {
    const error = (await component("Chip", { ...PROJECT, from: "@acme/mixed" }).catch(
      (e: unknown) => e,
    )) as AcmDiscoveryError;
    expect(error.code).toBe("ACM-D-AMBIGUOUS-COMPONENT");
    const followUps = error.suggestions!.map((s) => s.followUp);
    expect(followUps).toContain("acm component Chip --from @acme/mixed --module @acme/mixed/a");
    const envelope = await component("Chip", {
      ...PROJECT,
      from: "@acme/mixed",
      module: "@acme/mixed/b",
    });
    expect(envelope.type).toBe("component.detail");
  });
});

describe("acm component — dense mode (FR-007/SC-008, ADR 0001 one-way)", () => {
  it("dense detail is ≥ 40% smaller than the entry's formatted Canonical JSON", () => {
    // Baseline per the repo's Agent View token-economy precedent
    // (gate-agent-view): the formatted Canonical JSON an agent would otherwise
    // ingest verbatim — here, the full entry from the machine envelope.
    const envelope = assertResponse(
      runAcm([
        "component",
        "AcmeButton",
        "--from",
        "@acme/lit-buttons",
        "--project",
        DISCOVERY_CORPUS,
        "--json",
      ]).stdout,
      "component.detail",
    );
    const full = JSON.stringify(envelope.data.entry, null, 2);
    const dense = runAcm([
      "component",
      "AcmeButton",
      "--from",
      "@acme/lit-buttons",
      "--project",
      DISCOVERY_CORPUS,
      "--dense",
    ]).stdout;
    expect(dense.length).toBeLessThanOrEqual(full.length * 0.6);
    // Informative token accounting (SC-008 reporting requirement).
    expect(encode(dense).length).toBeLessThan(encode(full).length);
  });

  it("dense full-corpus list is ≥ 40% smaller than the full list", () => {
    const full = runAcm([
      "component",
      "--project",
      DISCOVERY_CORPUS,
      "--detail",
      "full",
      "--json",
    ]).stdout;
    const dense = runAcm(["component", "--project", DISCOVERY_CORPUS, "--dense"]).stdout;
    expect(dense.length).toBeLessThanOrEqual(full.length * 0.6);
    expect(encode(dense).length).toBeLessThan(encode(full).length);
  });

  it("the dense list is the tier-3 floor: name, tag, package, one-liner per line", () => {
    // --dense with no --detail still carries descriptions + tags (bumped to
    // compact), so the agent can pick the right component by reading.
    const dense = runAcm(["component", "--project", DISCOVERY_CORPUS, "--dense"]).stdout;
    const litLine = dense.split("\n").find((l) => l.startsWith("AcmeButton  acme-button"))!;
    expect(litLine).toContain("@acme/lit-buttons");
    expect(litLine).toContain("A themable action button rendered as a custom element.");
    // Every component is one line; the whole corpus is scannable.
    expect(dense.trimEnd().split("\n").length).toBe(7);
  });

  it("dense detail renders the Agent View projection (block YAML, quoted hostility)", () => {
    const dense = runAcm([
      "component",
      "AcmeButton",
      "--from",
      "@acme/lit-buttons",
      "--project",
      DISCOVERY_CORPUS,
      "--dense",
    ]).stdout;
    expect(dense.startsWith("name: AcmeButton\n")).toBe(true);
    expect(dense).toContain("tagName: acme-button");
  });
});
