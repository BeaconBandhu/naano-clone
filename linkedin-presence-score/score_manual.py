#!/usr/bin/env python3
"""Score a profile from numbers you read off LinkedIn yourself - zero scraping,
zero login, zero cost.

    python score_manual.py --followers 1240 --connections 500 --likes 38,21,9,54,17

Where to read the numbers (~1 minute on your own profile):
  followers / connections  ->  the profile top card, under your name
  likes                    ->  the reaction count under each of your last 5 posts
                               (comma-separated, most-recent first)

Every input is optional; anything you omit just scores 0 for that component.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from linkedin_presence import build_report, compute_score, render_text
from linkedin_presence.models import PostStat, ProfileStats

DEFAULT_PROFILE = "https://www.linkedin.com/in/aranyabandhu/"


def _int_list(raw: str) -> list[int]:
    return [int(x) for x in raw.replace(" ", "").split(",") if x]


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--profile", default=DEFAULT_PROFILE)
    ap.add_argument("--name", default=None)
    ap.add_argument("--bio", default=None)
    ap.add_argument("--followers", type=int)
    ap.add_argument("--connections", type=int)
    ap.add_argument("--likes", type=_int_list, default=[],
                    help="comma-separated reaction counts, last 5 posts e.g. 38,21,9,54,17")
    ap.add_argument("--comments", type=_int_list, default=[], help="optional, same order as --likes")
    ap.add_argument("--reposts", type=_int_list, default=[], help="optional, same order as --likes")
    ap.add_argument("--out", default="linkedin_presence_result.json")
    a = ap.parse_args()

    posts = [
        PostStat(
            urn=None, url=None, text=None, posted=None, activity_type="post",
            likes=lk,
            comments=a.comments[i] if i < len(a.comments) else None,
            reposts=a.reposts[i] if i < len(a.reposts) else None,
        )
        for i, lk in enumerate(a.likes)
    ]
    stats = ProfileStats(
        profile_url=a.profile,
        name=a.name,
        about=a.bio,
        followers=a.followers,
        connections=a.connections,
        connections_is_500_plus=bool(a.connections and a.connections >= 500),
        posts=posts,
    )
    score = compute_score(stats.followers, stats.connections, [p.likes for p in stats.posts])
    report = build_report(stats, score)

    Path(a.out).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n" + render_text(report))
    print(f"\nFull JSON -> {a.out}")


if __name__ == "__main__":
    main()
