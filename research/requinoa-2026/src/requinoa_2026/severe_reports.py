"""Candidate severe-weather reports from regional media, for a human to confirm.

Run with:  uv run requinoa-severe-reports

The severe level has one confirmed case (Requínoa, 2026-10-26). To score it we need the
other days when hail, damaging wind or a tornado really happened in O'Higgins. This
searches El Rancagüino's public WordPress API for those words since GOES-19 became
GOES-East, and writes every match to ground_truth/severe_candidates.csv.

A match is only a candidate: forecasts, anniversaries and stories from other regions use
the same words. Someone must read each one and fill a confirmed-events file by hand.
"""

import html
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import date

import pandas as pd

from requinoa_2026.config import PROJECT_ROOT

API = "https://www.elrancaguino.cl/wp-json/wp/v2/posts"
# GOES-19 became GOES-East on this day; earlier storms cannot be replayed.
SINCE = date(2025, 4, 7)
KEYWORDS = ["granizo", "granizada", "tornado", "tromba", "tormenta eléctrica", "voladura de techos", "vientos fuertes"]
PER_PAGE = 100
# The site answers 403 to user agents it does not recognise (seen 2026-11-10).
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
OUT = PROJECT_ROOT / "ground_truth" / "severe_candidates.csv"


def clean(text: str) -> str:
    """Plain text from WordPress's rendered HTML."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text))).strip()


def search_url(keyword: str, page: int, since: date = SINCE) -> str:
    query = {
        "search": keyword,
        "after": f"{since.isoformat()}T00:00:00",
        "per_page": PER_PAGE,
        "page": page,
        "orderby": "date",
        "order": "asc",
        "_fields": "date,title,link,excerpt",
    }
    return f"{API}?{urllib.parse.urlencode(query)}"


def parse(posts: list[dict], keyword: str) -> list[dict]:
    return [
        {
            "published_local": post["date"].replace("T", " ")[:16],
            "keyword": keyword,
            "title": clean(post["title"]["rendered"]),
            "excerpt": clean(post.get("excerpt", {}).get("rendered", ""))[:300],
            "link": post["link"],
        }
        for post in posts
    ]


def merge(rows: list[dict]) -> pd.DataFrame:
    """One row per article, with every keyword that found it, oldest first."""
    if not rows:
        return pd.DataFrame(columns=["published_local", "keywords", "title", "excerpt", "link"])
    table = pd.DataFrame(rows)
    keywords = table.groupby("link")["keyword"].agg(lambda words: "; ".join(sorted(set(words)))).rename("keywords")
    merged = table.drop(columns="keyword").drop_duplicates("link").join(keywords, on="link")
    return merged.sort_values("published_local")[["published_local", "keywords", "title", "excerpt", "link"]].reset_index(drop=True)


def fetch(keyword: str) -> list[dict]:
    rows, page = [], 1
    while True:
        request = urllib.request.Request(search_url(keyword, page), headers=HEADERS)
        with urllib.request.urlopen(request, timeout=30) as response:
            pages = int(response.headers.get("X-WP-TotalPages", "1"))
            rows += parse(json.load(response), keyword)
        if page >= pages:
            return rows
        page += 1
        time.sleep(1)  # a small newsroom's server: do not hurry it


def main() -> None:
    rows = []
    for keyword in KEYWORDS:
        found = fetch(keyword)
        print(f"{keyword}: {len(found)} articles")
        rows += found
    table = merge(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(OUT, index=False)
    print(f"{len(table)} candidate articles since {SINCE} -> {OUT}")


if __name__ == "__main__":
    main()
