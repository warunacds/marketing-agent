"""CLI entry point.

  python -m marketing_agent content --product <slug> [--gsc file.csv] [--model <id>]
  python -m marketing_agent report  --product <slug> [--metrics file.md] [--model <id>]
  python -m marketing_agent queue
  python -m marketing_agent approve <item>
  python -m marketing_agent reject  <item> [--reason "..."]
  python -m marketing_agent publish <item> [--channel blog,social,newsletter]
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
    p_content.add_argument("--instructions", help="free-text guidance injected into every agent prompt for this run")

    p_report = sub.add_parser("report", help="run the weekly analyst")
    p_report.add_argument("--product", required=True)
    p_report.add_argument("--metrics", help="file of pasted metrics (GSC, newsletter, social)")
    p_report.add_argument("--model", help="OpenAI model id for this run (default: MARKETING_MODEL or gpt-5.6-terra)")

    p_revise = sub.add_parser("revise", help="rewrite a pending item per feedback, then re-fact-check")
    p_revise.add_argument("item")
    p_revise.add_argument("--feedback", required=True, help="what to change")
    p_revise.add_argument("--model", help="OpenAI model id (default: MARKETING_MODEL or gpt-5.6-terra)")

    p_factcheck = sub.add_parser("factcheck", help="re-run the fact-check on a pending item")
    p_factcheck.add_argument("item")
    p_factcheck.add_argument("--model", help="OpenAI model id (default: MARKETING_FACTCHECK_MODEL)")

    p_brandgen = sub.add_parser("brandgen", help="draft a brand brain from a product description")
    p_brandgen.add_argument("product", help="existing brand folder (copied from _template)")
    p_brandgen.add_argument("--description", required=True, help="plain-language product description")
    p_brandgen.add_argument("--model", help="OpenAI model id for the draft")

    sub.add_parser("queue", help="list drafts awaiting approval")

    p_approve = sub.add_parser("approve", help="approve a pending item")
    p_approve.add_argument("item")
    p_approve.add_argument("--yes", action="store_true", help="skip the fact-check FAIL confirmation")

    p_reject = sub.add_parser("reject", help="reject a pending item")
    p_reject.add_argument("item")
    p_reject.add_argument("--reason")

    p_publish = sub.add_parser("publish", help="publish an approved item through its channels")
    p_publish.add_argument("item")
    p_publish.add_argument("--channel", help="comma-separated subset: blog,social,newsletter")

    p_login = sub.add_parser("login", help="log into a social platform once (saves the session)")
    p_login.add_argument("platform", help="platform to log into, e.g. 'x'")

    args = parser.parse_args()

    if args.command in ("content", "report", "revise", "factcheck", "brandgen") and not os.environ.get("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.")

    if args.command == "content":
        from .pipelines import weekly_content
        gsc = Path(args.gsc).read_text() if args.gsc else None
        asyncio.run(weekly_content.run(
            args.product, gsc_data=gsc, model=args.model, instructions=args.instructions,
        ))
    elif args.command == "report":
        from .pipelines import weekly_report
        asyncio.run(weekly_report.run(args.product, metrics_file=args.metrics, model=args.model))
    elif args.command == "revise":
        from .pipelines import revise
        asyncio.run(revise.revise(args.item, args.feedback, model=args.model))
    elif args.command == "factcheck":
        from .pipelines import revise
        asyncio.run(revise.recheck(args.item, model=args.model))
    elif args.command == "brandgen":
        from .pipelines import brand_builder
        asyncio.run(brand_builder.run(args.product, args.description, model=args.model))
    elif args.command == "queue":
        from .approve import list_queue
        list_queue()
    elif args.command == "approve":
        from .approve import approve
        approve(args.item, yes=args.yes)
    elif args.command == "reject":
        from .approve import reject
        reject(args.item, args.reason)
    elif args.command == "publish":
        from .publish import publish
        publish(args.item, args.channel.split(",") if args.channel else None)
    elif args.command == "login":
        from .browser import save_login
        save_login(args.platform)


if __name__ == "__main__":
    main()
