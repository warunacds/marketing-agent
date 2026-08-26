"""Thin wrapper around the Claude Agent SDK: run one specialist agent, one task.

Each pipeline step is a single `query()` call. The agent's system prompt comes
from agents/<name>.md; the brand brain is read by the agent itself using the
SDK's built-in file tools (Read/Glob/Grep), so there is no retrieval layer to
maintain. Agents are read-only — all files are written by pipeline code, which
keeps the write path (and the approval queue) deterministic.
"""

import json
import time
from dataclasses import dataclass

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    query,
)

from .config import AGENTS_DIR, DEFAULT_MODEL, ROOT

READ_TOOLS = ["Read", "Glob", "Grep"]
WEB_TOOLS = ["WebSearch", "WebFetch"]


@dataclass
class StepResult:
    agent: str
    text: str
    cost_usd: float | None
    duration_s: float


async def run_agent(
    agent_name: str,
    prompt: str,
    *,
    model: str | None = None,
    allow_web: bool = False,
    max_turns: int = 40,
) -> StepResult:
    system_prompt = (AGENTS_DIR / f"{agent_name}.md").read_text()
    tools = READ_TOOLS + (WEB_TOOLS if allow_web else [])

    options = ClaudeAgentOptions(
        system_prompt=system_prompt,
        model=model or DEFAULT_MODEL,
        cwd=str(ROOT),
        allowed_tools=tools,
        # Headless: allowed tools run, anything else is denied instead of
        # hanging on an interactive permission prompt.
        permission_mode="dontAsk",
        max_turns=max_turns,
    )

    started = time.monotonic()
    final_text = ""
    cost_usd: float | None = None

    async for message in query(prompt=prompt, options=options):
        if isinstance(message, AssistantMessage):
            texts = [b.text for b in message.content if isinstance(b, TextBlock)]
            if texts:
                # Keep the last assistant text — agents are instructed that
                # their final message is the deliverable.
                final_text = "\n".join(texts)
        elif isinstance(message, ResultMessage):
            cost_usd = getattr(message, "total_cost_usd", None)
            result_text = getattr(message, "result", None)
            if isinstance(result_text, str) and result_text.strip():
                final_text = result_text

    if not final_text.strip():
        raise RuntimeError(f"Agent '{agent_name}' produced no output")

    return StepResult(
        agent=agent_name,
        text=final_text,
        cost_usd=cost_usd,
        duration_s=round(time.monotonic() - started, 1),
    )


def log_step(run_dir, result: StepResult, model: str) -> None:
    """Append cost/duration for one step to the run's cost log."""
    with open(run_dir / "costs.jsonl", "a") as f:
        f.write(json.dumps({
            "agent": result.agent,
            "model": model,
            "cost_usd": result.cost_usd,
            "duration_s": result.duration_s,
        }) + "\n")
