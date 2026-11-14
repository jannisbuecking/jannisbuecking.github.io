"""Fetch the public GitHub contribution calendar without credentials or dependencies."""

import argparse
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen


USERNAME = "jannisbuecking"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "contributions.json"


class ContributionParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cells = {}
        self.labels = {}
        self.tooltip_for = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "td" and "data-date" in attrs:
            self.cells[attrs["id"]] = {
                "date": attrs["data-date"],
                "level": int(attrs["data-level"]),
            }
        elif tag == "tool-tip":
            self.tooltip_for = attrs.get("for")

    def handle_data(self, text):
        if self.tooltip_for:
            self.labels[self.tooltip_for] = self.labels.get(self.tooltip_for, "") + text

    def handle_endtag(self, tag):
        if tag == "tool-tip":
            self.tooltip_for = None


def parse_calendar(html):
    parser = ContributionParser()
    parser.feed(html)
    days = []
    for cell_id, cell in parser.cells.items():
        label = parser.labels.get(cell_id, "").strip()
        match = re.search(r"\b([\d,]+) contributions?\b", label)
        if match:
            count = int(match.group(1).replace(",", ""))
        elif label.startswith("No contributions"):
            count = 0
        else:
            raise ValueError(f"Missing contribution count for {cell['date']}")
        if not 0 <= cell["level"] <= 4 or (count == 0) != (cell["level"] == 0):
            raise ValueError(f"Invalid contribution intensity for {cell['date']}")
        days.append({**cell, "count": count})

    days.sort(key=lambda day: day["date"])
    if not 350 <= len(days) <= 378:
        raise ValueError(f"Expected a full year of activity; received {len(days)} days")
    dates = [date.fromisoformat(day["date"]) for day in days]
    if any(right - left != timedelta(days=1) for left, right in zip(dates, dates[1:])):
        raise ValueError("Contribution dates must be consecutive and unique")
    return days


def fetch_calendar():
    request = Request(
        f"https://github.com/users/{USERNAME}/contributions",
        headers={"User-Agent": f"{USERNAME}-personal-website", "Accept": "text/html"},
    )
    for attempt in range(3):
        try:
            with urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8")
        except OSError:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def main():
    arguments = argparse.ArgumentParser(description=__doc__)
    arguments.add_argument("--input", type=Path, help="Read saved GitHub HTML for an offline refresh")
    args = arguments.parse_args()
    html = args.input.read_text() if args.input else fetch_calendar()
    days = parse_calendar(html)
    data = {
        "username": USERNAME,
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": sum(day["count"] for day in days),
        "days": days,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Updated {len(days)} days: {data['total']} contributions")


if __name__ == "__main__":
    main()
