from __future__ import annotations

import re

import pandas as pd

from app.models import Building, DataQualityIssue, Lecture

from .quality import issue

_GEO = re.compile(r"\{\s*(?P<lat>-?\d+(?:\.\d+)?)\s+(?P<lon>-?\d+(?:\.\d+)?)\s*\}")
_OPEN = re.compile(r"^\s*(?P<s>\d{4})\s*-\s*(?P<e>\d{4})\s*$")
_LECTURE = re.compile(
    r"(?P<subj>[A-Za-z ]+?) lectures (?:every day )?from (?P<s>\d{4}) (?:to|until) (?P<e>\d{4})",
    re.I,
)
_AGE = re.compile(r"over\s+(\d+)\s*s?\s+only", re.I)

# Hand-maintained nicknames → building name (resolved to id after slug).
# Values may be one name or a list (ambiguous aliases like "the union").
_HAND_ALIASES: dict[str, str | list[str]] = {
    "boydy": "Boyd Orr Building",
    "the boyd orr": "Boyd Orr Building",
    "boyd orr": "Boyd Orr Building",
    "kg": "Kelvingrove Park",
    "kelvin grove": "Kelvingrove Park",
    "kelvingrove": "Kelvingrove Park",
    "the park": "Kelvingrove Park",
    "park": "Kelvingrove Park",
    "hive": "The Hive",
    "the hive": "The Hive",
    "medicine building": "Wolfson Medical Building",
    "wolfson": "Wolfson Medical Building",
    "qmu": "Queen Margaret Union",
    "guu": "Glasgow University Union",
    "the union": ["Glasgow University Union", "Queen Margaret Union"],
    "union": ["Glasgow University Union", "Queen Margaret Union"],
    "st andrews": "St Andrews Building",
    "sir alwyn": "Sir Alwyn Williams Building",
    "adam smith": "Adam Smith Building",
    "james watt": "James Watt Building",
    "main building": "Main Building",
    "joseph black": "Joseph Black Building",
    "the library": "Library",
    "library": "Library",
    "kelvin building": "Kelvin Building",
    # note: plain "kelvin" is intentionally NOT an alias (would collide with kelvingrove)
}


def slug(name: str) -> str:
    """'Boyd Orr Building' -> 'boyd-orr-building'."""
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def _hhmm_to_min(hhmm: str) -> int:
    h, m = int(hhmm[:2]), int(hhmm[2:])
    return h * 60 + m


def _parse_opening(raw: str) -> tuple[int, int, bool, str]:
    m = _OPEN.match(raw.strip())
    if not m:
        raise ValueError(f"bad opening times: {raw!r}")
    s, e = m.group("s"), m.group("e")
    start, end = _hhmm_to_min(s), _hhmm_to_min(e)
    if s == "0000" and e == "0000":
        return 0, 2880, True, "0000-0000"
    if end <= start:
        end += 1440
    label = f"{s[:2]}:{s[2:]}-{e[:2]}:{e[2:]}"
    if end > 1440:
        label = f"{s[:2]}:{s[2:]}-{e[:2]}:{e[2:]} (+1)"
    return start, end, False, label


def _match_subject(captured: str, subjects: set[str]) -> str:
    """Pick the people-data subject the captured text ends with (longest wins)."""
    text = captured.strip().lower()
    best = None
    for subj in subjects:
        s = subj.lower()
        if text == s or text.endswith(s) or text.endswith(" " + s):
            if best is None or len(s) > len(best):
                best = subj
    return best if best is not None else captured.strip().title()


def parse_buildings(
    locations: pd.DataFrame, subjects: set[str]
) -> tuple[list[Building], dict[str, list[str]], list[DataQualityIssue]]:
    """Returns (buildings, aliases {lowercase alias -> [building_id,...]}, issues)."""
    buildings: list[Building] = []
    issues: list[DataQualityIssue] = []
    name_to_id: dict[str, str] = {}

    for i, row in locations.iterrows():
        row_num = int(i) + 1
        name = str(row["Building Name"]).strip()
        bid = slug(name)
        name_to_id[name] = bid
        name_to_id[name.lower()] = bid

        geo = _GEO.search(str(row["Geolocation"]))
        if not geo:
            raise ValueError(f"row {row_num}: bad geolocation {row['Geolocation']!r}")
        lat, lon = float(geo.group("lat")), float(geo.group("lon"))

        open_start, open_end, always_open, open_label = _parse_opening(str(row["Opening Times"]))
        desc = str(row["Description"]) if pd.notna(row["Description"]) else ""

        lectures: list[Lecture] = []
        for m in _LECTURE.finditer(desc):
            subj = _match_subject(m.group("subj"), subjects)
            lectures.append(
                Lecture(
                    subject=subj,
                    start=_hhmm_to_min(m.group("s")),
                    end=_hhmm_to_min(m.group("e")),
                    source="description",
                )
            )

        age_m = _AGE.search(desc)
        min_age = int(age_m.group(1)) if age_m else None

        aliases_list: list[str] = []
        # generic: full name, name without Building/Union suffixes
        aliases_list.append(name.lower())
        short = re.sub(r"\s+(building|union)\s*$", "", name, flags=re.I).strip().lower()
        if short and short != name.lower():
            aliases_list.append(short)

        buildings.append(
            Building(
                id=bid,
                name=name,
                lat=lat,
                lon=lon,
                open_start=open_start,
                open_end=open_end,
                always_open=always_open,
                open_label=open_label,
                lectures=lectures,
                min_age=min_age,
                description=desc,
                aliases=[],  # filled after hand aliases resolved
            )
        )

    # Build global alias map
    aliases: dict[str, list[str]] = {}

    def add_alias(key: str, bid: str) -> None:
        k = key.strip().lower()
        if not k:
            return
        # Guard: bare "kelvin" must not map to kelvingrove
        if k == "kelvin":
            return
        bucket = aliases.setdefault(k, [])
        if bid not in bucket:
            bucket.append(bid)

    for b in buildings:
        add_alias(b.name, b.id)
        short = re.sub(r"\s+(building|union)\s*$", "", b.name, flags=re.I).strip()
        add_alias(short, b.id)

    for alias, target in _HAND_ALIASES.items():
        names = target if isinstance(target, list) else [target]
        for n in names:
            bid = name_to_id.get(n) or name_to_id.get(n.lower())
            if bid is None:
                issues.append(
                    issue("location_data.csv", None, "aliases", "unknown_alias_target", alias, n)
                )
                continue
            add_alias(alias, bid)

    # Write per-building alias lists (keys that resolve uniquely or include this id)
    for b in buildings:
        own = sorted({k for k, ids in aliases.items() if b.id in ids})
        b.aliases = own

    return buildings, aliases, issues
