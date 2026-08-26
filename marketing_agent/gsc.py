"""Google Search Console pull for the SEO agent.

Optional: requires `pip install google-auth` and a service-account JSON with
the webmasters.readonly scope, added as a user of the Search Console property.
Configure per product in brands/<product>/channels.json:

    "gsc": {"site_url": "sc-domain:example.com",
            "credentials_env": "GSC_CREDENTIALS_FILE"}

where the env var points at the service-account JSON file. Failures are
non-fatal — the pipeline continues without GSC data.
"""

import datetime as dt
import os
from urllib.parse import quote

import httpx


def fetch_gsc_data(config: dict) -> str | None:
    site_url = config.get("site_url")
    creds_file = os.environ.get(config.get("credentials_env", "GSC_CREDENTIALS_FILE") or "")
    if not site_url or not creds_file:
        return None

    try:
        from google.oauth2 import service_account
        import google.auth.transport.requests
    except ImportError:
        print("  gsc: google-auth not installed (pip install google-auth) — skipping")
        return None

    try:
        creds = service_account.Credentials.from_service_account_file(
            creds_file, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
        )
        creds.refresh(google.auth.transport.requests.Request())

        end = dt.date.today()
        start = end - dt.timedelta(days=28)
        resp = httpx.post(
            "https://www.googleapis.com/webmasters/v3/sites/"
            + quote(site_url, safe="")
            + "/searchAnalytics/query",
            headers={"Authorization": f"Bearer {creds.token}"},
            json={
                "startDate": start.isoformat(),
                "endDate": end.isoformat(),
                "dimensions": ["query"],
                "rowLimit": 100,
            },
            timeout=30,
        )
        resp.raise_for_status()
        rows = resp.json().get("rows", [])
        if not rows:
            return None
        lines = ["query,clicks,impressions,ctr,position"]
        for r in rows:
            lines.append(
                f"{r['keys'][0]},{r['clicks']},{r['impressions']},"
                f"{r['ctr']:.4f},{r['position']:.1f}"
            )
        return "\n".join(lines)
    except Exception as e:  # any GSC failure is non-fatal
        print(f"  gsc: pull failed (non-fatal): {e}")
        return None
