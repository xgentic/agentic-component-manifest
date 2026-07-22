"""Evals for the repo's dev-workflow skills.

These are mostly *activation* checks — a skill's frontmatter `description` is what makes
the right skill fire (and a bad one fire on unrelated prompts). We test both directions:
a representative prompt activates the skill, and a distractor prompt does not. One
skill also gets a light adherence G-Eval on a canonical task.

Gated behind EVAL_LIVE (see conftest.py).
"""

from __future__ import annotations

import shutil

import pytest
from deepeval import assert_test
from deepeval.test_case import LLMTestCase

from metrics import skill_adherence_metric
from sut import make_dev_skill_sandbox, run_skill

# Skill tool must be allowed so the model can actually invoke a skill under test.
ACTIVATION_TOOLS = "Skill Read Glob Grep"


@pytest.fixture
def dev_run():
    sandboxes = []

    def _run(skill_name: str, task: str, allowed_tools: str = ACTIVATION_TOOLS):
        sandbox, env = make_dev_skill_sandbox(skill_name)
        sandboxes.append(sandbox)
        return run_skill(task, sandbox, env, allowed_tools=allowed_tools)

    yield _run
    for s in sandboxes:
        shutil.rmtree(s, ignore_errors=True)


# (skill, prompt that SHOULD activate it, distractor that should NOT)
ACTIVATION_CASES = [
    (
        "tdd",
        "Let's build this feature test-first, red-green-refactor.",
        "What time zone is Tokyo in?",
    ),
    (
        "code-review",
        "Review the changes on this branch since main.",
        "Write a haiku about the ocean.",
    ),
    (
        "diagnosing-bugs",
        "This function throws intermittently in prod — help me debug it.",
        "Rename this variable from x to count.",
    ),
]


@pytest.mark.parametrize("skill,trigger,_distractor", ACTIVATION_CASES)
def test_skill_activates_on_trigger(dev_run, skill, trigger, _distractor):
    t = dev_run(skill, trigger)
    assert skill in t.activated_skills, (
        f"expected skill {skill!r} to activate on {trigger!r}; "
        f"activated: {t.activated_skills}"
    )


@pytest.mark.parametrize("skill,_trigger,distractor", ACTIVATION_CASES)
def test_skill_stays_quiet_on_distractor(dev_run, skill, _trigger, distractor):
    t = dev_run(skill, distractor)
    assert skill not in t.activated_skills, (
        f"skill {skill!r} wrongly activated on unrelated prompt {distractor!r}"
    )


def test_tdd_writes_test_first(dev_run):
    """Adherence: with tdd active, the run should produce a failing test before impl."""
    t = dev_run(
        "tdd",
        "Using the tdd skill, add an `isPalindrome(s: string)` helper. Show me your "
        "first step.",
        allowed_tools="Skill Read Write Edit Glob Grep",
    )
    case = LLMTestCase(
        input="Add an isPalindrome helper, test-first.",
        actual_output=t.render_for_judge(),
    )
    assert_test(
        case,
        [
            skill_adherence_metric(
                "tdd",
                "the agent writes (or proposes) a failing test for the behaviour BEFORE "
                "any implementation, rather than writing the implementation first.",
            )
        ],
    )
