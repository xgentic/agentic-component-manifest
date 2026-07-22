"""A deepeval judge model backed by the Claude Code CLI (`claude -p`).

deepeval metrics (G-Eval and friends) need an LLM to grade with. By default that is
OpenAI. This subclass shells out to the local `claude` binary instead, so the suite
reuses your existing Claude Code auth and needs no OPENAI_API_KEY.

The judge is a *pure text* call: MCP is disabled and no tools are allowed, so the
process cannot touch the filesystem or network beyond the model request itself.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import subprocess
from typing import Optional, Type, Union

from deepeval.models import DeepEvalBaseLLM
from pydantic import BaseModel

# Judge model id/alias passed to `claude --model`. Alias ("sonnet"/"opus"/"haiku") or a
# full id ("claude-sonnet-5"). Overridable so a run can pin an exact model.
JUDGE_MODEL = os.environ.get("EVAL_JUDGE_MODEL", "sonnet")

# Hard ceiling so a wedged judge call cannot hang the suite forever.
JUDGE_TIMEOUT_S = int(os.environ.get("EVAL_JUDGE_TIMEOUT_S", "120"))


def _extract_json(text: str) -> str:
    """Pull the first JSON object/array out of a model reply.

    Claude may wrap JSON in prose or a ```json fence even when asked not to; be lenient.
    """
    fenced = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", text, re.DOTALL)
    if fenced:
        return fenced.group(1)
    # Fall back to the outermost braces/brackets.
    start = min(
        (i for i in (text.find("{"), text.find("[")) if i != -1),
        default=-1,
    )
    if start == -1:
        raise ValueError(f"no JSON found in judge reply: {text[:200]!r}")
    # Walk to the matching close for the opener we found.
    opener = text[start]
    closer = "}" if opener == "{" else "]"
    depth = 0
    for i in range(start, len(text)):
        if text[i] == opener:
            depth += 1
        elif text[i] == closer:
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    raise ValueError(f"unbalanced JSON in judge reply: {text[:200]!r}")


def _build_argv(prompt: str, model: str) -> list[str]:
    return [
        "claude",
        "-p",
        prompt,
        "--output-format",
        "json",
        "--model",
        model,
        # Lock the judge down to a pure text turn.
        "--allowedTools",
        "",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
    ]


def _parse_result(stdout: str) -> str:
    """`--output-format json` prints one envelope; the reply text is `.result`."""
    envelope = json.loads(stdout)
    if envelope.get("is_error"):
        raise RuntimeError(f"claude judge returned an error: {envelope}")
    return envelope["result"]


class ClaudeCLIModel(DeepEvalBaseLLM):
    """LLM-as-judge that runs `claude -p` for every grade."""

    def __init__(self, model: str = JUDGE_MODEL):
        # NB: deepeval's base __init__ assigns `self.model = load_model()`, so we keep
        # the CLI model id under a different name to avoid it being clobbered to None.
        self.model_id = model
        super().__init__(model_name=model)

    def load_model(self):  # deepeval hook; nothing to load for a CLI shell-out
        return None

    def get_model_name(self) -> str:
        return f"claude-cli:{self.model_id}"

    # --- sync ---------------------------------------------------------------
    def generate(
        self, prompt: str, schema: Optional[Type[BaseModel]] = None
    ) -> Union[str, BaseModel]:
        argv = _build_argv(self._maybe_schema_prompt(prompt, schema), self.model_id)
        proc = subprocess.run(
            argv, capture_output=True, text=True, timeout=JUDGE_TIMEOUT_S
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"`claude -p` judge failed (exit {proc.returncode}): {proc.stderr[:500]}"
            )
        return self._finish(_parse_result(proc.stdout), schema)

    # --- async --------------------------------------------------------------
    async def a_generate(
        self, prompt: str, schema: Optional[Type[BaseModel]] = None
    ) -> Union[str, BaseModel]:
        argv = _build_argv(self._maybe_schema_prompt(prompt, schema), self.model_id)
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            out, err = await asyncio.wait_for(
                proc.communicate(), timeout=JUDGE_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            proc.kill()
            raise
        if proc.returncode != 0:
            raise RuntimeError(
                f"`claude -p` judge failed (exit {proc.returncode}): {err.decode()[:500]}"
            )
        return self._finish(_parse_result(out.decode()), schema)

    # --- helpers ------------------------------------------------------------
    def _maybe_schema_prompt(
        self, prompt: str, schema: Optional[Type[BaseModel]]
    ) -> str:
        if schema is None:
            return prompt
        json_schema = json.dumps(schema.model_json_schema(), indent=2)
        return (
            f"{prompt}\n\n"
            "Respond with ONLY a single JSON value that validates against this JSON "
            f"schema. No prose, no code fence:\n{json_schema}"
        )

    def _finish(
        self, result_text: str, schema: Optional[Type[BaseModel]]
    ) -> Union[str, BaseModel]:
        if schema is None:
            return result_text
        return schema.model_validate_json(_extract_json(result_text))
