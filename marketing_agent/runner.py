"""Thin wrapper around the OpenAI Responses API: one specialist agent, one task.

Each pipeline step is a single `responses.create()` call. The agent's system
prompt comes from agents/<name>.md; the brand brain is inlined into the task
prompt by the pipeline, so agents need no file access. Research/SEO steps get
the built-in `web_search` tool. All files are written by pipeline code, which
keeps the write path (and the approval queue) deterministic.
"""

import json
import time
from dataclasses import dataclass

from openai import AsyncOpenAI

from .config import AGENTS_DIR, DEFAULT_MODEL

# Approximate $/1M-token prices for cost logging (update as OpenAI's price
# sheet changes; unknown models log tokens with cost null).
PRICES = {
    "gpt-5.6-sol": (5.00, 30.00),
    "gpt-5.6": (5.00, 30.00),      # alias routes to sol
    "gpt-5.6-terra": (2.00, 12.00),
    "gpt-5.6-luna": (0.20, 1.20),
    "gpt-5.5": (5.00, 30.00),
    "gpt-5.4": (2.50, 15.00),
    "gpt-5.1": (1.25, 10.00),
}

_client: AsyncOpenAI | None = None


def client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI()  # reads OPENAI_API_KEY
    return _client


@dataclass
class StepResult:
    agent: str
    model: str
    text: str
    input_tokens: int | None
    output_tokens: int | None
    cost_usd: float | None
    duration_s: float


def _estimate_cost(model: str, input_tokens: int | None, output_tokens: int | None) -> float | None:
    if input_tokens is None or output_tokens is None:
        return None
    for known, (in_price, out_price) in PRICES.items():
        if model == known or model.startswith(known + "-"):
            return round((input_tokens * in_price + output_tokens * out_price) / 1_000_000, 4)
    return None


async def run_agent(
    agent_name: str,
    prompt: str,
    *,
    model: str | None = None,
    allow_web: bool = False,
) -> StepResult:
    system_prompt = (AGENTS_DIR / f"{agent_name}.md").read_text()
    model = model or DEFAULT_MODEL

    kwargs = {}
    if allow_web:
        kwargs["tools"] = [{"type": "web_search"}]

    started = time.monotonic()
    resp = await client().responses.create(
        model=model,
        instructions=system_prompt,
        input=prompt,
        **kwargs,
    )

    text = (resp.output_text or "").strip()
    if not text:
        raise RuntimeError(f"Agent '{agent_name}' produced no output")

    usage = getattr(resp, "usage", None)
    input_tokens = getattr(usage, "input_tokens", None)
    output_tokens = getattr(usage, "output_tokens", None)

    return StepResult(
        agent=agent_name,
        model=model,
        text=text,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=_estimate_cost(model, input_tokens, output_tokens),
        duration_s=round(time.monotonic() - started, 1),
    )


def log_step(run_dir, result: StepResult) -> None:
    """Append tokens/cost/duration for one step to the run's cost log."""
    with open(run_dir / "costs.jsonl", "a") as f:
        f.write(json.dumps({
            "agent": result.agent,
            "model": result.model,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
            "cost_usd": result.cost_usd,
            "duration_s": result.duration_s,
        }) + "\n")
