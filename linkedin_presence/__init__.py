"""Scrape a LinkedIn profile via Apify and score its presence out of 100."""

from .apify_client import ApifyError, scrape_via_apify
from .models import PostStat, ProfileStats
from .report import build_report, render_text
from .scoring import CONFIG, ScoreBreakdown, compute_score, grade

__all__ = [
    "scrape_via_apify",
    "ApifyError",
    "ProfileStats",
    "PostStat",
    "compute_score",
    "ScoreBreakdown",
    "grade",
    "CONFIG",
    "build_report",
    "render_text",
]
