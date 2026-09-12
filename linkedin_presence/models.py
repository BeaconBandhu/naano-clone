"""Shared data models and a couple of URL helpers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import urlparse


@dataclass
class PostStat:
    urn: Optional[str]
    url: Optional[str]
    text: Optional[str]
    posted: Optional[str]
    activity_type: str
    likes: Optional[int]       # LinkedIn "reactions" total (Like + Celebrate + Support + ...)
    comments: Optional[int]
    reposts: Optional[int]


@dataclass
class ProfileStats:
    profile_url: str
    name: Optional[str] = None
    headline: Optional[str] = None
    about: Optional[str] = None
    followers: Optional[int] = None
    connections: Optional[int] = None
    connections_is_500_plus: bool = False
    posts: List[PostStat] = field(default_factory=list)


def profile_slug(url: str) -> str:
    """https://www.linkedin.com/in/aranyabandhu/  ->  'aranyabandhu'."""
    parts = urlparse(url).path.strip("/").split("/")
    if len(parts) >= 2 and parts[0] == "in":
        return parts[1]
    raise ValueError(f"not a /in/<slug> profile URL: {url!r}")


def normalize_profile_url(url: str) -> str:
    return f"https://www.linkedin.com/in/{profile_slug(url)}/"
