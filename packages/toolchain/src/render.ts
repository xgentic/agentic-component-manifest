import { agentViewFromValue } from "./agent-view.js";
import type { SearchResultSet } from "./search.js";
import type { ComponentDetailData, ComponentListData } from "./component.js";
import type { CapabilityManifest } from "./capability.js";
import type { ErrorEnvelope } from "./envelope.js";
import type { InitReport } from "./init.js";
import type { ArgumentSpec, DetailLevel } from "./registry.js";

/**
 * Human and dense text rendering for the discovery surface. All
 * manifest-derived text passes through one sanitizer (NS-DATA-1, spec 004
 * R-07): C0/C1 controls (except LF and TAB) — including the raw ESC byte that
 * introduces CSI/OSC/DCS sequences — become U+FFFD, so the terminal never
 * interprets manifest content. Machine output is NOT sanitized: JSON string
 * escaping already preserves the bytes inertly.
 *
 * Exact spacing here is pinned by golden fixtures; the content obligations
 * (domain tag, verbatim one-liner, runnable follow-up) are contract.
 */

/** The one manifest-text sanitizer for human-readable rendering. */
export function sanitize(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "�");
}

/** First clause of a description: up to the first period, single line. */
function firstClause(text: string): string {
  const line = text.split("\n", 1)[0] ?? "";
  const period = line.indexOf(". ");
  if (period !== -1) return line.slice(0, period + 1);
  return line;
}

const INDENT = "  ";
const HANG = " ".repeat(15); // aligns under the name after `  [component]  `

export interface RenderOptions {
  detail: DetailLevel;
  dense: boolean;
}

/** The broaden-and-scan guidance line shown when a search returns nothing. */
function emptyGuidance(data: SearchResultSet): string {
  const next = data.followUps?.[0];
  return next !== undefined ? `No matches — list every component and pick by reading: ${next}` : "";
}

export function renderSearch(data: SearchResultSet, options: RenderOptions): string {
  if (options.dense) {
    if (data.results.length === 0) {
      const guidance = emptyGuidance(data);
      return `0 matches for "${sanitize(data.query)}"${guidance !== "" ? `\n${guidance}` : ""}\n`;
    }
    return (
      data.results
        .map(
          (r) =>
            `${sanitize(r.name)}  ${sanitize(r.source)}  ${sanitize(firstClause(r.description))}  → ${r.followUp}`,
        )
        .join("\n") + "\n"
    );
  }
  const shown = data.results.length;
  const header =
    shown < data.total
      ? `Results for "${sanitize(data.query)}" (showing ${shown} of ${data.total} matches):`
      : `Results for "${sanitize(data.query)}" (${data.total} match${data.total === 1 ? "" : "es"}):`;
  const blocks = data.results.map((r) => {
    const lines = [`${INDENT}[${r.domain}]  ${sanitize(r.name)}`];
    if (options.detail !== "brief") lines.push(`${HANG}${sanitize(r.description)}`);
    if (options.detail === "full") {
      const reasons = (r.matches ?? []).map((m) => `${m.tier} "${sanitize(m.token)}"`).join(", ");
      lines.push(`${HANG}from ${sanitize(r.source)} — ${reasons} — score ${r.score ?? 0}`);
    }
    lines.push(`${HANG}→ ${r.followUp}`);
    return lines.join("\n");
  });
  const trailer = data.results.length === 0 ? [emptyGuidance(data)].filter((l) => l !== "") : [];
  return [header, "", ...blocks, ...trailer].join("\n") + "\n";
}

export function renderComponentList(data: ComponentListData, options: RenderOptions): string {
  if (options.dense) {
    // Dense list is the tier-3 retrieval floor: name, tag, package, one-liner —
    // everything the agent needs to pick the right component by reading.
    const lines = data.packages.flatMap((pkg) =>
      pkg.components.map((c) =>
        [
          sanitize(c.name),
          c.tagName !== undefined ? sanitize(c.tagName) : "",
          sanitize(pkg.package),
          c.description !== undefined && c.description !== ""
            ? sanitize(firstClause(c.description))
            : "",
        ]
          .filter((field) => field !== "")
          .join("  "),
      ),
    );
    return lines.join("\n") + "\n";
  }
  const header = `${data.total} component${data.total === 1 ? "" : "s"} in ${data.packages.length} package${
    data.packages.length === 1 ? "" : "s"
  }:`;
  const blocks = data.packages.map((pkg) => {
    const lines = [sanitize(pkg.package)];
    for (const c of pkg.components) {
      if (options.detail === "full" && c.entry !== undefined) {
        lines.push(
          `${INDENT}${sanitize(c.name)}`,
          ...renderEntrySections(c.entry).map((l) => (l === "" ? l : `${INDENT}${l}`)),
        );
      } else if (options.detail === "compact" && c.description !== undefined) {
        lines.push(`${INDENT}${sanitize(c.name)} — ${sanitize(c.description)}`);
      } else {
        lines.push(`${INDENT}${sanitize(c.name)}`);
      }
    }
    return lines.join("\n");
  });
  return [header, "", ...blocks].join("\n") + "\n";
}

/**
 * The dense projection of a Manifest entry: everywhere a type expression
 * carries both forms, the `structured` tree is dropped in favor of the
 * equivalent `raw` string — same information, token-frugal form. The result
 * still goes through the one Agent View emitter (one-way, ADR 0001); the
 * SC-008 size gate compares it against the entry's formatted Canonical JSON,
 * mirroring the repo's Agent View token-economy baseline.
 */
export function denseEntryProjection(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(denseEntryProjection);
  if (node !== null && typeof node === "object") {
    const source = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      if (
        key === "structured" &&
        value !== null &&
        typeof value === "object" &&
        typeof source.raw === "string"
      )
        continue;
      out[key] = denseEntryProjection(value);
    }
    return out;
  }
  return node;
}

export function renderComponentDetail(data: ComponentDetailData, options: RenderOptions): string {
  if (options.dense) return agentViewFromValue(denseEntryProjection(data.entry));
  const origin =
    data.source.package !== undefined
      ? `${data.source.package} · ${data.source.path}`
      : data.source.path;
  const header = `${sanitize(data.name)}  (${sanitize(origin)})`;
  if (options.detail === "brief") return header + "\n";
  const entry = data.entry as Record<string, unknown>;
  const description = typeof entry.description === "string" ? entry.description : undefined;
  if (options.detail === "compact") {
    return (
      [
        header,
        ...(description !== undefined
          ? ["", `${INDENT}${sanitize(firstClause(description))}`]
          : []),
      ].join("\n") + "\n"
    );
  }
  return [header, ...renderEntrySections(data.entry)].join("\n") + "\n";
}

/** Section-by-section rendering of one Manifest entry; unpopulated sections are omitted. */
function renderEntrySections(entryValue: unknown): string[] {
  const entry = entryValue as any;
  const lines: string[] = [];
  const section = (title: string, body: string[]): void => {
    if (body.length === 0) return;
    lines.push("", `${INDENT}${title}`, ...body.map((l) => `${INDENT}${INDENT}${l}`));
  };

  if (typeof entry.description === "string" && entry.description !== "")
    lines.push("", `${INDENT}${sanitize(entry.description)}`);

  if (entry.identity !== undefined && entry.identity !== null) {
    const pairs = Object.entries(entry.identity as Record<string, unknown>).filter(
      ([, v]) => typeof v === "string",
    );
    const width = Math.max(...pairs.map(([k]) => k.length), 0);
    section(
      "identity",
      pairs.map(([k, v]) => `${k.padEnd(width)}  ${sanitize(String(v))}`),
    );
  }

  section(
    "inputs",
    (Array.isArray(entry.inputs) ? entry.inputs : []).flatMap((input: any) => {
      const type = input.type?.raw !== undefined ? `: ${sanitize(String(input.type.raw))}` : "";
      const dflt = input.default !== undefined ? ` = ${sanitize(String(input.default))}` : "";
      const reflects = input.reflects === true ? "  [reflects]" : "";
      return [
        `${sanitize(String(input.name))}${type}${dflt}${reflects}`,
        ...(typeof input.description === "string"
          ? [`${INDENT}${sanitize(input.description)}`]
          : []),
      ];
    }),
  );

  section(
    "events",
    (Array.isArray(entry.events) ? entry.events : []).flatMap((event: any) => {
      const payload =
        event.payload?.raw !== undefined ? `: ${sanitize(String(event.payload.raw))}` : "";
      return [
        `${sanitize(String(event.name))}${payload}`,
        ...(typeof event.description === "string"
          ? [`${INDENT}${sanitize(event.description)}`]
          : []),
      ];
    }),
  );

  section(
    "slots",
    (Array.isArray(entry.slots) ? entry.slots : []).flatMap((slot: any) => [
      typeof slot.name === "string" ? sanitize(slot.name) : "(default)",
      ...(typeof slot.description === "string" ? [`${INDENT}${sanitize(slot.description)}`] : []),
    ]),
  );

  section(
    "methods",
    (Array.isArray(entry.methods) ? entry.methods : []).flatMap((method: any) => {
      const params = (Array.isArray(method.parameters) ? method.parameters : [])
        .map(
          (p: any) =>
            `${sanitize(String(p.name))}${p.type?.raw !== undefined ? `: ${sanitize(String(p.type.raw))}` : ""}`,
        )
        .join(", ");
      const ret =
        method.return?.raw !== undefined ? `: ${sanitize(String(method.return.raw))}` : "";
      return [
        `${sanitize(String(method.name))}(${params})${ret}`,
        ...(typeof method.description === "string"
          ? [`${INDENT}${sanitize(method.description)}`]
          : []),
      ];
    }),
  );

  section(
    "css properties",
    (Array.isArray(entry.cssProperties) ? entry.cssProperties : []).flatMap((prop: any) => {
      const syntax = prop.syntax !== undefined ? `: ${sanitize(String(prop.syntax))}` : "";
      const dflt = prop.default !== undefined ? ` = ${sanitize(String(prop.default))}` : "";
      return [
        `${sanitize(String(prop.name))}${syntax}${dflt}`,
        ...(typeof prop.description === "string" ? [`${INDENT}${sanitize(prop.description)}`] : []),
      ];
    }),
  );

  section(
    "css parts",
    (Array.isArray(entry.cssParts) ? entry.cssParts : []).flatMap((part: any) => [
      sanitize(String(part.name)),
      ...(typeof part.description === "string" ? [`${INDENT}${sanitize(part.description)}`] : []),
    ]),
  );

  if (entry.semantics !== undefined && entry.semantics !== null) {
    const term = typeof entry.semantics.term === "string" ? entry.semantics.term : "";
    const notes =
      typeof entry.semantics.notes === "string" ? ` — ${sanitize(entry.semantics.notes)}` : "";
    if (term !== "") section("semantics", [`${sanitize(term)}${notes}`]);
  }

  section(
    "examples",
    (Array.isArray(entry.examples) ? entry.examples : []).flatMap((example: any) => {
      const title = typeof example.title === "string" ? sanitize(example.title) : "(untitled)";
      const lang = typeof example.lang === "string" ? ` (${sanitize(example.lang)})` : "";
      const source =
        typeof example.source === "string"
          ? sanitize(example.source)
              .split("\n")
              .map((l) => `${INDENT}${l}`)
          : [];
      return [`${title}${lang}`, ...source];
    }),
  );

  return lines;
}

function usageLine(name: string, args: ArgumentSpec[]): string {
  const rendered = args
    .map((a) => {
      const label = a.variadic === true ? `${a.name}…` : a.name;
      return a.required ? ` <${label}>` : ` [${label}]`;
    })
    .join("");
  return `${name}${rendered}`;
}

export function renderCapabilities(data: CapabilityManifest): string {
  const lines: string[] = [`acm ${data.version} — ${data.description}`, "", "commands:"];
  const usages = data.commands.map((c) => usageLine(c.name, c.arguments));
  const width = Math.max(...usages.map((u) => u.length));
  data.commands.forEach((command, i) => {
    lines.push(`${INDENT}${usages[i]!.padEnd(width)}  ${command.description}`);
    for (const opt of command.options)
      lines.push(
        `${INDENT}${INDENT}${opt.flag.padEnd(Math.max(width - 2, 0))}  ${opt.description}`,
      );
  });
  lines.push("", "global options:");
  for (const opt of data.globalOptions)
    lines.push(`${INDENT}${opt.flag}  (${opt.appliesTo.join(", ")})  ${opt.description}`);
  lines.push("", "error codes:");
  const codeWidth = Math.max(...data.errorCodes.map((e) => e.code.length));
  for (const entry of data.errorCodes)
    lines.push(`${INDENT}${entry.code.padEnd(codeWidth)}  ${entry.description}`);
  return lines.join("\n") + "\n";
}

/**
 * `acm init`'s install summary and corpus preflight. Everything project-derived
 * (package names, manifest paths) is sanitized: a dependency directory or a project's
 * `package.json` name is no more trusted than Manifest text (NS-DATA-1).
 */
export function renderInit(report: InitReport): string {
  const lines: string[] = [];
  const mode = report.dryRun ? " (dry run — nothing written)" : "";
  lines.push(`acm init — Discovery Skill → ${sanitize(report.project)}${mode}`, "");

  for (const install of report.installs) {
    const suffix = install.reason !== undefined ? ` — ${install.reason}` : "";
    lines.push(`${INDENT}${install.action.padEnd(8)}${install.path}${suffix}`);
  }

  lines.push("", "corpus preflight:");
  const { manifests, components, sources, diagnostics } = report.preflight;
  if (manifests === 0) {
    lines.push(
      `${INDENT}no ACM Manifests found — discovery will report ACM-D-EMPTY-CORPUS here.`,
      `${INDENT}Install a component library that ships one, or derive a Manifest for this`,
      `${INDENT}project's own components with \`acm-analyzer analyze --framework <name>\`.`,
    );
  } else {
    lines.push(
      `${INDENT}${manifests} Manifest${manifests === 1 ? "" : "s"}, ` +
        `${components} component${components === 1 ? "" : "s"}:`,
    );
    for (const source of sources)
      lines.push(`${INDENT}${INDENT}${sanitize(source.name)}  (${source.components})`);
  }
  for (const diagnostic of diagnostics)
    lines.push(`${INDENT}${diagnostic.ruleId}: ${sanitize(diagnostic.path)} — excluded`);

  if (!report.cliResolvable) {
    lines.push(
      "",
      `${INDENT}\`acm\` is not resolvable from this project — the skill's commands will fail.`,
      `${INDENT}Add it: \`npm install --save-dev @acm/toolchain\`.`,
    );
  }
  return lines.join("\n") + "\n";
}

export function renderError(envelope: ErrorEnvelope): string {
  const lines = [`Error: ${sanitize(envelope.error)} (${envelope.code})`];
  if (envelope.suggestions !== undefined && envelope.suggestions.length > 0) {
    lines.push(
      envelope.code === "ACM-D-AMBIGUOUS-COMPONENT"
        ? `${INDENT}candidates:`
        : `${INDENT}did you mean:`,
    );
    for (const s of envelope.suggestions) {
      const source = s.source !== undefined ? `  ${sanitize(s.source)}` : "";
      const followUp = s.followUp !== undefined ? `  → ${s.followUp}` : "";
      lines.push(`${INDENT}${INDENT}${sanitize(s.name)}${source}${followUp}`);
    }
  }
  return lines.join("\n") + "\n";
}
