"""Approval-queue notifications: Slack incoming webhook and/or Telegram bot.

Both are optional — configure via env; unset means no-op. Failures never break
a pipeline run.
"""

import os

import httpx


def notify(message: str) -> None:
    slack_url = os.environ.get("SLACK_WEBHOOK_URL")
    tg_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    tg_chat = os.environ.get("TELEGRAM_CHAT_ID")

    if slack_url:
        _try_post(slack_url, {"text": message}, "Slack")
    if tg_token and tg_chat:
        _try_post(
            f"https://api.telegram.org/bot{tg_token}/sendMessage",
            {"chat_id": tg_chat, "text": message},
            "Telegram",
        )


def _try_post(url: str, payload: dict, label: str) -> None:
    try:
        httpx.post(url, json=payload, timeout=15).raise_for_status()
        print(f"  notified via {label}")
    except httpx.HTTPError as e:
        print(f"  {label} notification failed (non-fatal): {e}")
