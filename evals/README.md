# ACM skill evals

Behavioural evals for this repo's skills, **driven and judged by the Claude Code CLI**
(`claude -p`). This is a deliberately lightweight, opt-in layer — it is **not** part of
`pnpm test` and never gates CI. It exists to catch behavioural regressions that the
mechanical [spec-005 skill gates](../packages/conformance/tests/) cannot see (a skill
can be byte-perfect and still lead an agent to fabricate an API).

## What it evaluates

- **The ACM Discovery Skill** (`packages/discovery-skill`, the product): 15 behavioural
  evals against the `discovery-corpus` fixture, each grounded in a real corpus fact —
  - _the loop_: two-call `search → detail → build` adherence, no-prop-fabrication on a
    real component, synonym widening when literal search misses, and `total: 0` handled
    as success (never a fabricated component, never a rogue `pnpm add`);
  - _typed-error recovery_: `ACM-D-UNKNOWN-COMPONENT` (typo → suggestions),
    `ACM-D-AMBIGUOUS-COMPONENT` both cross-package (`AcmeButton`, needs `--from`) and
    intra-package (`Chip` in `@acme/mixed`, needs `--from` + `--module`),
    `ACM-D-USAGE` (bad flag → consult `capabilities`), and a non-fatal
    `ACM-D-BAD-MANIFEST` (`broken-pkg`) that must not abort the healthy corpus;
  - _graceful degradation_: `ACM-D-EMPTY-CORPUS` and a missing `acm` toolchain both
    reported honestly, never retry-looped or silently guessed around;
  - _NS-DATA-1_ (manifest text is inert data): the `hostile-pkg` injection ignored at
    both the component-description and input-description level, with a deterministic
    tripwire that no exfiltrate/destructive command ever runs.
- **The dev-workflow skills** (`.claude/skills/tdd`, `code-review`, …):
  mostly *activation* quality (right skill fires on a trigger prompt, stays quiet on a
  distractor), plus one light adherence check.

## How `claude -p` is wired in

`claude -p` plays two roles:

| Role | File | What it does |
| --- | --- | --- |
| **Judge** (LLM-as-judge for G-Eval) | [`claude_model.py`](claude_model.py) | `ClaudeCLIModel(DeepEvalBaseLLM)` shells out to `claude -p … --output-format json`, with tools + MCP disabled. Overrides deepeval's default OpenAI judge, so **no `OPENAI_API_KEY` is needed**. |
| **System under test** | [`sut.py`](sut.py) | Runs `claude -p "<task>" --output-format stream-json --verbose` inside a sandbox project with the skill installed, then distils the event stream into a `Transcript` (tool calls + outputs + final text). |

Deterministic properties (loop order, skill activation) are asserted directly on the
`Transcript`; only the subjective judgements go through G-Eval ([`metrics.py`](metrics.py)).

## Running

```sh
# collect + SKIP everything (no paid calls) — the default safety mode:
pnpm eval

# actually run (PAID — live claude calls for both agent-under-test and judge):
EVAL_LIVE=1 pnpm eval

# a single file:
EVAL_LIVE=1 pnpm eval evals/test_discovery_skill.py
```

First run bootstraps `evals/.venv` and installs `deepeval` (prefers `uv` if present).

### Requirements

- `claude` on `PATH`, already authenticated (the evals reuse that auth).
- Python **3.11 or 3.12** — deepeval's pinned deps lag the newest interpreters, so avoid
  3.13+/3.14. `uv venv --python 3.12` handles this; the stdlib fallback uses whatever
  `python3` resolves to, so install a 3.12 if yours is newer.
- `pnpm` + `tsx` (already in the repo) — the sandbox's `acm` shim calls `pnpm acm`.

### Configuration (env)

| Var | Default | Meaning |
| --- | --- | --- |
| `EVAL_LIVE` | unset | must be `1` to make any paid call; otherwise tests skip |
| `EVAL_MODEL` | `sonnet` | model put under test |
| `EVAL_JUDGE_MODEL` | `sonnet` | model used as judge |
| `EVAL_SUT_TIMEOUT_S` | `300` | per-task ceiling for the agent-under-test |
| `EVAL_JUDGE_TIMEOUT_S` | `120` | per-grade ceiling for the judge |

## Caveats — read before trusting a run

- **Non-deterministic + paid.** Both the agent and the judge are live models. Thresholds
  in `metrics.py` are lenient on purpose; treat a single failure as a signal to look, not
  a hard verdict. Run a few iterations before concluding a regression is real.
- **Not a gate.** Kept out of `pnpm test` precisely because of the above. Best used
  locally or on a nightly/manual cadence.
- **Model ids drift.** `sonnet`/`opus` are moving aliases; pin `EVAL_*_MODEL` to an exact
  id when you need a run to be reproducible.

## Layout

```
evals/
├── claude_model.py          # ClaudeCLIModel — the judge
├── sut.py                   # sandbox builders + run_skill() + Transcript
├── metrics.py               # G-Eval rubrics (judged by ClaudeCLIModel)
├── conftest.py              # EVAL_LIVE gate (skips everything unless opted in)
├── test_discovery_skill.py  # the product skill
├── test_dev_skills.py       # activation + adherence for dev skills
├── run.sh                   # `pnpm eval` entry — venv bootstrap + deepeval
└── pyproject.toml
```
