"""Scrape a LinkedIn profile through Apify - no browser, no cookies, no login.

Two HarvestAPI actors do the work:
  harvestapi/linkedin-profile-scraper  -> name, headline, bio, followers, connections
  harvestapi/linkedin-profile-posts    -> recent posts + reaction / comment counts

Needs an Apify API token (env APIFY_TOKEN, or pass one in). Cost is a few cents
per run (~$0.004 per profile + ~$0.002 per post). Apify runs the infrastructure
and carries the direct ToS exposure - which is not a licence to point it at
profiles you have no business scraping.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from apify_client import ApifyClient

from .models import PostStat, ProfileStats, normalize_profile_url

logger = logging.getLogger(__name__)

PROFILE_ACTOR = "harvestapi/linkedin-profile-scraper"
POSTS_ACTOR = "harvestapi/linkedin-profile-posts"
PROFILE_MODE = "Profile details no email ($4 per 1k)"


class ApifyError(RuntimeError):
    """Missing token, failed actor run, or empty result."""


def _run_items(client: ApifyClient, run: Any, what: str) -> list:
    status = run["status"] if isinstance(run, dict) else run.status
    dataset_id = run["defaultDatasetId"] if isinstance(run, dict) else run.default_dataset_id
    if status != "SUCCEEDED":
        raise ApifyError(f"{what} actor run ended with status {status}")
    return list(client.dataset(dataset_id).iterate_items())


def _as_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except ValueError:
            return {}
    return {}


def _tidy_name(first: Any, last: Any) -> Optional[str]:
    name = " ".join(str(x) for x in (first, last) if x).strip()
    if not name:
        return None
    return name.title() if name.isupper() else name


def scrape_via_apify(
    profile_url: str,
    num_posts: int,
    token: str,
    include_posts: bool = True,
) -> ProfileStats:
    if not token:
        raise ApifyError("no Apify token - set APIFY_TOKEN or pass --apify-token.")

    url = normalize_profile_url(profile_url)
    client = ApifyClient(token)

    # --- profile: name, headline, bio, followers, connections ----------
    profile_run = client.actor(PROFILE_ACTOR).call(
        run_input={"urls": [url], "profileScraperMode": PROFILE_MODE}
    )
    profile_items = _run_items(client, profile_run, "profile")
    if not profile_items:
        raise ApifyError("profile actor returned nothing (private / not found / blocked).")
    p = profile_items[0]

    connections = _as_int(p.get("connectionsCount"))
    stats = ProfileStats(
        profile_url=url,
        name=_tidy_name(p.get("firstName"), p.get("lastName")),
        headline=p.get("headline"),
        about=p.get("about") or None,
        followers=_as_int(p.get("followerCount") or p.get("followersCount")),
        connections=connections,
        connections_is_500_plus=bool(connections and connections >= 500),
    )

    # --- posts --------------------------------------------------------
    if include_posts and num_posts > 0:
        posts_run = client.actor(POSTS_ACTOR).call(
            run_input={"targetUrls": [url], "maxPosts": num_posts}
        )
        rows = []
        for it in _run_items(client, posts_run, "posts"):
            if not isinstance(it, dict):
                continue
            engagement = _as_dict(it.get("engagement"))
            posted = _as_dict(it.get("postedAt"))
            rows.append((
                posted.get("timestamp") or 0,
                PostStat(
                    urn=str(it.get("id")) if it.get("id") else None,
                    url=it.get("linkedinUrl") or it.get("shareLinkedinUrl"),
                    text=it.get("content") if isinstance(it.get("content"), str) else None,
                    posted=posted.get("postedAgoShort") or posted.get("date"),
                    activity_type=it.get("type") or "post",
                    likes=_as_int(engagement.get("likes") or engagement.get("reactionsCount")),
                    comments=_as_int(engagement.get("comments")),
                    reposts=_as_int(engagement.get("shares") or engagement.get("reposts")),
                ),
            ))
        rows.sort(key=lambda r: r[0], reverse=True)  # newest first
        stats.posts = [post for _, post in rows[:num_posts]]

    return stats
