import path from "node:path";
import { describe, expect, it } from "vitest";
import { agentViewFromText, checkCanonical, validateManifest } from "../../toolchain/src/index.js";
import { analyzeProject } from "../../analyzer/src/run.js";
import { defaultSettings, type BuiltinFramework } from "../../analyzer/src/types.js";
import { FIXTURES, readFixture } from "./helpers.js";

/**
 * FR-014 / SC-008: the stress testbeds. One maximally complex DataGrid-class component
 * per framework, checked in as real source with byte-pinned goldens. This gate walks
 * the capability inventory (contracts/testbed-inventory.md): every row maps to at least
 * one machine assertion (presence / shape / negative), the analyzer byte-matches the
 * golden `agentic-component-manifest.json` and `acm.view.yml`, and re-analysis is byte-identical (SC-002).
 */

type Json = Record<string, any>;

interface Testbed {
  fw: BuiltinFramework;
  dir: string;
}

const TESTBEDS: Testbed[] = [
  { fw: "lit", dir: "testbed/lit" },
  { fw: "angular", dir: "testbed/angular" },
  { fw: "stencil", dir: "testbed/stencil" },
  { fw: "react", dir: "testbed/react" },
];

async function analyze(t: Testbed): Promise<string | null> {
  const settings = defaultSettings();
  settings.frameworks = [t.fw];
  const outcome = await analyzeProject(settings, path.join(FIXTURES, t.dir), { write: false });
  return outcome.text;
}

/** The single declaration under test in a testbed golden. */
function goldenDecl(dir: string): Json {
  return JSON.parse(readFixture(`${dir}/agentic-component-manifest.json`)).modules[0]
    .declarations[0];
}

/** True when some node anywhere in `obj` satisfies `pred`. */
function deepSome(obj: unknown, pred: (node: Json) => boolean): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (!Array.isArray(obj) && pred(obj as Json)) return true;
  return Object.values(obj).some((v) => deepSome(v, pred));
}

/** Every member (input/event/method/slot/cssProperty/cssPart) name in a declaration. */
function memberNames(decl: Json): string[] {
  const groups = ["inputs", "events", "methods", "slots", "cssProperties", "cssParts"] as const;
  return groups.flatMap((g) => (decl[g] ?? []).map((m: Json) => m.name).filter(Boolean));
}

const byName = (arr: Json[] | undefined, name: string): Json | undefined =>
  (arr ?? []).find((m) => m.name === name);

// --- Inventory rows: each is one machine assertion over the golden declaration. ---

interface Row {
  id: string;
  check: (d: Json) => boolean;
}

const LIT_ROWS: Row[] = [
  {
    id: "L1 identity: tagName + retained-dom + module/export",
    check: (d) =>
      d.identity.tagName === "acme-data-grid" &&
      d.identity.paradigmClass === "retained-dom" &&
      !!d.identity.module &&
      !!d.identity.export,
  },
  {
    id: "L2 >=10 reactive properties in source order",
    check: (d) => (d.inputs?.length ?? 0) >= 10,
  },
  {
    id: "L3 literal-union property",
    check: (d) => {
      const i = byName(d.inputs, "selectionMode");
      return (
        i?.type.structured.kind === "union" &&
        i.type.structured.members.every((m: Json) => m.kind === "literal")
      );
    },
  },
  {
    id: "L4 generic-bearing array-of-reference",
    check: (d) => {
      const i = byName(d.inputs, "columns");
      return i?.type.structured.kind === "array" && i.type.structured.items.kind === "reference";
    },
  },
  {
    id: "L5 function-typed property",
    check: (d) => byName(d.inputs, "rowClass")?.type.structured.kind === "function",
  },
  {
    id: "L6 beyond-depth object -> opaque fallback + raw",
    check: (d) => {
      const i = byName(d.inputs, "renderConfig");
      return deepSome(i?.type.structured, (n) => n.kind === "opaque") && !!i?.type.raw;
    },
  },
  {
    id: "L7 reflect:true -> reflects",
    check: (d) => (d.inputs ?? []).some((i: Json) => i.reflects === true),
  },
  {
    id: "L8 attribute alias captured, type intact",
    check: (d) => {
      const i = byName(d.inputs, "label");
      return i?.["x-attribute"] === "data-label" && i.type.structured.kind === "primitive";
    },
  },
  {
    id: "L9 property initializer -> default verbatim",
    check: (d) => byName(d.inputs, "pageSize")?.default === "25",
  },
  {
    id: "L10 undocumented member -> description absent",
    check: (d) =>
      byName(d.inputs, "caption") !== undefined &&
      byName(d.inputs, "caption")!.description === undefined &&
      byName(d.inputs, "selectionMode")?.description !== undefined,
  },
  {
    id: "L11 >=4 typed events",
    check: (d) => (d.events?.length ?? 0) >= 4 && d.events.every((e: Json) => !!e.payload),
  },
  {
    id: "L12 default slot + >=3 named slots",
    check: (d) => {
      const unnamed = (d.slots ?? []).filter((s: Json) => s.name === undefined).length;
      const named = (d.slots ?? []).filter((s: Json) => s.name !== undefined).length;
      return unnamed === 1 && named >= 3;
    },
  },
  {
    id: "L13 >=3 methods with param + return types",
    check: (d) =>
      (d.methods?.length ?? 0) >= 3 &&
      d.methods.some((m: Json) => m.parameters?.length && m.return) &&
      d.methods.some((m: Json) => m.return?.raw === "Promise<void>"),
  },
  {
    id: "L14 private/#/@state members absent (negative)",
    check: (d) => {
      const forbidden = ["_hoveredRow", "_cache", "#internalId", "internalId", "styles"];
      return forbidden.every((n) => !memberNames(d).includes(n));
    },
  },
  { id: "L15 >=4 CSS custom properties", check: (d) => (d.cssProperties?.length ?? 0) >= 4 },
  { id: "L16 >=3 CSS parts", check: (d) => (d.cssParts?.length ?? 0) >= 3 },
  {
    id: "L17 static formAssociated -> x-wc node",
    check: (d) => d["x-wc"]?.formAssociated === true,
  },
];

const ANGULAR_ROWS: Row[] = [
  {
    id: "A1 selector identity, signals-di, NO tagName (negative)",
    check: (d) =>
      d.identity.selector === "acme-data-grid" &&
      d.identity.paradigmClass === "signals-di" &&
      !!d.identity.module &&
      !!d.identity.export &&
      d.identity.tagName === undefined,
  },
  {
    id: "A2 decorated @Input incl aliased + transform, public names",
    check: (d) =>
      byName(d.inputs, "data-label") !== undefined && byName(d.inputs, "disabled") !== undefined,
  },
  {
    id: "A3 signal input(default) + input.required distinction",
    check: (d) =>
      byName(d.inputs, "pageSize")?.required === true &&
      byName(d.inputs, "size")?.default === "200" &&
      byName(d.inputs, "pageSize")?.default === undefined,
  },
  {
    id: "A4 >=2 model() two-way inputs surfaced (twoWay)",
    check: (d) => (d.inputs ?? []).filter((i: Json) => i.twoWay === true).length >= 2,
  },
  {
    id: "A5 decorator + signal outputs -> typed events",
    check: (d) => (d.events?.length ?? 0) >= 2 && d.events.every((e: Json) => !!e.payload),
  },
  {
    id: "A6 multi-selector projection + default slot",
    check: (d) => {
      const unnamed = (d.slots ?? []).filter((s: Json) => s.name === undefined).length;
      const named = (d.slots ?? []).filter((s: Json) => s.name !== undefined).length;
      return unnamed === 1 && named >= 3;
    },
  },
  { id: "A7 host CSS custom properties", check: (d) => (d.cssProperties?.length ?? 0) >= 1 },
  {
    id: "A8 injected DI absent (negative)",
    check: (d) => !memberNames(d).includes("config") && !memberNames(d).includes("GRID_CONFIG"),
  },
  {
    id: "A9 >=3 public methods incl async",
    check: (d) =>
      (d.methods?.length ?? 0) >= 3 &&
      d.methods.some((m: Json) => m.return?.raw === "Promise<void>"),
  },
  {
    id: "A10 protected/private/internal signals absent (negative)",
    check: (d) => {
      const forbidden = ["hoveredIndex", "_cache", "_revision", "denseClass", "ngOnInit"];
      return forbidden.every((n) => !memberNames(d).includes(n));
    },
  },
  {
    id: "A11 undocumented member -> description absent",
    check: (d) =>
      byName(d.inputs, "caption")?.description === undefined &&
      byName(d.inputs, "density")?.description !== undefined,
  },
  {
    id: "A12 union + generic-ref + function + opaque inputs (mirror L3-L6)",
    check: (d) =>
      byName(d.inputs, "density")?.type.structured.kind === "union" &&
      byName(d.inputs, "columns")?.type.structured.items?.kind === "reference" &&
      byName(d.inputs, "rowClass")?.type.structured.kind === "function" &&
      deepSome(byName(d.inputs, "renderConfig")?.type.structured, (n) => n.kind === "opaque"),
  },
];

const STENCIL_ROWS: Row[] = [
  {
    id: "S1 identity: tagName + retained-dom + module/export",
    check: (d) =>
      d.identity.tagName === "acme-data-grid" &&
      d.identity.paradigmClass === "retained-dom" &&
      !!d.identity.module &&
      !!d.identity.export,
  },
  { id: "S2 >=10 @Prop() inputs in source order", check: (d) => (d.inputs?.length ?? 0) >= 10 },
  {
    id: "S3 literal-union property",
    check: (d) => {
      const i = byName(d.inputs, "selectionMode");
      return (
        i?.type.structured.kind === "union" &&
        i.type.structured.members.every((m: Json) => m.kind === "literal")
      );
    },
  },
  {
    id: "S4 generic-bearing array-of-reference",
    check: (d) => {
      const i = byName(d.inputs, "columns");
      return i?.type.structured.kind === "array" && i.type.structured.items.kind === "reference";
    },
  },
  {
    id: "S5 function-typed property",
    check: (d) => byName(d.inputs, "rowClass")?.type.structured.kind === "function",
  },
  {
    id: "S6 beyond-depth object -> opaque fallback + raw",
    check: (d) => {
      const i = byName(d.inputs, "renderConfig");
      return deepSome(i?.type.structured, (n) => n.kind === "opaque") && !!i?.type.raw;
    },
  },
  {
    id: "S7 @Prop({ reflect: true }) -> reflects",
    check: (d) => (d.inputs ?? []).some((i: Json) => i.reflects === true),
  },
  {
    id: "S8 attribute alias captured, type intact",
    check: (d) => {
      const i = byName(d.inputs, "label");
      return i?.["x-attribute"] === "data-label" && i.type.structured.kind === "primitive";
    },
  },
  {
    id: "S9 @Prop({ mutable: true }) -> x-stencil.mutable",
    check: (d) => byName(d.inputs, "query")?.["x-stencil"]?.mutable === true,
  },
  {
    id: "S10 property initializer -> default verbatim",
    check: (d) => byName(d.inputs, "pageSize")?.default === "25",
  },
  {
    id: "S11 undocumented member -> description absent",
    check: (d) =>
      byName(d.inputs, "caption") !== undefined &&
      byName(d.inputs, "caption")!.description === undefined &&
      byName(d.inputs, "selectionMode")?.description !== undefined,
  },
  {
    id: "S12 >=4 typed events incl aliased public name",
    check: (d) =>
      (d.events?.length ?? 0) >= 4 &&
      d.events.every((e: Json) => !!e.payload) &&
      byName(d.events, "selection-change") !== undefined,
  },
  {
    id: "S13 default slot + >=3 named slots",
    check: (d) => {
      const unnamed = (d.slots ?? []).filter((s: Json) => s.name === undefined).length;
      const named = (d.slots ?? []).filter((s: Json) => s.name !== undefined).length;
      return unnamed === 1 && named >= 3;
    },
  },
  {
    id: "S14 >=3 @Method() incl async Promise<void> with params",
    check: (d) =>
      (d.methods?.length ?? 0) >= 3 &&
      d.methods.some((m: Json) => m.parameters?.length && m.return) &&
      d.methods.every((m: Json) => m.return?.raw === "Promise<void>"),
  },
  {
    id: "S15 opt-in gating: non-@Method + @State/@Element/@Watch/@Listen absent (negative)",
    check: (d) => {
      const forbidden = [
        "recompute",
        "hoveredRow",
        "hostEl",
        "_cache",
        "internalId",
        "onPageSizeChange",
        "onKeydown",
        "render",
      ];
      return forbidden.every((n) => !memberNames(d).includes(n));
    },
  },
  {
    id: "S16 >=4 CSS custom properties + >=3 CSS parts",
    check: (d) => (d.cssProperties?.length ?? 0) >= 4 && (d.cssParts?.length ?? 0) >= 3,
  },
  {
    id: "S17 @Component({ formAssociated: true }) -> x-wc node",
    check: (d) => d["x-wc"]?.formAssociated === true,
  },
  {
    id: "S18 implicit dash-cased attribute for camelCase props; absent for same-name/complex",
    check: (d) =>
      byName(d.inputs, "selectionMode")?.["x-attribute"] === "selection-mode" &&
      byName(d.inputs, "pageSize")?.["x-attribute"] === "page-size" &&
      byName(d.inputs, "dense")?.["x-attribute"] === undefined &&
      byName(d.inputs, "columns")?.["x-attribute"] === undefined,
  },
];

const REACT_ROWS: Row[] = [
  {
    id: "R1 identity: module + export + vdom; no tagName, no selector (negative)",
    check: (d) =>
      d.identity.paradigmClass === "vdom" &&
      !!d.identity.module &&
      d.identity.export === "AcmeDataGrid" &&
      d.identity.tagName === undefined &&
      d.identity.selector === undefined,
  },
  { id: "R2 >=10 props as inputs in source order", check: (d) => (d.inputs?.length ?? 0) >= 10 },
  {
    id: "R3 literal-union prop",
    check: (d) => {
      const i = byName(d.inputs, "selectionMode");
      return (
        i?.type.structured.kind === "union" &&
        i.type.structured.members.every((m: Json) => m.kind === "literal")
      );
    },
  },
  {
    id: "R4 generic-bearing array-of-reference",
    check: (d) => {
      const i = byName(d.inputs, "columns");
      return i?.type.structured.kind === "array" && i.type.structured.items.kind === "reference";
    },
  },
  {
    id: "R5 function-typed prop",
    check: (d) => byName(d.inputs, "rowClass")?.type.structured.kind === "function",
  },
  {
    id: "R6 beyond-depth object -> opaque fallback + raw",
    check: (d) => {
      const i = byName(d.inputs, "renderConfig");
      return deepSome(i?.type.structured, (n) => n.kind === "opaque") && !!i?.type.raw;
    },
  },
  {
    id: "R7 optional vs required props",
    check: (d) =>
      byName(d.inputs, "columns")?.required === true &&
      byName(d.inputs, "rows")?.required === true &&
      byName(d.inputs, "pageSize")?.required === undefined &&
      byName(d.inputs, "gap")?.required === undefined,
  },
  {
    id: "R8 destructuring defaults verbatim, incl. a renamed binding",
    check: (d) =>
      // `{ density: rowDensity = 'comfortable' }` attributes its default to `density`.
      byName(d.inputs, "density")?.default === "'comfortable'" &&
      byName(d.inputs, "selectionMode")?.default === "'single'" &&
      byName(d.inputs, "pageSize")?.default === "25",
  },
  {
    id: "R9 on* callback props stay inputs, never events (negative)",
    check: (d) =>
      byName(d.inputs, "onSortChange")?.type.structured.kind === "function" &&
      byName(d.inputs, "onRowActivate")?.type.structured.kind === "function" &&
      !(d.events ?? []).some((e: Json) => e.name.startsWith("on")),
  },
  {
    id: "R10 useImperativeHandle -> methods typed from the handle interface",
    check: (d) => {
      const m = byName(d.methods, "scrollToRow");
      return (
        (d.methods?.length ?? 0) >= 3 &&
        m?.parameters?.length === 2 &&
        m.return?.raw === "Promise<void>"
      );
    },
  },
  {
    id: "R11 cross-module props merged; unresolvable base recorded, contributes nothing",
    check: (d) => {
      const names = (d.inputs ?? []).map((i: Json) => i.name);
      const merged =
        names.includes("gap") && // GridSpacing, two modules away via GridBase
        names.includes("testId") && // GridBase
        names.includes("columns") && // GridOwnProps
        names.includes("virtualizeAfter") && // intersected mixin
        names.includes("caption"); // Omit dropped the base's, the local literal re-added it
      const unresolved = d["x-react"]?.unresolvedProps ?? [];
      // The bare-specifier base is named verbatim, and none of its members leaked in.
      return (
        merged &&
        unresolved.length === 1 &&
        unresolved[0].includes("HTMLAttributes") &&
        !names.includes("className") &&
        !names.includes("style") &&
        !names.includes("id")
      );
    },
  },
  {
    id: "R12 JSDoc -> events, slots, cssProperties, cssParts",
    check: (d) => {
      const unnamed = (d.slots ?? []).filter((s: Json) => s.name === undefined).length;
      const named = (d.slots ?? []).filter((s: Json) => s.name !== undefined).length;
      return (
        (d.events?.length ?? 0) >= 2 &&
        d.events.every((e: Json) => !!e.payload) &&
        unnamed === 1 && // the `children` prop's default slot
        named >= 3 &&
        (d.cssProperties?.length ?? 0) >= 4 &&
        (d.cssParts?.length ?? 0) >= 3
      );
    },
  },
  {
    id: "R13 internals absent (negative); undocumented prop -> description absent",
    check: (d) => {
      const forbidden = ["renderCount", "GridRow", "selected", "visible", "ref"];
      return (
        forbidden.every((n) => !memberNames(d).includes(n)) &&
        byName(d.inputs, "emptyMessage")?.description === undefined &&
        byName(d.inputs, "caption")?.description !== undefined
      );
    },
  },
];

const ROWS: Record<BuiltinFramework, Row[]> = {
  vanilla: [],
  lit: LIT_ROWS,
  stencil: STENCIL_ROWS,
  angular: ANGULAR_ROWS,
  react: REACT_ROWS,
};

describe("analyzer-testbed: stress testbeds byte-match goldens and walk the inventory (FR-014)", () => {
  for (const t of TESTBEDS) {
    describe(`${t.dir} (${t.fw})`, () => {
      it("analyze(src) byte-matches agentic-component-manifest.json", async () => {
        expect(await analyze(t)).toBe(readFixture(`${t.dir}/agentic-component-manifest.json`));
      });

      it("re-analysis is byte-identical (SC-002 / determinism)", async () => {
        expect(await analyze(t)).toBe(await analyze(t));
      });

      it("golden is schema-valid and canonical", () => {
        const text = readFixture(`${t.dir}/agentic-component-manifest.json`);
        expect(validateManifest(JSON.parse(text)).valid).toBe(true);
        expect(checkCanonical(text).canonical).toBe(true);
      });

      it("acm.view.yml matches the Agent View emitter for the golden", () => {
        const view = agentViewFromText(readFixture(`${t.dir}/agentic-component-manifest.json`));
        expect(view.ok).toBe(true);
        expect(view.view).toBe(readFixture(`${t.dir}/acm.view.yml`));
      });

      // Inventory totality: one machine assertion per capability row.
      for (const row of ROWS[t.fw]) {
        it(`inventory ${row.id}`, () => {
          expect(row.check(goldenDecl(t.dir))).toBe(true);
        });
      }
    });
  }
});
