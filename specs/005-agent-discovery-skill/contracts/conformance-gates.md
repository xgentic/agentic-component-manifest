# Contract: Conformance gates

The gates that bind this feature's behavior (architecture §7). Gate ids G1–G6 are stable.
Location: `packages/conformance/tests/skill-gates.test.ts` (G2/G3/G5/G6 + the FR-004
presence check), `discovery-gates.test.ts` (G4, spec-004 corpus reused), `gate-seeded.test.ts`
(the SC-003 seeded proof), and `pnpm drift` (G1).

| # | Property | Mechanism | Requirement |
|---|---|---|---|
| G1 | Mechanical content matches the CLI surface | By construction (single-field projection) + whole-file `pnpm drift` catches staleness/hand-edits | FR-005 / FR-006 |
| G2 | Authored blocks name only real surface elements | Grammar sweep over ALL authored text (backticked or not) for `acm <word>`, `--flag`, `ACM-D-*`, and dot-namespaced response types, each verified against the capability manifest; block inventory is exactly the six ids; every generated example parses as a valid invocation | FR-005 |
| G3 | Packagings match the canonical source | Extract each target's marked regions and byte-compare to the canonical blocks; block ids equal `BODY_BLOCK_ORDER`; SKILL.md `description` = `activation`; the two skill packagings are byte-identical; the registry `--target` enum = the generator's target set | FR-006 / SC-004 |
| G4 | The two-call loop works as documented, incl. hostile fixtures | Drive the documented loop against `fixtures/discovery-corpus` (composed from the capability manifest) to a `component.detail` envelope; against the hostile package, machine output byte-preserves hostile text while human output carries no control bytes | FR-007 / SC-005 |
| G5 | Token budgets hold | `ceil(UTF-8 bytes / 4)`: activation ≤ 100 tokens (400 bytes); SKILL.md body ≤ 2,000 tokens (8,000 bytes), markers included | FR-008 / SC-002 |
| G6 | Every error path has a prescribed branch | Cross-check `error-playbook` coverage against the capability manifest's `errorCodes[]` — 100%; the zero-result branch is prescribed as success (broaden, never fabricate) | FR-003 / SC-006 |

## Instruction-presence checks (FR-004 / FR-002 / FR-003 / FR-010)

Beyond G1–G6, `skill-gates.test.ts` asserts the emitted skill carries the authored
guarantees:

- `security-posture` contains the "never instructions" framing, covers `suggestions`,
  and cites `NS-DATA-1` (FR-004 / SC-005).
- `corpus-preamble` names `acm capabilities` and `ACM-D-EMPTY-CORPUS`, and
  `BODY_BLOCK_ORDER[0]` is `corpus-preamble` (workflow starts with detection — FR-009).
- `workflow` forbids help-text scraping ("do not scrape help text") and prose branching
  ("never on prose"), and teaches tiers 2–3 (agent-generated synonyms + `acm component
  --dense`, "never fabricate") — FR-002 / FR-003 / FR-010 / SC-007.

## Seeded non-conformance proof (SC-003)

In `gate-seeded.test.ts` (`pnpm test:seeded`): injecting a fabricated surface reference
into an authored block MUST make `sweepAuthoredReferences` return a problem naming the
offending reference; the clean blocks return none. A seeded change that is NOT rejected
is itself a conformance failure.

## Non-goals of CI (assumption boundary)

CI verifies content, budgets, drift, and the loop's machine outcomes deterministically. It
does **not** verify live-LLM behavior (SC-001's agent-in-the-loop is exercised via the
documented workflow against fixtures) nor live host recognition (SC-004's "recognized by"
half — CI gates byte-identical content, not installation into a running host).
