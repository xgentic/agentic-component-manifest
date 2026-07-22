import { describe, expect, it } from "vitest";
import { capabilities, component, search } from "../../toolchain/src/api.js";
import {
  AcmDiscoveryError,
  isError,
  parseResponse,
  assertResponse,
} from "../../toolchain/src/envelope.js";
import { REGISTRY } from "../../toolchain/src/registry.js";
import {
  buildCapabilityManifest,
  checkRegistryCompleteness,
} from "../../toolchain/src/capability.js";
import { DISCOVERY_CORPUS, readFixture, runAcm } from "./helpers.js";

/**
 * US3/US4/US5 gates: envelope validity on every path, stdout purity, exit
 * codes, the capability drift gate, and per-operation API ⇄ CLI parity
 * (spec 004 FR-005/006/008/009/010, SC-003/006/007).
 */

const EMPTY_PROJECT = `${DISCOVERY_CORPUS}/node_modules/plain-pkg`;

describe("typed envelopes on every path (FR-005/FR-006, SC-003)", () => {
  const cases: Array<{
    label: string;
    args: string[];
    type?: string;
    code?: string;
    exit: number;
  }> = [
    {
      label: "search success",
      args: ["search", "button", "--project", DISCOVERY_CORPUS],
      type: "search",
      exit: 0,
    },
    {
      label: "zero-result search is success",
      args: ["search", "nonexistentquery", "--project", DISCOVERY_CORPUS],
      type: "search",
      exit: 0,
    },
    {
      label: "component list",
      args: ["component", "--project", DISCOVERY_CORPUS],
      type: "component.list",
      exit: 0,
    },
    {
      label: "component detail",
      args: ["component", "Button", "--project", DISCOVERY_CORPUS],
      type: "component.detail",
      exit: 0,
    },
    { label: "capabilities", args: ["capabilities"], type: "capabilities", exit: 0 },
    {
      label: "empty corpus",
      args: ["search", "x", "--project", EMPTY_PROJECT],
      code: "ACM-D-EMPTY-CORPUS",
      exit: 1,
    },
    {
      label: "unknown component",
      args: ["component", "Buttn", "--project", DISCOVERY_CORPUS],
      code: "ACM-D-UNKNOWN-COMPONENT",
      exit: 1,
    },
    {
      label: "ambiguous component",
      args: ["component", "AcmeButton", "--project", DISCOVERY_CORPUS],
      code: "ACM-D-AMBIGUOUS-COMPONENT",
      exit: 1,
    },
    {
      label: "bad explicit manifest",
      args: ["search", "x", "--project", EMPTY_PROJECT, "--manifest", "does/not/exist.json"],
      code: "ACM-D-BAD-MANIFEST",
      exit: 1,
    },
    {
      label: "usage: unknown option",
      args: ["search", "x", "--bogus", "--project", DISCOVERY_CORPUS],
      code: "ACM-D-USAGE",
      exit: 2,
    },
    {
      label: "usage: bad enum value",
      args: ["search", "x", "--type", "hook", "--project", DISCOVERY_CORPUS],
      code: "ACM-D-USAGE",
      exit: 2,
    },
    {
      label: "usage: malformed number",
      args: ["search", "x", "--limit", "zero", "--project", DISCOVERY_CORPUS],
      code: "ACM-D-USAGE",
      exit: 2,
    },
    { label: "usage: unknown command", args: ["swizzle"], code: "ACM-D-USAGE", exit: 2 },
  ];

  for (const c of cases) {
    it(c.label, () => {
      const { stdout, exitCode } = runAcm([...c.args, "--json"]);
      expect(exitCode).toBe(c.exit);
      // stdout is exactly one parseable envelope: parseResponse would throw on
      // banners, diagnostics, or trailing content beyond the one document.
      const result = parseResponse(stdout);
      expect(stdout.endsWith("\n")).toBe(true);
      expect(stdout.trimEnd().split("\n").length).toBe(1);
      if (c.type !== undefined) {
        expect(isError(result)).toBe(false);
        if (!isError(result)) expect(result.type).toBe(c.type);
      } else {
        expect(isError(result)).toBe(true);
        if (isError(result)) expect(result.code).toBe(c.code);
      }
    });
  }

  it("corpus skip diagnostics go to stderr only and never break the envelope", () => {
    const { stdout, stderr, exitCode } = runAcm([
      "search",
      "button",
      "--project",
      DISCOVERY_CORPUS,
      "--json",
    ]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(stderr).toContain("broken-pkg");
    expect(stderr).toContain("ACM-D-BAD-MANIFEST");
  });

  it("unknown-name errors carry suggestions; every error carries a code", () => {
    const { stdout } = runAcm(["component", "Buttn", "--project", DISCOVERY_CORPUS, "--json"]);
    const result = parseResponse(stdout);
    if (!isError(result)) throw new Error("expected an error envelope");
    expect(result.code).toBe("ACM-D-UNKNOWN-COMPONENT");
    expect(result.suggestions![0]!.name).toBe("Button");
  });
});

describe("capability manifest (FR-008, SC-006)", () => {
  it("every registry entry is completely described (drift gate)", () => {
    expect(checkRegistryCompleteness(REGISTRY)).toEqual([]);
  });

  it("the payload matches the version-normalized golden", () => {
    const payload = buildCapabilityManifest();
    payload.version = "<normalized>";
    expect(JSON.stringify(payload, null, 2) + "\n").toBe(
      readFixture("discovery/capability.golden.json"),
    );
  });

  it("describes 100% of commands, and the discovery subset via jsonSupported", async () => {
    const { data } = await capabilities();
    expect(data.commands.map((c) => c.name).sort()).toEqual(REGISTRY.map((c) => c.name).sort());
    expect(data.jsonSupported).toEqual(["search", "component", "capabilities"]);
    expect(data.errorCodes.map((e) => e.code)).toContain("ACM-D-UNKNOWN");
  });

  it("accuracy: the documented example invocation of every discovery command is accepted", async () => {
    const { data } = await capabilities();
    for (const name of data.jsonSupported) {
      const command = data.commands.find((c) => c.name === name)!;
      const args = command.examples[0]!.split(" ").slice(1);
      const needsCorpus = name !== "capabilities";
      const { stdout, exitCode } = runAcm(
        needsCorpus ? [...args, "--project", DISCOVERY_CORPUS] : args,
      );
      expect(exitCode).toBe(0);
      const result = parseResponse(stdout);
      if (isError(result)) throw new Error(`${name} example failed: ${result.error}`);
      expect(command.responseTypes).toContain(result.type);
    }
  });
});

describe("API ⇄ CLI parity (FR-009/FR-010, SC-007)", () => {
  it("search: programmatic result deep-equals spawned CLI machine output", async () => {
    const api = await search("button", { project: DISCOVERY_CORPUS, detail: "full", limit: 3 });
    const cli = runAcm([
      "search",
      "button",
      "--project",
      DISCOVERY_CORPUS,
      "--detail",
      "full",
      "--limit",
      "3",
      "--json",
    ]);
    expect(JSON.parse(cli.stdout)).toEqual(api);
  });

  it("component list and detail: identical data on both surfaces", async () => {
    const apiList = await component(undefined, { project: DISCOVERY_CORPUS, detail: "compact" });
    const cliList = runAcm([
      "component",
      "--project",
      DISCOVERY_CORPUS,
      "--detail",
      "compact",
      "--json",
    ]);
    expect(JSON.parse(cliList.stdout)).toEqual(apiList);

    const apiDetail = await component("AcmeButton", {
      project: DISCOVERY_CORPUS,
      from: "@acme/lit-buttons",
    });
    const cliDetail = runAcm([
      "component",
      "AcmeButton",
      "--from",
      "@acme/lit-buttons",
      "--project",
      DISCOVERY_CORPUS,
      "--json",
    ]);
    expect(JSON.parse(cliDetail.stdout)).toEqual(apiDetail);
  });

  it("capabilities: identical self-description on both surfaces", async () => {
    const api = await capabilities();
    const cli = runAcm(["capabilities", "--json"]);
    expect(JSON.parse(cli.stdout)).toEqual(api);
  });

  it("errors: the thrown code and suggestions equal the envelope's, per code", async () => {
    const forced: Array<{ args: string[]; call: () => Promise<unknown> }> = [
      {
        args: ["search", "x", "--project", EMPTY_PROJECT],
        call: () => search("x", { project: EMPTY_PROJECT }),
      },
      {
        args: ["component", "Buttn", "--project", DISCOVERY_CORPUS],
        call: () => component("Buttn", { project: DISCOVERY_CORPUS }),
      },
      {
        args: ["component", "AcmeButton", "--project", DISCOVERY_CORPUS],
        call: () => component("AcmeButton", { project: DISCOVERY_CORPUS }),
      },
      {
        args: ["search", "x", "--project", EMPTY_PROJECT, "--manifest", "does/not/exist.json"],
        call: () => search("x", { project: EMPTY_PROJECT, manifests: ["does/not/exist.json"] }),
      },
      {
        args: ["search", "x", "--project", DISCOVERY_CORPUS, "--type", "hook"],
        call: () => search("x", { project: DISCOVERY_CORPUS, type: "hook" }),
      },
    ];
    for (const { args, call } of forced) {
      const cli = parseResponse(runAcm([...args, "--json"]).stdout);
      if (!isError(cli)) throw new Error(`expected error envelope for: ${args.join(" ")}`);
      const thrown = (await call().catch((e: unknown) => e)) as AcmDiscoveryError;
      expect(thrown).toBeInstanceOf(AcmDiscoveryError);
      expect(thrown.code).toBe(cli.code);
      expect(thrown.suggestions).toEqual(cli.suggestions);
    }
  });

  it("consumer utilities classify raw output correctly", () => {
    const ok = runAcm(["component", "Button", "--project", DISCOVERY_CORPUS, "--json"]).stdout;
    const detail = assertResponse(ok, "component.detail");
    expect(detail.data.name).toBe("Button");
    expect(() => assertResponse(ok, "search")).toThrow(/expected response type "search"/);

    const err = runAcm(["component", "Buttn", "--project", DISCOVERY_CORPUS, "--json"]).stdout;
    expect(() => assertResponse(err, "component.detail")).toThrow(AcmDiscoveryError);
    expect(() => parseResponse("not json at all")).toThrow(/not parseable JSON/);
    expect(() => parseResponse('{"neither": true}')).toThrow(/neither "type" nor "error"/);
  });
});
