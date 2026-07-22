"""System-under-test runner: invoke a skill through headless Claude Code and capture
what it actually did.

The eval target is a *skill* — a set of instructions Claude follows. To grade one we
run `claude -p "<task>"` inside a sandbox project that has the skill installed under
`.claude/skills/`, stream every event (`--output-format stream-json --verbose`), and
distil the run into a `Transcript`: the final text plus the ordered list of tool calls
(especially the bash commands, which is how we see the discovery loop happen).

Nothing here runs at import time. `run_skill()` is the only paid entry point and is
gated behind EVAL_LIVE by the test harness (see conftest.py).
"""

from __future__ import annotations

import json
import os
import shutil
import stat
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFORMANCE_FIXTURES = REPO_ROOT / "packages" / "conformance" / "fixtures"
DISCOVERY_SKILL_TARGET = (
    REPO_ROOT
    / "packages"
    / "discovery-skill"
    / "generated"
    / "targets"
    / "claude-skill"
    / "acm-discovery"
    / "SKILL.md"
)
LOCAL_SKILLS_DIR = REPO_ROOT / ".claude" / "skills"
NX_ANGULAR_TESTBED = REPO_ROOT / "examples" / "nx-angular-testbed"

# Model id/alias for the agent under test. Keep separate from the judge so a run can
# put a small model under test and grade it with a larger one (or vice versa).
SUT_MODEL = os.environ.get("EVAL_MODEL", "sonnet")
SUT_TIMEOUT_S = int(os.environ.get("EVAL_SUT_TIMEOUT_S", "300"))

# Tools the agent is allowed while under test. Enough to discover + write code; no more.
SUT_ALLOWED_TOOLS = "Bash Read Write Edit Glob Grep"


@dataclass
class ToolCall:
    name: str
    input: dict

    @property
    def bash_command(self) -> Optional[str]:
        if self.name == "Bash":
            return self.input.get("command")
        return None


@dataclass
class Transcript:
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_results: list[str] = field(default_factory=list)
    raw_events: list[dict] = field(default_factory=list)

    @property
    def bash_commands(self) -> list[str]:
        return [c.bash_command for c in self.tool_calls if c.bash_command]

    def commands_matching(self, needle: str) -> list[str]:
        return [c for c in self.bash_commands if needle in c]

    def observed(self, needle: str) -> bool:
        """True iff `needle` appears in any tool output the agent saw.

        This is how we assert the agent actually reached a specific typed envelope
        (e.g. an `ACM-D-*` code) — the code is emitted by the CLI on stdout/stderr and
        surfaced back through the Bash tool_result.
        """
        return any(needle in r for r in self.tool_results)

    @property
    def activated_skills(self) -> list[str]:
        """Skill names the agent invoked via the Skill tool this run."""
        return [
            c.input.get("skill", c.input.get("command", ""))
            for c in self.tool_calls
            if c.name == "Skill"
        ]

    def render_for_judge(self) -> str:
        """A faithful, flat rendering of the run for an LLM judge to grade.

        Includes the commands the agent ran, the outputs it saw (where the fetched
        specs and any injected manifest text appear), and its final answer.
        """
        parts = ["## Commands the agent ran"]
        parts += [f"- {c}" for c in self.bash_commands] or ["- (none)"]
        parts.append("\n## Tool outputs the agent observed")
        parts += self.tool_results or ["(none)"]
        parts.append("\n## Final answer")
        parts.append(self.text or "(empty)")
        return "\n".join(parts)


# --- sandbox construction ---------------------------------------------------


def _write_acm_shim(sandbox: Path) -> Path:
    """Put an `acm` executable on the sandbox PATH that runs the repo's CLI.

    The agent's SKILL.md tells it to run `acm ...`; the corpus lives in the repo. A
    thin shim bridges the two without publishing/installing the toolchain.
    """
    bin_dir = sandbox / ".bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    shim = bin_dir / "acm"
    # Invoke the repo's tsx + CLI directly (NOT `pnpm --dir`, which would move cwd to the
    # repo and make `acm search` scan the wrong project). Running tsx leaves cwd at the
    # sandbox, so the CLI's default `--project .` resolves to the sandbox corpus.
    tsx = REPO_ROOT / "node_modules" / ".bin" / "tsx"
    cli = REPO_ROOT / "packages" / "toolchain" / "src" / "cli.ts"
    shim.write_text(
        "#!/usr/bin/env bash\n"
        f'exec "{tsx}" "{cli}" "$@"\n'
    )
    shim.chmod(shim.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    return bin_dir


def _install_skill(sandbox: Path, skill_src: Path, skill_name: str) -> None:
    dest = sandbox / ".claude" / "skills" / skill_name
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copy(skill_src, dest / "SKILL.md")


def make_discovery_sandbox() -> tuple[Path, dict]:
    """Copy the discovery-corpus fixture and install the acm-discovery skill.

    Returns (sandbox_dir, env). The caller owns cleanup of sandbox_dir.
    """
    sandbox = Path(tempfile.mkdtemp(prefix="acm-eval-discovery-"))
    src = CONFORMANCE_FIXTURES / "discovery-corpus"
    # Copy the corpus (incl. node_modules manifests + hostile-pkg) into the sandbox.
    shutil.copytree(src, sandbox, dirs_exist_ok=True)
    _install_skill(sandbox, DISCOVERY_SKILL_TARGET, "acm-discovery")
    bin_dir = _write_acm_shim(sandbox)
    env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"}
    return sandbox, env


def make_empty_corpus_sandbox() -> tuple[Path, dict]:
    """A project with the acm CLI installed but NO ACM Manifests in scope.

    Every discovery call returns `ACM-D-EMPTY-CORPUS`. Exercises the preamble's
    graceful-degradation path: report that no Manifests were found and proceed
    without the loop — never retry-loop an empty corpus.
    """
    sandbox = Path(tempfile.mkdtemp(prefix="acm-eval-empty-"))
    (sandbox / "package.json").write_text('{ "name": "empty-corpus", "private": true }\n')
    _install_skill(sandbox, DISCOVERY_SKILL_TARGET, "acm-discovery")
    bin_dir = _write_acm_shim(sandbox)
    env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"}
    return sandbox, env


def make_no_toolchain_sandbox() -> tuple[Path, dict]:
    """The discovery corpus + skill, but with NO `acm` on PATH.

    `acm capabilities` fails to resolve, exercising the preamble's first step: report
    that the ACM toolchain is not installed (add `@acm/toolchain`) and continue the
    task without discovery — never silently guess component APIs.
    """
    sandbox = Path(tempfile.mkdtemp(prefix="acm-eval-notoolchain-"))
    src = CONFORMANCE_FIXTURES / "discovery-corpus"
    shutil.copytree(src, sandbox, dirs_exist_ok=True)
    _install_skill(sandbox, DISCOVERY_SKILL_TARGET, "acm-discovery")
    # Deliberately DO NOT install the acm shim. Scrub any inherited PATH entry that
    # might still resolve `acm` so the miss is clean and reproducible.
    clean_path = os.pathsep.join(
        p for p in os.environ.get("PATH", "").split(os.pathsep)
        if p and not (Path(p) / "acm").exists()
    )
    env = {**os.environ, "PATH": clean_path}
    return sandbox, env


def make_angular_testbed_sandbox() -> tuple[Path, dict]:
    """Copy the `examples/nx-angular-testbed` consumer project into a fresh sandbox.

    This is the realistic counterpart to `make_discovery_sandbox()`'s synthetic
    corpus: a real Nx/Angular monorepo where `@testbed/ui` is a workspace-linked
    library (not a fixture written to look like `node_modules`). The library already
    ships a committed `agentic-component-manifest.json` and the project already
    vendors its own `.claude/skills/acm-discovery/SKILL.md` (installed via `acm
    init`), so both are copied verbatim rather than re-synthesized here.

    We skip a real `npm install` (slow, and unnecessary for a discovery-behaviour
    eval that never runs `nx build`/`nx test`) and instead recreate the one thing
    discovery depends on: `node_modules/@testbed/ui` as a symlink to `libs/ui`,
    exactly what npm workspaces would have created.
    """
    sandbox = Path(tempfile.mkdtemp(prefix="acm-eval-angular-testbed-"))
    shutil.copytree(
        NX_ANGULAR_TESTBED,
        sandbox,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(
            "node_modules", "dist", ".nx", ".angular", "coverage", "tmp",
            "test-output", "package-lock.json", ".git",
        ),
    )
    scope_dir = sandbox / "node_modules" / "@testbed"
    scope_dir.mkdir(parents=True, exist_ok=True)
    (scope_dir / "ui").symlink_to(sandbox / "libs" / "ui", target_is_directory=True)
    bin_dir = _write_acm_shim(sandbox)
    env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}"}
    return sandbox, env


def _init_git_repo_with_diff(sandbox: Path) -> None:
    """Make the sandbox a git repo on `main` with one committed file and an uncommitted
    change, so review/diagnose skills have a real diff to act on.
    """
    env = {
        **os.environ,
        "GIT_AUTHOR_NAME": "eval",
        "GIT_AUTHOR_EMAIL": "eval@example.com",
        "GIT_COMMITTER_NAME": "eval",
        "GIT_COMMITTER_EMAIL": "eval@example.com",
    }
    run = lambda *a: subprocess.run(
        a, cwd=sandbox, env=env, check=True, capture_output=True, text=True
    )
    target = sandbox / "greeter.js"
    target.write_text("export function greet(name) {\n  return `Hello, ${name}`;\n}\n")
    run("git", "init", "-b", "main")
    run("git", "add", "greeter.js")
    run("git", "commit", "-m", "initial")
    # An uncommitted change with a plausible bug (unbounded recursion) to review/diagnose.
    target.write_text(
        "export function greet(name) {\n"
        "  if (!name) return greet(name);\n"  # infinite recursion on empty input
        "  return `Hello, ${name.toUpperCase()}`;\n"
        "}\n"
    )


def make_dev_skill_sandbox(skill_name: str) -> tuple[Path, dict]:
    """Sandbox with a single dev skill copied from the repo's .claude/skills, plus a
    minimal git repo + diff so repo-oriented skills (code-review, diagnosing-bugs) have
    something to work on. No ACM corpus.
    """
    sandbox = Path(tempfile.mkdtemp(prefix=f"acm-eval-{skill_name}-"))
    src = LOCAL_SKILLS_DIR / skill_name
    if not (src / "SKILL.md").exists():
        raise FileNotFoundError(f"no SKILL.md for dev skill {skill_name!r} at {src}")
    shutil.copytree(src, sandbox / ".claude" / "skills" / skill_name)
    _init_git_repo_with_diff(sandbox)
    env = {**os.environ}
    return sandbox, env


# --- running ----------------------------------------------------------------


def _parse_stream(stdout: str) -> Transcript:
    """Fold `--output-format stream-json` lines into a Transcript.

    Each line is a JSON event. We collect assistant tool_use blocks and the terminal
    `result` event's text. Unknown/interstitial events are kept in raw_events.
    """
    text = ""
    tool_calls: list[ToolCall] = []
    tool_results: list[str] = []
    raw: list[dict] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        raw.append(event)
        etype = event.get("type")
        if etype == "assistant":
            for block in event.get("message", {}).get("content", []):
                if block.get("type") == "tool_use":
                    tool_calls.append(
                        ToolCall(name=block.get("name", ""), input=block.get("input", {}))
                    )
        elif etype == "user":
            # tool_result blocks come back on a synthetic user turn.
            for block in event.get("message", {}).get("content", []):
                if block.get("type") == "tool_result":
                    content = block.get("content", "")
                    if isinstance(content, list):
                        content = "".join(
                            b.get("text", "") for b in content if isinstance(b, dict)
                        )
                    tool_results.append(str(content))
        elif etype == "result":
            text = event.get("result", "") or text
    return Transcript(
        text=text, tool_calls=tool_calls, tool_results=tool_results, raw_events=raw
    )


def run_skill(
    task: str,
    sandbox: Path,
    env: dict,
    allowed_tools: str = SUT_ALLOWED_TOOLS,
) -> Transcript:
    """Run one headless Claude Code turn against `task` in `sandbox`. PAID + live.

    `allowed_tools` defaults to the discovery toolset; dev-skill activation checks pass
    "Skill ..." so the model can actually invoke the skill under test.
    """
    argv = [
        "claude",
        "-p",
        task,
        "--output-format",
        "stream-json",
        "--verbose",
        "--model",
        SUT_MODEL,
        "--allowedTools",
        allowed_tools,
    ]
    proc = subprocess.run(
        argv,
        cwd=sandbox,
        env=env,
        capture_output=True,
        text=True,
        timeout=SUT_TIMEOUT_S,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"SUT `claude -p` failed (exit {proc.returncode}): {proc.stderr[:800]}"
        )
    return _parse_stream(proc.stdout)
