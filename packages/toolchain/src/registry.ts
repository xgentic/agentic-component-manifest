import type { ResponseType } from "./envelope.js";

/**
 * Declarative command registry — the single source the argv parser, the
 * dispatcher, and the capability manifest are all derived from (spec 004 R-01).
 * A command or option that exists but is undescribed is structurally impossible:
 * there is no second place to define one.
 *
 * The registry is pure data; handlers are bound by name in cli.ts and are never
 * serialized into the capability manifest.
 */

export interface ArgumentSpec {
  name: string;
  required: boolean;
  variadic?: boolean;
  description: string;
}

export interface OptionSpec {
  /** Display form, e.g. `--limit <n>`; the parser derives the bare name from it. */
  flag: string;
  type: "boolean" | "string" | "number" | "enum";
  choices?: string[];
  default?: string | number | boolean;
  repeatable?: boolean;
  description: string;
}

/** A global option plus the commands it applies to. */
export interface GlobalOptionSpec extends OptionSpec {
  appliesTo: string[];
}

export interface CommandSpec {
  name: string;
  description: string;
  arguments: ArgumentSpec[];
  options: OptionSpec[];
  /** True iff the command emits a typed envelope on stdout under `--json`. */
  jsonSupported: boolean;
  responseTypes: ResponseType[];
  examples: string[];
}

export const DETAIL_LEVELS = ["brief", "compact", "full"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

export const SEARCH_DOMAINS = ["component"] as const;

/**
 * Options shared by the discovery commands, with per-command applicability.
 * The pre-existing commands describe their own `--json`/`--check`/`--write`
 * in their entries — legacy `--json` means "diagnostics as JSON on stderr"
 * and is a different flag from the envelope-emitting global below.
 */
export const GLOBAL_OPTIONS: GlobalOptionSpec[] = [
  {
    flag: "--json",
    type: "boolean",
    description: "machine output: exactly one typed envelope on stdout, diagnostics on stderr",
    appliesTo: ["search", "component", "capabilities"],
  },
  {
    flag: "--detail <level>",
    type: "enum",
    choices: [...DETAIL_LEVELS],
    description:
      "detail level for list views (defaults: search results compact, component list brief, single-item views full)",
    appliesTo: ["search", "component"],
  },
  {
    flag: "--dense",
    type: "boolean",
    description:
      "token-frugal rendering: Agent View projection for component detail, one line per entry for list and search views",
    appliesTo: ["search", "component"],
  },
  {
    flag: "--project <dir>",
    type: "string",
    description: "target project whose Manifest Corpus is assembled (default: current directory)",
    appliesTo: ["search", "component"],
  },
  {
    flag: "--manifest <path>",
    type: "string",
    repeatable: true,
    description:
      "explicit manifest file added to the corpus; a failing explicit path is fatal (ACM-D-BAD-MANIFEST)",
    appliesTo: ["search", "component"],
  },
];

export const REGISTRY: CommandSpec[] = [
  {
    name: "search",
    description:
      "Find components across the discovered Manifest Corpus with free-text queries: ranked matches on names, Identity Facets, and controlled semantic terms above prose mentions, with typo-tolerant fuzzy matching.",
    arguments: [
      {
        name: "query",
        required: true,
        variadic: true,
        description: "free-text need, e.g. a component name, tag, or capability description",
      },
    ],
    options: [
      {
        flag: "--type <domain>",
        type: "enum",
        choices: [...SEARCH_DOMAINS],
        description: "restrict results to one domain (v1 corpus contains only components)",
      },
      {
        flag: "--limit <n>",
        type: "number",
        default: 20,
        description: "maximum number of results; the total match count is always reported",
      },
    ],
    jsonSupported: true,
    responseTypes: ["search"],
    examples: ["acm search button --json"],
  },
  {
    name: "component",
    description:
      "Print one component's full spec verbatim from its Manifest (given a name), or list every component in the corpus (given none).",
    arguments: [
      {
        name: "name",
        required: false,
        description: "component name; omit to list the whole corpus",
      },
    ],
    options: [
      {
        flag: "--from <package>",
        type: "string",
        description: "scope name resolution to one source package (cross-package disambiguator)",
      },
      {
        flag: "--module <path>",
        type: "string",
        description:
          "scope name resolution by module Identity Facet (intra-package disambiguator; combinable with --from)",
      },
    ],
    jsonSupported: true,
    responseTypes: ["component.list", "component.detail"],
    examples: ["acm component AcmeButton --from @acme/lit-buttons --json", "acm component"],
  },
  {
    name: "capabilities",
    description:
      "Describe the CLI itself: every command with arguments, options, machine-output support, response types, error codes, and examples — derived from the command registry.",
    arguments: [],
    options: [],
    jsonSupported: true,
    responseTypes: ["capabilities"],
    examples: ["acm capabilities --json"],
  },
  {
    name: "init",
    description:
      "Install the Discovery Skill into this project for its detected agent hosts, then report whether discovery will work here: the Manifest Corpus that was found, any Manifests excluded from it, and whether the acm binary is reachable.",
    arguments: [],
    options: [
      {
        flag: "--target <name>",
        type: "enum",
        // Gated against INIT_TARGETS in conformance; the registry stays pure data.
        choices: ["claude-skill", "agents-md", "rules"],
        repeatable: true,
        description:
          "agent host to install for; repeatable. Omitted: every host detected in the project (.claude/, AGENTS.md, .cursor/), defaulting to claude-skill",
      },
      {
        flag: "--dir <path>",
        type: "string",
        description: "project to install into (default: current directory)",
      },
      {
        flag: "--force",
        type: "boolean",
        description: "overwrite an existing skill file whose content differs",
      },
      {
        flag: "--dry-run",
        type: "boolean",
        description: "report what would be written, and write nothing",
      },
      {
        flag: "--json",
        type: "boolean",
        description:
          "render the install report as JSON on stdout (a plain report, not a discovery envelope)",
      },
    ],
    jsonSupported: false,
    responseTypes: [],
    examples: ["acm init", "acm init --target agents-md --dry-run"],
  },
  {
    name: "validate",
    description:
      "Validate a Manifest (Canonical JSON) or Authoring Input (YAML) against the schema, structural limits, and semantic rules.",
    arguments: [{ name: "file", required: true, description: "manifest or authoring-input file" }],
    options: [
      {
        flag: "--json",
        type: "boolean",
        description: "render diagnostics as JSON on stderr (no envelope; legacy flag)",
      },
    ],
    jsonSupported: false,
    responseTypes: [],
    // Examples are read by consumers of an installed CLI: they must name paths that
    // exist in a consuming project, never this repository's fixtures.
    examples: ["acm validate agentic-component-manifest.json"],
  },
  {
    name: "canonicalize",
    description: "Rewrite a Manifest into Canonical JSON, or verify it is already canonical.",
    arguments: [{ name: "file", required: true, description: "manifest file" }],
    options: [
      {
        flag: "--check",
        type: "boolean",
        description: "verify canonical form without writing; drift exits 3",
      },
    ],
    jsonSupported: false,
    responseTypes: [],
    examples: ["acm canonicalize agentic-component-manifest.json --check"],
  },
  {
    name: "compile",
    description: "Compile Authoring Input (YAML) to Canonical JSON on stdout.",
    arguments: [{ name: "file", required: true, description: "authoring-input YAML file" }],
    options: [
      {
        flag: "--json",
        type: "boolean",
        description: "render diagnostics as JSON on stderr (no envelope; legacy flag)",
      },
    ],
    jsonSupported: false,
    responseTypes: [],
    examples: ["acm compile acm.src.yml > agentic-component-manifest.json"],
  },
  {
    name: "agent-view",
    description: "Emit the one-way Agent View (YAML) projection of a canonical Manifest.",
    arguments: [{ name: "file", required: true, description: "canonical manifest file" }],
    options: [
      {
        flag: "--json",
        type: "boolean",
        description: "render diagnostics as JSON on stderr (no envelope; legacy flag)",
      },
    ],
    jsonSupported: false,
    responseTypes: [],
    examples: ["acm agent-view agentic-component-manifest.json > acm.view.yml"],
  },
  {
    name: "coverage",
    description:
      "Compute the witness coverage matrix across the four Paradigm Classes; gaps exit 4.",
    arguments: [],
    options: [
      {
        flag: "--json",
        type: "boolean",
        description: "render the coverage matrix as JSON on stdout (legacy flag)",
      },
    ],
    jsonSupported: false,
    responseTypes: [],
    examples: ["acm coverage --json"],
  },
  {
    name: "drift",
    description: "Check that generated artifacts are fresh; regenerate them with --write.",
    arguments: [],
    options: [
      {
        flag: "--write",
        type: "boolean",
        description: "regenerate stale generated artifacts in place",
      },
    ],
    jsonSupported: false,
    responseTypes: [],
    examples: ["acm drift", "acm drift --write"],
  },
  {
    name: "agent-docs",
    description:
      "Generate the Discovery Skill and its context-file variants from the capability manifest (steering layer, ADR 0004): corpus-agnostic, deterministic, byte-reproducible for a given toolchain version.",
    arguments: [],
    options: [
      {
        flag: "--target <name>",
        type: "enum",
        choices: ["claude-skill", "skills-package", "agents-md", "rules"],
        description: "print one generated target to stdout instead of checking freshness",
      },
      {
        flag: "--write",
        type: "boolean",
        description: "regenerate the discovery-skill generated artifacts in place",
      },
    ],
    jsonSupported: false,
    responseTypes: [],
    examples: ["acm agent-docs --target agents-md", "acm agent-docs --write"],
  },
];

/** Bare option name from its display flag: `--limit <n>` → `limit`. */
export function optionName(flag: string): string {
  const match = /^--([a-z][a-z-]*)/.exec(flag);
  if (!match) throw new Error(`malformed option flag in registry: ${flag}`);
  return match[1]!;
}

export function findCommand(name: string | undefined): CommandSpec | undefined {
  return REGISTRY.find((c) => c.name === name);
}

/** Global + command options applicable to one command (flags unique by construction). */
export function applicableOptions(spec: CommandSpec): OptionSpec[] {
  const globals = GLOBAL_OPTIONS.filter((o) => o.appliesTo.includes(spec.name)).map((option) => {
    const copy: OptionSpec & { appliesTo?: string[] } = { ...option };
    delete copy.appliesTo;
    return copy;
  });
  return [...globals, ...spec.options];
}
