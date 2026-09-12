"""Assemble the scraped stats + score into a JSON-able dict and a text report."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from .models import ProfileStats
from .scoring import CONFIG, ScoreBreakdown, grade


def _fmt(v: Any) -> str:
    return "n/a" if v is None else (f"{v:,}" if isinstance(v, (int, float)) else str(v))


def _clip(text: str | None, n: int) -> str | None:
    if not text:
        return None
    text = " ".join(text.split())
    return text if len(text) <= n else text[:n].rstrip() + "…"


def build_report(stats: ProfileStats, score: ScoreBreakdown) -> Dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "url": stats.profile_url,
            "name": stats.name,
            "headline": stats.headline,
            "bio": stats.about,
        },
        "metrics": {
            "followers": stats.followers,
            "connections": stats.connections,
            "connections_display": "500+" if stats.connections_is_500_plus else stats.connections,
        },
        "posts": [
            {
                "rank": i + 1,
                "type": p.activity_type,
                "url": p.url,
                "posted": p.posted,
                "likes": p.likes,
                "comments": p.comments,
                "reposts": p.reposts,
                "text_preview": _clip(p.text, 140),
            }
            for i, p in enumerate(stats.posts)
        ],
        "score": {
            "total_out_of_100": score.total,
            "grade": grade(score.total),
            "breakdown_points": {
                "followers": score.followers_points,
                "connections": score.connections_points,
                "avg_likes": score.avg_likes_points,
                "engagement_rate": score.engagement_points,
            },
            "derived": score.inputs,
            "config": CONFIG,
        },
        "notes": [
            "'likes' is LinkedIn's total reactions count (Like + Celebrate + Support + "
            "Love + Insightful + Funny); LinkedIn exposes no Like-only number.",
            "'500+' connections is recorded as 500.",
            "data via Apify actors harvestapi/linkedin-profile-scraper + "
            "harvestapi/linkedin-profile-posts; fields can be null if the actor "
            "output shape changes.",
        ],
    }


def render_text(r: Dict[str, Any]) -> str:
    p, m, s = r["profile"], r["metrics"], r["score"]
    d, b = s["derived"], s["breakdown_points"]
    w = CONFIG["weights"]
    L = []
    L.append("=" * 64)
    L.append(f" LinkedIn Presence Report - {p['name'] or p['url']}")
    L.append("=" * 64)
    L.append(f" Profile     : {p['url']}")
    if p["headline"]:
        L.append(f" Headline    : {_clip(p['headline'], 100)}")
    if p["bio"]:
        L.append(f" Bio         : {_clip(p['bio'], 280)}")
    L.append("")
    L.append(f" Followers   : {_fmt(m['followers'])}")
    L.append(f" Connections : {_fmt(m['connections_display'])}")
    L.append("")
    L.append(f" Last {len(r['posts'])} posts:")
    row = "   {:<3}{:<9}{:>8}{:>10}{:>9}  {}"
    L.append(row.format("#", "type", "likes", "comments", "reposts", "posted"))
    L.append(row.format("-" * 3, "-" * 8, "-" * 7, "-" * 9, "-" * 8, "-" * 12))
    for post in r["posts"]:
        L.append(row.format(
            post["rank"], post["type"],
            _fmt(post["likes"]), _fmt(post["comments"]), _fmt(post["reposts"]),
            post["posted"] or "",
        ))
    if not r["posts"]:
        L.append("   (no posts found)")
    L.append("")
    L.append(f" Total likes over {d['num_posts_counted']} post(s) : {_fmt(d['total_likes'])}")
    L.append(f" Average likes / post              : {d['avg_likes']}")
    L.append(f" Engagement rate (avg likes / followers) : {d['engagement_rate_pct']}%")
    L.append("")
    L.append(" Score breakdown (points earned / max):")
    L.append(f"   Followers        {b['followers']:>6.1f} / {w['followers']}")
    L.append(f"   Connections      {b['connections']:>6.1f} / {w['connections']}")
    L.append(f"   Avg likes/post   {b['avg_likes']:>6.1f} / {w['avg_likes']}")
    L.append(f"   Engagement rate  {b['engagement_rate']:>6.1f} / {w['engagement_rate']}")
    L.append("")
    L.append("-" * 64)
    L.append(f" PRESENCE SCORE : {s['total_out_of_100']} / 100   (grade {s['grade']})")
    L.append("-" * 64)
    return "\n".join(L)
