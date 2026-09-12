#!/usr/bin/env python3
"""Scrape a LinkedIn profile via Apify and score its presence out of 100.

    python scrape_and_score.py
    python scrape_and_score.py https://www.linkedin.com/in/<slug>/ --posts 5

Needs an Apify API token: put APIFY_TOKEN in .env (or pass --apify-token).
Get one at https://console.apify.com/settings/integrations
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from linkedin_presence import ApifyError, build_report, compute_score, render_text, scrape_via_apify

DEFAULT_PROFILE = "https://www.linkedin.com/in/aranyabandhu/"


def main() -> None:
    load_dotenv()

    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("profile", nargs="?", default=DEFAULT_PROFILE, help="LinkedIn /in/<slug>/ URL")
    ap.add_argument("--posts", type=int, default=5, help="recent posts to score (default 5)")
    ap.add_argument("--apify-token", default=None, help="Apify API token (else $APIFY_TOKEN)")
    ap.add_argument("--out", default="linkedin_presence_result.json", help="output JSON path")
    args = ap.parse_args()

    token = args.apify_token or os.getenv("APIFY_TOKEN", "")
    try:
        stats = scrape_via_apify(args.profile, args.posts, token)
    except ApifyError as exc:
        sys.exit(f"error: {exc}")

    score = compute_score(
        followers=stats.followers,
        connections=stats.connections,
        post_likes=[p.likes for p in stats.posts],
    )
    report = build_report(stats, score)

    Path(args.out).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n" + render_text(report))
    print(f"\nFull JSON -> {args.out}")


if __name__ == "__main__":
    main()
