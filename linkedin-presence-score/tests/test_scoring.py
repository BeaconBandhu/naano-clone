"""Offline tests for the pure bits: the 0-100 score and the report shape.
No network, no Apify token needed.

    python -m pytest -q          (or)          python tests/test_scoring.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from linkedin_presence import build_report, compute_score, render_text
from linkedin_presence.models import PostStat, ProfileStats
from linkedin_presence.scoring import CONFIG, grade


def _stats(**kw) -> ProfileStats:
    base = dict(profile_url="https://www.linkedin.com/in/aranyabandhu/", name="Aranya Bandhu")
    base.update(kw)
    return ProfileStats(**base)


def test_score_is_bounded_and_adds_up():
    s = compute_score(followers=2369, connections=2257, post_likes=[71, 20, 6, 15, 10])
    assert 0 <= s.total <= 100
    assert s.connections_points == 20.0                      # >= 500 -> full marks
    assert s.inputs["num_posts_counted"] == 5
    assert s.inputs["total_likes"] == 122
    assert s.inputs["avg_likes"] == 24.4
    assert s.total == round(
        s.followers_points + s.connections_points + s.avg_likes_points + s.engagement_points, 1
    )


def test_none_likes_are_ignored_not_zero():
    s = compute_score(followers=1000, connections=100, post_likes=[50, None, 30, None, 40])
    assert s.inputs["num_posts_counted"] == 3
    assert s.inputs["avg_likes"] == 40.0


def test_zero_everything():
    s = compute_score(followers=None, connections=None, post_likes=[])
    assert s.total == 0.0
    assert grade(s.total) == "E"


def test_high_profile_scores_A_plus():
    s = compute_score(followers=60_000, connections=999, post_likes=[3000, 3200, 3100, 2900, 3300])
    assert s.followers_points == CONFIG["weights"]["followers"]
    assert s.connections_points == CONFIG["weights"]["connections"]
    assert s.avg_likes_points == CONFIG["weights"]["avg_likes"]
    assert s.engagement_points == CONFIG["weights"]["engagement_rate"]
    assert s.total == 100.0
    assert grade(s.total) == "A+"


def test_grade_bands():
    assert [grade(x) for x in (95, 80, 70, 60, 50, 10)] == ["A+", "A", "B", "C", "D", "E"]


def test_report_carries_bio_and_renders():
    stats = _stats(
        headline="AI Harness and Guardrailing Engineer",
        about="As an experienced professional with a proven track record ...",
        followers=2369, connections=2257, connections_is_500_plus=True,
        posts=[PostStat("urn:1", "u", "hi", "4d", "post", 71, 2, 0)],
    )
    score = compute_score(stats.followers, stats.connections, [p.likes for p in stats.posts])
    report = build_report(stats, score)
    assert report["profile"]["bio"].startswith("As an experienced")
    text = render_text(report)
    assert "Bio         :" in text
    assert "PRESENCE SCORE :" in text


if __name__ == "__main__":
    for _name, _fn in sorted(globals().items()):
        if _name.startswith("test_") and callable(_fn):
            _fn()
            print(f"ok  {_name}")
    print("all passed")
