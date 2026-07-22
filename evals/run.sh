#!/usr/bin/env bash
# Run the ACM skill evals. Opt-in and paid: makes live `claude -p` calls.
#
# Usage:
#   pnpm eval                     # run every skill eval (requires EVAL_LIVE=1)
#   EVAL_LIVE=1 pnpm eval
#   EVAL_LIVE=1 pnpm eval evals/test_discovery_skill.py
#
# First run bootstraps a local venv under evals/.venv. Prefer `uv` if present.
set -euo pipefail
cd "$(dirname "$0")"

VENV=".venv"
if [ ! -d "$VENV" ]; then
  echo "› creating venv ($VENV) and installing deepeval…"
  if command -v uv >/dev/null 2>&1; then
    uv venv --python 3.12 "$VENV"
    # shellcheck disable=SC1091
    source "$VENV/bin/activate"
    uv pip install -e .
  else
    python3 -m venv "$VENV"
    # shellcheck disable=SC1091
    source "$VENV/bin/activate"
    pip install --quiet --upgrade pip
    pip install -e .
  fi
else
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
fi

if [ "${EVAL_LIVE:-}" != "1" ]; then
  echo "⚠  EVAL_LIVE is not set — tests will be collected and SKIPPED (no paid calls)."
  echo "   Re-run with: EVAL_LIVE=1 pnpm eval"
fi

# deepeval wraps pytest; pass through any extra args (e.g. a single test file).
exec deepeval test run "${@:-.}"
