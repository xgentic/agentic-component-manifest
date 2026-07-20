# Claude Code — Agentic Component Manifest

<!-- The operating manual for this repo lives in AGENTS.md. @AGENTS.md below is the
     documented Claude Code pattern for sharing one instruction set with other coding
     agents (Cursor, Devin, etc.) without duplicating content; Claude-specific additions
     go in the section below the import instead of being mixed into AGENTS.md. -->

@AGENTS.md

## Claude Code

- Domain vocabulary is normative: use the terms in [CONTEXT.md](CONTEXT.md) exactly as
  defined (AGENTS.md invariant #8) — e.g. "Agent View", never "YAML manifest".
- Feature work follows the Spec Kit flow described in AGENTS.md; reusable skills live in
  `.claude/skills/`.
