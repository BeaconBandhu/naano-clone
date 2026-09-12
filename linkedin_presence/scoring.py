"""Turn raw profile numbers into a single 0-100 "LinkedIn Presence Score".

The score is the sum of four components. Each component has a *weight* (its
maximum points) and a *target* (the input value that earns full points).
Reach-type inputs use a log curve so early growth is rewarded and huge
accounts don't run away with it; ratio-type inputs are linear.

    component        weight  curve    target (=full marks)
    ---------------  ------  -------  ----------------------------------
    followers          30    log10    50,000 followers
    connections        20    linear   500 connections (LinkedIn's cap)
    avg likes / post   30    log10    500 avg reactions over last N posts
    engagement rate    20    linear   5.0%  (avg likes / followers * 100)

Everything below is data - edit CONFIG to re-weight.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

CONFIG: Dict[str, Any] = {
    "weights": {
        "followers": 30,
        "connections": 20,
        "avg_likes": 30,
        "engagement_rate": 20,
    },
    "targets": {
        "followers": 50_000,
        "connections": 500,
        "avg_likes": 500,
        "engagement_rate_pct": 5.0,
    },
}


def _log_score(value: Optional[float], target: float, weight: float) -> float:
    if not value or value <= 0:
        return 0.0
    return min(weight, weight * math.log10(value + 1) / math.log10(target + 1))


def _linear_score(value: Optional[float], target: float, weight: float) -> float:
    if not value or value <= 0:
        return 0.0
    return min(weight, weight * value / target)


@dataclass
class ScoreBreakdown:
    followers_points: float
    connections_points: float
    avg_likes_points: float
    engagement_points: float
    total: float
    inputs: Dict[str, Any]


def compute_score(
    followers: Optional[int],
    connections: Optional[int],
    post_likes: Iterable[Optional[int]],
    config: Dict[str, Any] = CONFIG,
) -> ScoreBreakdown:
    w, t = config["weights"], config["targets"]

    likes: List[float] = [float(x) for x in post_likes if isinstance(x, (int, float))]
    total_likes = int(sum(likes))
    avg_likes = (sum(likes) / len(likes)) if likes else 0.0
    engagement_pct = (avg_likes / followers * 100) if followers else 0.0

    # round each component first so the printed breakdown always adds up to `total`
    f_pts = round(_log_score(followers, t["followers"], w["followers"]), 1)
    c_pts = round(_linear_score(connections, t["connections"], w["connections"]), 1)
    l_pts = round(_log_score(avg_likes, t["avg_likes"], w["avg_likes"]), 1)
    e_pts = round(_linear_score(engagement_pct, t["engagement_rate_pct"], w["engagement_rate"]), 1)

    total = round(min(100.0, f_pts + c_pts + l_pts + e_pts), 1)

    return ScoreBreakdown(
        followers_points=f_pts,
        connections_points=c_pts,
        avg_likes_points=l_pts,
        engagement_points=e_pts,
        total=total,
        inputs={
            "followers": followers,
            "connections": connections,
            "num_posts_counted": len(likes),
            "total_likes": total_likes,
            "avg_likes": round(avg_likes, 1),
            "engagement_rate_pct": round(engagement_pct, 2),
        },
    )


def grade(total: float) -> str:
    for cutoff, letter in ((90, "A+"), (80, "A"), (70, "B"), (60, "C"), (50, "D")):
        if total >= cutoff:
            return letter
    return "E"
