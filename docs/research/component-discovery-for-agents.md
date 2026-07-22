# How the industry exposes design-system components to AI agents — and what ACM should do

**Status**: Research report (informative, non-normative)
**Date**: 2026-07-21
**Feeds into**: [specs/004-component-discovery-cli](../../specs/004-component-discovery-cli/spec.md) and the planned follow-up agent-skill feature

## Question

How do major technology companies and design-system teams make their UI components
discoverable and searchable — for human developers and, increasingly, for AI coding
agents — and what should ACM adopt for its agent-consumption layer: a skill + CLI
"find component" flow, an MCP server, static context files, or a combination?

## Method and evidence tiers

This report was produced by a multi-agent deep-research run: 5 parallel search angles
(agent-facing integrations, enterprise design-system tooling, machine-readable metadata
standards, static context files/skills, practitioner trade-offs), ~24 primary sources
fetched and mined for falsifiable claims, and a 3-vote adversarial verification pass.
The run was interrupted before verification completed, so claims fall into three tiers,
marked throughout:

- **[verified]** — survived 3-vote adversarial verification (17 claims; 1 claim was
  killed and is excluded, 1 was softened after a partial refutation).
- **[primary]** — extracted verbatim from a first-party source with quote and URL, not
  yet adversarially voted.
- **[background]** — the authoring model's knowledge, not confirmed by a fetched
  source in this run. Verify before relying on it.

"Not surfaced" below means this research run found no public agent-facing story — it is
a finding about public visibility, not proof of absence.

---

## 1. Per-organization findings

### Organizations with a first-party agent-facing story (evidence-backed)

#### Meta — Astryx (the reference model for spec 004) *(added 2026-07-21, follow-up pass)*

Meta open-sourced **Astryx** (June 2026) — its largest internal design system: 150+
React components, seven themes, MIT — explicitly built "agent ready". [primary]
(https://github.com/facebook/astryx, https://astryx.atmeta.com/docs/cli,
https://astryx.atmeta.com/docs/working-with-ai)

- **CLI as the single engine** (`@astryxdesign/cli`): `search` (one ranked
  cross-domain result set over components, hooks, docs, templates), `component`
  (list or full docs/props/examples/source), `template`, `docs`, `hook`, `swizzle`,
  `upgrade` (codemods), `doctor`, `theme build`. Global flags: `--json` (typed
  envelope `{ type, data }`), `--detail brief|compact|full`, `--dense`
  (token-efficient format for agents), `--lang en|zh|dense` — dense as a locale.
- **Self-description**: `astryx manifest --json` returns every command, argument,
  flag (types, choices, defaults), JSON support, and response-type discriminators.
- **Stable machine contract**: append-only error codes (`ERR_UNKNOWN_COMPONENT`,
  `ERR_CORE_NOT_FOUND`…), response types (`component.detail`, `search`…), and an
  explicit "never branch on human-readable text" rule.
- **Programmatic parity**: `@astryxdesign/cli/api` typed functions plus
  `@astryxdesign/cli/json` consumer utilities (`parseResponse`, `isError`,
  `assertResponse`).
- **The steering layer is generated, not hand-written**: `npx astryx init
  --features agents` emits per-ecosystem context files — `CLAUDE.md`,
  `.cursorrules`, `AGENTS.md` — containing a component index, behavioral rules ("no
  raw divs, no `style={{}}`, use tokens not magic values"), and a CLI quick
  reference, **pulled from the installed version**. Freshness by construction:
  regenerate on upgrade, and the steering text can never describe a surface the
  installed CLI doesn't have.
- **Prescribed agent workflow** (pattern-first): `template --list` → `template
  <name> --skeleton` → `component <Name>`.
- **MCP as a minimal remote bridge**: a hosted server (astryx.atmeta.com/mcp) with
  exactly **two tools** — `search(query)` and `get(name)` — the same surface as the
  CLI.

Astryx confirms every layer of the convergent architecture below and adds one move
nobody else surveyed makes: *deriving the agent context files from the CLI's own
self-description*, which turns drift prevention from a CI gate into a structural
impossibility. See ADR 0004.

#### Alibaba — Ant Design (the most complete stack found)

Ant Design is the clearest existing model of a *layered* agent-consumption story, and
the layering order matters: **CLI first, everything else derived from it**.

- **Local-first CLI**: `@ant-design/cli` (`antd`) bundles *all* component metadata
  locally — every prop, design token, demo, and changelog entry for antd v3–v6 —
  queryable offline in milliseconds via `antd list`, `antd info Button`, `antd doc
  Button`, `antd token DatePicker`. [primary]
  (https://ant.design/docs/react/for-agents/)
- **MCP as a CLI subcommand, not a separate service**: `antd mcp` (from
  `@ant-design/cli` v6.3.5) starts an MCP server exposing 8 tools + 2 prompts —
  `antd_list`, `antd_info`, `antd_doc`, `antd_demo`, `antd_token`, `antd_semantic`,
  `antd_changelog` — the full discovery pipeline as narrow list/get tools. [primary]
  (https://ant.design/docs/react/mcp/)
- **Installable agent skill**: `npx skills add ant-design/ant-design-cli`, with an
  explicit instruction that agents read the for-agents page and the skill's SKILL.md
  before writing any code, including deprecation warnings. **[verified]** — live-fetch
  confirmed the SKILL.md exists in the ant-design GitHub org and covers deprecation
  linting (`antd lint ./src --only deprecated`).
- **Tiered static context files**: `llms.txt` (lightweight navigation index),
  `llms-full.txt` (complete docs), `llms-semantic.md` (DOM structure + usage
  patterns), `design.md` (AI-oriented design language), plus **per-component raw
  markdown** by appending `.md` to any component URL
  (`https://ant.design/components/button.md`) — enabling on-demand per-component
  fetching instead of bulk ingestion. [primary] (https://ant.design/docs/react/llms/)
- The documented IDE integration path for the static files is context injection
  (Cursor `@Docs` / `.cursor/rules`, Claude Code `CLAUDE.md` / `/memory`) — i.e. the
  static tier is pointer-based, not search-based. [primary]

A separate *community* MCP server (`zhixiaoqiang/antd-components-mcp`, 244 stars)
predates the official one; its stated purpose is "reducing Ant Design component code
generation hallucinations". Architecturally notable: it does **not** fetch live docs —
it ships a pre-processed, versioned static corpus extracted from the antd repo by a CLI
command, with the MCP layer as a thin query surface over that index, and bundles system
prompts specifically to "reduce repetitive tool calls". [primary]
(https://github.com/zhixiaoqiang/antd-components-mcp) — structurally this is an Agent
View + query layer, independently reinvented.

#### shadcn/ui — the registry + CLI + MCP reference pattern

- A formal, published **JSON Schema for component registries**
  (`https://ui.shadcn.com/schema/registry.json`, items per
  `registry-item.json`: name, type, title, description, dependencies,
  registryDependencies, files). Registries are composable via `include` and are
  **build artifacts served statically** (`shadcn build` flattens them) — not a live
  service. [primary] (https://ui.shadcn.com/docs/registry/registry-json)
- CLI 3.0 added discovery commands — namespaced registries plus `search` / `view` /
  `add` — and an MCP server layered on top. [primary]
  (https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp)
- The MCP server is explicitly "a bridge between your AI assistant, component
  registries and the shadcn CLI" — a thin wrapper over the same CLI/registry substrate,
  exposing the discovery triad: browse, search by name/functionality, install via
  natural language. Early builds exposed exactly four tools (`init`, `get_items`,
  `get_item`, `add_item`). [primary] (https://ui.shadcn.com/docs/mcp)
- Any shadcn-compatible registry — including private company design systems — gets the
  same agent flow for free (`REGISTRY_URL` env var). [primary]
- **Critical field observation** (Marmelab, hands-on): *MCP tool availability alone did
  not make the agent use the registry* — the LLM frequently built components from
  training knowledge without calling the tools, until rules files
  (`.cursor/rules/registry.mdc`) steered it. The rules + MCP combination is what
  improved output quality. [primary]
  (https://marmelab.com/blog/2025/08/19/shadcn-admin-kit-mcp.html)

#### Storybook — derived manifests as the agent-facing index

- Storybook ships machine-readable JSON **component manifests** "designed for AI
  agents", served statically (`/manifests/components.json`) from both dev server and
  built output — generated by **static analysis** of CSF stories plus prop extraction
  (react-docgen / react-docgen-typescript), not hand-authored. [primary]
  (https://storybook.js.org/docs/ai/manifests)
- It ships **both** the static manifests **and** an MCP server (stories are the
  retrieval unit for usage examples); both are preview-status and React-only — i.e.
  a major catalog vendor treats static files and MCP as complementary, and
  framework-agnostic agent support is unsolved there (ACM's exact gap). [primary]
- Authoring guidance: enrich components/props with JSDoc because richer extracted
  metadata "will help agents use them more effectively"; curate what agents see via
  `manifest` / `!manifest` tags (keep anti-pattern demos and deprecated components out
  of agent context). [primary] (https://storybook.js.org/docs/ai/best-practices)

#### Figma — Code Connect + Dev Mode MCP (design-to-code retrieval)

- The Dev Mode MCP server pushes component/style/variable context into agents
  (Copilot, Cursor, Windsurf, Claude Code); with **Code Connect** mappings it hands the
  agent "the exact path to the code file" of the team's real component — steering
  agents to *reuse* existing components instead of regenerating lookalikes.
  **[verified]** (https://www.figma.com/blog/introducing-figma-mcp-server/)
- Figma's stated position: structured *references* to components/variables/styles make
  generated code more precise and "reduce LLM token usage" versus raw context dumps.
  [primary] — direct support for ACM's Agent View thesis.
- Figma **combines** approaches: the MCP server can also scan a codebase and emit a
  structured static rules file (tokens, component libraries, naming conventions).
  [primary] (https://www.figma.com/blog/design-systems-ai-mcp/)
- Launch surface was deliberately tiny: three selection-scoped tools (code, images,
  variable definitions) — narrow tool calls, not broad catalog search. [primary]

#### IBM — Carbon

Carbon ships **Carbon MCP** (public preview): agents query components, tokens, usage
guidelines, and code examples across Carbon's React and Web Components libraries.
[primary, search-level] (https://carbondesignsystem.com/developing/carbon-mcp/overview/)

#### Salesforce — Lightning / SLDS

Salesforce's agent story runs through the **Salesforce DX MCP Server**, whose tool
suite covers LWC component generation, SLDS styling, accessibility, and tests —
an enterprise that chose MCP tooling as the primary agent channel. [primary,
search-level]
(https://developer.salesforce.com/blogs/2025/10/vibe-code-lightning-web-components-with-salesforce-dx-mcp)

#### Nordhealth — Nord (the static-files-only counterexample)

- Two-tier llms.txt, explicitly budgeted: `/llms.txt` ≈ **5K tokens** (index of all
  components with links), `/llms-full.txt` ≈ **1M+ tokens**; guidance says start small,
  use full only with 200K+ context windows. **[verified by live fetch]**
  (https://nordhealth.design/ai/llms-txt)
- Per-component drill-down: each index entry links to standalone raw markdown
  (`/raw/components/accordion.md`) — read the index, fetch only what you need.
  [primary]
- **No MCP, no CLI, no search tool at all** — integration is editor context references
  and rules files. Documented friction: the `@`-reference must be typed by hand;
  copy-paste breaks it. [primary] — static-only has real UX fragility.

#### Vendor platforms and the wider convergence

- **Supernova** (commercial design-system platform) productizes an MCP server over
  documented components **plus** a generated llms.txt fallback for when MCP isn't
  available. [primary, search-level] (https://learn.supernova.io/latest/design-systems/features/mcp-for-design-system-LIHAMhjr-LIHAMhjr)
- **Nuxt UI** ships structured llms.txt/llms-full.txt "optimized for AI consumption".
  [search-level] (https://ui.nuxt.com/docs/getting-started/ai/llms-txt)
- **txtskills** converts any llms.txt into an installable SKILL.md for Claude Code,
  Cursor, Windsurf, Copilot, etc. — the community is actively bridging static files
  into the skills mechanism (early-stage: single-digit stars). [primary]
  (https://github.com/hk-vk/txtskills)
- **Custom Elements Manifest (CEM)** — the standard ACM descends from — had
  *component-catalog search* as an explicit 2021 design goal ("reliably detect NPM
  packages that contain custom elements … displayed on a custom elements catalog"),
  with schema input from Adobe, Ionic/Stencil, Google, Open Web Components, and ING,
  and an analyzer-derives-manifest pipeline with framework plugins (Lit, FAST, Stencil,
  Catalyst). [primary] (https://custom-elements-manifest.open-wc.org/blog/intro/)

### Organizations with background-knowledge-only stories (verify before citing)

- **Shopify (Polaris)** — [background] Shopify ships an official dev MCP server
  (`@shopify/dev-mcp`) whose docs-search tools cover Polaris; not surfaced by this run.
- **Google (Angular)** — [background] the Angular CLI gained an MCP server
  (`ng mcp` / `@angular/cli`) with documentation search; angular.dev publishes
  llms.txt. Material 3 itself: nothing found.
- **Microsoft (Fluent)** — [background] Microsoft Learn ships a docs MCP server;
  Fluent-specific community MCPs exist. No first-party Fluent component-discovery
  agent tool surfaced.
- **Amazon (AWS)** — [background] awslabs publishes a large family of MCP servers
  (docs, CDK, etc.), but nothing Cloudscape-specific surfaced.
- **SAP (UI5)** — [background] UI5 Web Components publish CEM
  (`custom-elements.json`) metadata; an official UI5 MCP server has been announced.
- **Vercel** — [background] the v0 platform generates UI against shadcn-style
  registries; Vercel publishes docs MCP/llms.txt. Its component story effectively *is*
  the shadcn registry pattern above.

### Not surfaced — no public agent-facing component-discovery story found in this run

Oracle (Redwood/JET), Adobe Spectrum (CEM-adjacent metadata
exists, no agent tool), Atlassian ADS, GitHub Primer, Uber Base, Airbnb DLS (internal
visual search research predates the agent era), Pinterest Gestalt, Twilio Paste,
ServiceNow, Workday Canvas, eBay (Skin/MIND), JPMorgan Salt, Goldman Sachs, VMware/
Broadcom Clarity (publishes CEM metadata as web components, but no agent tool),
Elastic EUI, Red Hat PatternFly, ByteDance (Arco/Semi — Semi's design-to-code tooling
is designer-facing, not agent-facing).

That roughly two-thirds of big-name design systems have **no** public agent story is
itself the finding: the field is early, the patterns are being set *now* by Meta
(Astryx), Ant Design, shadcn, Storybook, Figma, IBM, and Salesforce — and a
spec-first project like ACM is early enough to matter.

---

## 2. The retrieval-mechanism comparison

### The token-cost evidence (why this decision matters)

- Popular MCP servers consume **~10K–30K tokens of context from tool definitions
  alone** before any call: measured — Linear 23 tools ≈ 12,935 tokens, JetBrains 20 ≈
  12,252, Playwright 21 ≈ 9,804; GitHub's server ≈ 30K ("I had to disable it").
  [primary, HN practitioner measurements]
  (https://news.ycombinator.com/item?id=45619537)
- An independent measurement put GitHub's 93-tool server at ~55K tokens at init, with
  a modest 3-server stack burning 72% of a 200K window before the first user query.
  [search-level] (https://dev.to/kenimo49/your-mcp-server-eats-55000-tokens-before-your-agent-says-a-word-i-measured-the-real-cost-19l8)
- **Skills** load a few dozen tokens of YAML-frontmatter description at session start
  and pull the full body only when relevant (progressive disclosure). Practitioners
  report replacing MCP servers with CLI scripts because the servers passively consumed
  ~20% of context "just by being there". [primary, HN]
- The CLI counterargument in one line: "The agent can call `--help` when it needs it.
  Just imagine a kubectl MCP with all the commands as individual tools." [primary, HN]
- The honest pro-MCP concession (Simon Willison): MCP works **without a sandboxed
  shell** and works **with much less capable models**; skills/CLIs add no new
  capability beyond context efficiency for systems that can already run commands.
  [primary, HN]
- On search modality: Augment's SWE-bench experience — lexical/agentic search (grep,
  file reads, symbols) beat embedding search for code-shaped corpora; embeddings add
  indexing infrastructure, go stale on every commit, and lose precision on exact
  identifiers. [search-level]
  (https://jxnl.co/writing/2025/09/11/why-grep-beat-embeddings-in-our-swe-bench-agent-lessons-from-augment/)
- Static-pointer hygiene: keep **pointers** in rules files and fetch docs on demand;
  pasting full docs into rules makes every session pay for them. Tiered
  index-then-escalate is the recommended read strategy. [primary]
  (https://dev.to/toyama0919/using-llmstxt-with-cursor-and-claude-code-a-concrete-playbook-4jln)

### Trade-off matrix

| Mechanism | Resident token cost | Freshness | Hallucination resistance | Cross-agent portability | Works offline / air-gapped | Needs shell? | Who does it |
|---|---|---|---|---|---|---|---|
| Docs site + human search | none | live | low (agent scrapes or guesses) | n/a | no | no | everyone (baseline) |
| llms.txt tiers + per-component .md | ~0 resident; pay-per-fetch | live | medium (verbatim docs, but pull-based — agent may not fetch) | high (plain HTTP) | no | no | Ant Design, Nord, Nuxt UI, Supernova fallback |
| Derived machine manifest (CEM, Storybook manifests, registry.json) | ~0 (static artifact) | as fresh as the build | high (derived from source, curated) | high (plain JSON) | yes | no | Storybook, shadcn, CEM ecosystem, **ACM itself** |
| CLI lookup tool | ~0 until invoked; `--help` on demand | as fresh as installed package | high (typed output, exact data) | high (any agent with a shell) | **yes** | yes | Ant Design (`antd`), shadcn CLI 3, **ACM spec 004** |
| Skill wrapping a CLI | few dozen tokens resident | follows the CLI | high (adds *when/how* guidance — fixes the "agent ignores the tool" failure) | high and growing (skills format spreading beyond Claude) | yes | yes | Ant Design skill, txtskills pattern |
| MCP server | ~500–1,400 tokens/tool, 10K–55K/server resident | live | high (tool-mediated) | high (MCP is the cross-client standard Figma chose) | depends | **no** | Figma, IBM Carbon, Salesforce DX, Storybook, shadcn, antd (`antd mcp`) |
| Embedding/semantic search | index infra + staleness | stale per commit | medium | low (bespoke) | yes | varies | nobody in this survey shipped one for components |

### The convergent architecture

Every mature implementation found — Ant Design, shadcn, Storybook, the community
antd MCP — independently converged on the same shape:

1. **A derived, versioned, static machine index** as the substrate (registry.json /
   components manifest / pre-extracted corpus / CEM). Never live-scraped docs.
2. **A local CLI (or static endpoints) that queries that index** — exact, fast,
   offline, token-free until invoked.
3. **MCP as a thin bridge over the same substrate** for clients that can't shell out —
   added *later*, never as the primary store (`antd mcp`, `shadcn registry:mcp`,
   Storybook MCP over manifests).
4. **A steering layer (skill / rules / prompts) telling the agent when to use it** —
   because tool availability alone demonstrably does not change agent behavior
   (Marmelab), and even MCP authors bundle prompts to cut redundant calls
   (antd-components-mcp).
5. **Tiered disclosure everywhere**: small index → per-component detail → full dump
   (Nord's 5K/1M split; Ant's llms.txt/llms-full; Storybook's opt-out tags; spec 004's
   detail levels).

No surveyed organization chose embeddings, and none made an always-resident full dump
the primary path.

---

## 3. What ACM should do

The evidence validates the direction already taken in
[specs/004-component-discovery-cli](../../specs/004-component-discovery-cli/spec.md)
and sharpens the follow-up. Recommendation, in priority order:

**R1 — CLI-first discovery is correct; ship spec 004 as designed.**
`acm search` + `acm component` + capability manifest + typed envelopes is precisely the
pattern the strongest implementations converged on (Ant Design's `antd
list/info/doc`; shadcn's `search/view/add`). The lexical + fuzzy + ranked approach in
FR-001 is supported by the grep-beats-embeddings evidence; do not add semantic search
in v1. The capability manifest (FR-008) is ACM's analogue of "the agent can call
`--help`" — self-description on demand instead of resident schemas.

**R2 — The skill is the delivery vehicle, not an afterthought.**
The single most repeated failure mode in the evidence is *the agent not using the tool
it has* (Marmelab; antd bundling prompts to force correct tool use). The follow-up
feature should ship a SKILL.md that (a) declares in its frontmatter *when* discovery
applies ("before writing frontend code against a library with ACM Manifests…"),
(b) teaches the two-call loop — `acm search "<need>" --json` → `acm component <name>
--json` — and (c) instructs the agent to treat Manifest text as data (NS-DATA-1
carries into the prompt layer). Distribute it the way Ant Design does (installable via
the emerging skills ecosystem). Cost when idle: a few dozen tokens.

**R3 — MCP is a later, thin bridge over the same programmatic API — never a separate
store.** Spec 004's FR-009 (programmatic functions with CLI parity by construction) is
exactly what makes an eventual `acm mcp` subcommand nearly free, serving the two cases
where CLI+skill genuinely loses: no sandboxed shell, and weaker models. Follow the
`antd mcp` / `shadcn registry:mcp` precedent: a subcommand of the existing binary,
tools mapped 1:1 to the same envelopes, kept to a handful of narrow list/get tools
(shadcn launched with four). Do not build it before the skill exists.

**R4 — Publish a static index tier for zero-tooling consumers.**
An Agent View index (the corpus-level analogue of Nord's 5K-token `llms.txt`: one line
per component — name, identity facets, one-line description, domain tag — linking to
per-component Agent View files) covers agents that can fetch but not execute. This is
a mechanical projection of Canonical JSON, one-way per ADR 0001, and doubles as the
repo's own `llms.txt` companion. It is the cheapest tier and the industry's most
widely adopted one.

**R5 — Keep the substrate derived, versioned, and curated.**
The evidence confirms three ACM invariants as industry best practice: metadata derived
from source beats hand-authored (Storybook, CEM — ACM's analyzer + Provenance Tiers);
description quality is an agent-effectiveness lever (Storybook's JSDoc guidance — ACM's
`description` mandate, ACM-M-DESC); curation of what agents see matters (Storybook's
`!manifest` tag — a possible future ACM extension for excluding deprecated components
from search results, cf. antd's deprecation-lint skill step).

**Anti-recommendations**: no embedding index in v1 (staleness + infra, zero industry
uptake for components); no standalone always-on MCP as the primary interface (10K–55K
resident tokens contradicts ACM's token-frugality premise); no live-docs scraping
(every mature system pre-extracts to a versioned corpus); no reliance on static files
*alone* (Nord shows the UX fragility, and pull-based context is routinely ignored).

### Layered target architecture

```
Canonical JSON Manifests            (source of truth, spec'd today)
        │
        ├── Agent View (per component)          — token-frugal detail    [exists]
        ├── Agent View corpus index             — R4, static tier        [new]
        │
        └── acm search / acm component / capabilities                    [spec 004]
                │            (typed envelopes, stable ACM-D-* codes)
                ├── SKILL.md — when + how to call, NS-DATA-1 posture     [R2, next]
                └── acm mcp — thin bridge, same envelopes                [R3, later]
```

---

## 4. Sources

First-party / primary:

- https://astryx.atmeta.com/docs/cli · https://astryx.atmeta.com/docs/working-with-ai · https://github.com/facebook/astryx
- https://ant.design/docs/react/for-agents/ · https://ant.design/docs/react/mcp/ · https://ant.design/docs/react/llms/
- https://ui.shadcn.com/docs/registry/registry-json · https://ui.shadcn.com/docs/mcp · https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp
- https://storybook.js.org/docs/ai/manifests · https://storybook.js.org/docs/ai/best-practices
- https://www.figma.com/blog/introducing-figma-mcp-server/ · https://www.figma.com/blog/design-systems-ai-mcp/
- https://carbondesignsystem.com/developing/carbon-mcp/overview/
- https://developer.salesforce.com/blogs/2025/10/vibe-code-lightning-web-components-with-salesforce-dx-mcp
- https://nordhealth.design/ai/llms-txt
- https://custom-elements-manifest.open-wc.org/blog/intro/
- https://learn.supernova.io/latest/design-systems/features/mcp-for-design-system-LIHAMhjr-LIHAMhjr
- https://ui.nuxt.com/docs/getting-started/ai/llms-txt
- https://github.com/zhixiaoqiang/antd-components-mcp · https://github.com/hk-vk/txtskills

Practitioner / community:

- https://news.ycombinator.com/item?id=45619537 (skills vs MCP, token measurements)
- https://news.ycombinator.com/item?id=45642911 (Playwright skill replacing MCP)
- https://dev.to/kenimo49/your-mcp-server-eats-55000-tokens-before-your-agent-says-a-word-i-measured-the-real-cost-19l8
- https://www.apideck.com/blog/mcp-server-eating-context-window-cli-alternative
- https://jxnl.co/writing/2025/09/11/why-grep-beat-embeddings-in-our-swe-bench-agent-lessons-from-augment/
- https://marmelab.com/blog/2025/08/19/shadcn-admin-kit-mcp.html
- https://dev.to/toyama0919/using-llmstxt-with-cursor-and-claude-code-a-concrete-playbook-4jln
- https://opensource.posit.co/blog/2026-07-03_ai-newsletter/ (AGENTS.md vs skills vs MCP)
- https://www.intodesignsystems.com/agentic-design-systems
- https://shadcncraft.com/shadcn-mcp
- https://gist.github.com/0xdevalias/f40bc5a6f84c4c5ad862e314894b2fa6 (rules/context-file ecosystem survey)

Verification notes: one extracted claim was killed in adversarial review (that Ant
Design frames its MCP as replacing model training data — the source only claims
real-time doc access) and is not used above. One Figma claim was softened (the
non-Code-Connect fallback provides styling context, not *only* styling context).
