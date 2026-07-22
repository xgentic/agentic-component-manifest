"""Shared fixtures + the paid-run safety gate.

The whole suite is opt-in: nothing here spends money unless EVAL_LIVE=1 is set AND the
`claude` CLI is on PATH. A bare `pytest` (e.g. in CI or an editor) collects the tests
and skips them, so the scaffold is safe to keep in the repo.
"""

from __future__ import annotations

import os
import shutil

import pytest

LIVE = os.environ.get("EVAL_LIVE") == "1"


def pytest_collection_modifyitems(config, items):
    if LIVE and shutil.which("claude"):
        return
    reason = (
        "live skill evals skipped: set EVAL_LIVE=1 and ensure `claude` is on PATH "
        "(these make paid Claude Code calls)"
    )
    skip = pytest.mark.skip(reason=reason)
    for item in items:
        item.add_marker(skip)
