# Quickstart: Agent Discovery Skill

Runnable validation that the steering layer is generated, fresh, gated, and drives the
documented loop. Run from repo root. See [contracts/](./contracts/) and
[data-model.md](./data-model.md) for detail.

## Prerequisites

- `pnpm install` complete; spec 004 discovery surface green (`acm search` / `component` /
  `capabilities`).
- Fixture corpus present: `packages/conformance/fixtures/discovery-corpus/` (incl. the
  `hostile-pkg` package).

## 1. Generate and verify freshness

```sh
pnpm generate          # regenerates packages/discovery-skill/generated/** (drift --write)
pnpm drift             # expect: fresh
pnpm acm agent-docs    # expect: fresh (exit 0); if stale → exit 3 naming the files
```

**Expected**: `fresh`. Hand-editing any `generated/**` file then re-running `pnpm drift`
MUST report it stale (invariant #1).

## 2. Emit a target on demand

```sh
pnpm acm agent-docs --target claude-skill   # prints the primary SKILL.md
pnpm acm agent-docs --target agents-md      # prints the AGENTS.md fragment
pnpm acm agent-docs --target bogus          # exit 2: unknown target (supported: …)
```

**Expected**: byte-reproducible output; the SKILL.md frontmatter `description` equals
`blocks/activation.md` (single-line); body blocks appear in `BODY_BLOCK_ORDER`.

## 3. Run the skill gates

```sh
pnpm vitest run packages/conformance/tests/skill-gates.test.ts
```

**Expected**: green — G2 (authored-reference sweep + inventory + example validity), G3
(packaging fidelity, byte-identical packagings, `--target` enum match), G5 (budgets ≤ 100
/ ≤ 2,000 tokens), G6 (playbook covers 100% of `ACM-D-*`), and the FR-004/FR-009/FR-010
instruction-presence checks.

## 4. Prove the drift gate bites (SC-003)

```sh
pnpm test:seeded       # includes the seeded fabricated-reference proof
```

**Expected**: the run demonstrates that a fabricated surface reference injected into an
authored block is rejected by `sweepAuthoredReferences`; clean blocks pass.

## 5. Exercise the documented two-call loop, incl. hostile text (G4)

```sh
pnpm vitest run packages/conformance/tests/discovery-gates.test.ts
```

**Expected**: the loop composed from the capability manifest reaches a `component.detail`
envelope; against `hostile-pkg`, machine output byte-preserves the hostile text while human
output contains no ESC/C0 control byte — the skill adds no instruction-following pathway.

Manual check of the loop an agent would run:

```sh
pnpm acm capabilities --json          # self-describe the surface
pnpm acm search "something that triggers an action" --json   # ranked candidates
pnpm acm component <name> --json      # full spec, dense
# zero-result path carries followUps → list-and-scan floor:
pnpm acm search "zzzznomatch" --json  # total: 0, followUps present
pnpm acm component --dense            # tier-3 floor: one line per component
```

## 6. Full closeout (task T025)

```sh
pnpm test && pnpm test:seeded && pnpm lint && pnpm format
```

**Expected**: all green, with `packages/discovery-skill/generated/**` committed as reviewed
diffs.

## Success

The steering layer is validated when: generation is fresh and drift-gated (1), targets
emit reproducibly (2), all skill gates pass (3), the seeded proof bites (4), the documented
loop reaches a full spec and stays inert on hostile text (5), and the full suite is green
(6) — satisfying SC-002…SC-007 (SC-001's live-LLM half and SC-004's live-recognition half
are exercised via the documented workflow against fixtures, per the plan's assumptions).
