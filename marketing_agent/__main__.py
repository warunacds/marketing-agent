"""CLI entry point.

  python -m marketing_agent content --product <slug> [--gsc file.csv] [--model <id>]
  python -m marketing_agent report  --product <slug> [--metrics file.md] [--model <id>]
  python -m marketing_agent queue
  python -m marketing_agent approve <item>
  python -m marketing_agent reject  <item> [--reason "..."]
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(prog="marketing_agent")
    sub = parser.add_subparsers(dest="command", required=True)

    p_content = sub.add_parser("content", help="run the weekly content pipeline")
    p_content.add_argument("--product", required=True, help="brand folder name under brands/")
    p_content.add_argument("--gsc", help="optional Search Console export to feed the SEO agent")
    p_content.add_argument("--model", help="OpenAI model id for this run (default: MARKETING_MODEL or gpt-5.6-terra)")

    p_report = sub.add_parser("report", help="run the weekly analyst")
    p_report.add_argument("--product", required=True)
    p_report.add_argument("--metrics", help="file of pasted metrics (GSC, newsletter, social)")
    p_report.add_argument("--model", help="OpenAI model id for this run (default: MARKETING_MODEL or gpt-5.6-terra)")

    sub.add_parser("queue", help="list drafts awaiting approval")

    p_approve = sub.add_parser("approve", help="approve a pending item")
    p_approve.add_argument("item")

    p_reject = sub.add_parser("reject", help="reject a pending item")
    p_reject.add_argument("item")
    p_reject.add_argument("--reason")

    args = parser.parse_args()

    if args.command in ("content", "report") and not os.environ.get("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.")

    if args.command == "content":
        from .pipelines import weekly_content
        gsc = Path(args.gsc).read_text() if args.gsc else None
        asyncio.run(weekly_content.run(args.product, gsc_data=gsc, model=args.model))
    elif args.command == "report":
        from .pipelines import weekly_report
        asyncio.run(weekly_report.run(args.product, metrics_file=args.metrics, model=args.model))
    elif args.command == "queue":
        from .approve import list_queue
        list_queue()
    elif args.command == "approve":
        from .approve import approve
        approve(args.item)
    elif args.command == "reject":
        from .approve import reject
        reject(args.item, args.reason)


if __name__ == "__main__":
    main()
