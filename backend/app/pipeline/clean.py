from __future__ import annotations

import ast
import re
from collections import Counter

import pandas as pd

from app.models import Building, DataQualityIssue, Lecture, Student, Visit

from .quality import issue

_TIME = re.compile(r"^\s*(?P<s>\d{4})\s*-\s*(?P<e>\d{4})\s*$")


def _hhmm_to_min(hhmm: str) -> int:
    return int(hhmm[:2]) * 60 + int(hhmm[2:])


def parse_time_range(raw: str) -> tuple[int, int]:
    m = _TIME.match(str(raw).strip())
    if not m:
        raise ValueError(f"bad time range: {raw!r}")
    start, end = _hhmm_to_min(m.group("s")), _hhmm_to_min(m.group("e"))
    if end <= start:
        end += 1440
    return start, end


def _parse_societies(raw, row_num: int) -> tuple[list[str], list[DataQualityIssue]]:
    issues: list[DataQualityIssue] = []
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        issues.append(
            issue("people_data.csv", row_num, "Societies", "empty_societies", "", "[]")
        )
        return [], issues
    text = str(raw).strip()
    if text == "" or text.upper() == "N/A":
        issues.append(
            issue("people_data.csv", row_num, "Societies", "empty_societies", text, "[]")
        )
        return [], issues

    try:
        val = ast.literal_eval(text)
    except (ValueError, SyntaxError):
        issues.append(
            issue("people_data.csv", row_num, "Societies", "bad_societies", text, "[]")
        )
        return [], issues

    set_syntax = isinstance(val, set) or text.startswith("{")
    if isinstance(val, set):
        items = list(val)
    elif isinstance(val, list):
        items = list(val)
    else:
        issues.append(
            issue("people_data.csv", row_num, "Societies", "bad_societies", text, "[]")
        )
        return [], issues

    cleaned = [str(x).strip() for x in items if str(x).strip()]
    unique = sorted(set(cleaned))
    if set_syntax:
        issues.append(
            issue("people_data.csv", row_num, "Societies", "set_syntax", text, str(unique))
        )
    if len(cleaned) != len(unique):
        issues.append(
            issue(
                "people_data.csv",
                row_num,
                "Societies",
                "duplicate_societies",
                text,
                str(unique),
            )
        )
    return unique, issues


def clean_students(people: pd.DataFrame) -> tuple[list[Student], list[DataQualityIssue]]:
    """Uppercase IDs, parse societies. Lecture fields filled later."""
    students: list[Student] = []
    issues: list[DataQualityIssue] = []

    for i, row in people.iterrows():
        row_num = int(i) + 1
        raw_id = str(row["Student ID"]).strip()
        sid = raw_id.upper()
        if sid != raw_id:
            issues.append(
                issue("people_data.csv", row_num, "Student ID", "id_format", raw_id, sid)
            )

        societies, soc_issues = _parse_societies(row.get("Societies"), row_num)
        issues.extend(soc_issues)

        students.append(
            Student(
                id=sid,
                name=str(row["Name"]).strip(),
                age=int(row["Age"]),
                sex=str(row["Sex"]).strip(),
                year=int(row["Year of Study"]),
                subject=str(row["Subject"]).strip(),
                height=int(float(row["Height"])),
                hair_colour=str(row["Hair colour"]).strip(),
                societies=societies,
                has_statement=False,
                raw_ids=[sid] if sid == raw_id else [sid, raw_id],
                lecture=None,
                lecture_building_id=None,
            )
        )
    return students, issues


def _resolve_student_id(
    raw_id: str,
    name: str,
    by_id: dict[str, Student],
    by_name: dict[str, list[Student]],
    file: str,
    row_num: int,
    column: str,
) -> tuple[str, list[DataQualityIssue]]:
    issues: list[DataQualityIssue] = []
    original = raw_id.strip()
    upper = original.upper()
    if upper != original:
        issues.append(issue(file, row_num, column, "id_format", original, upper))

    if upper in by_id:
        # Keep the as-written form so P2 can flag id_format (e.g. 2813225b)
        if original != upper and original not in by_id[upper].raw_ids:
            by_id[upper].raw_ids.append(original)
        return upper, issues

    matches = by_name.get(name.strip().lower(), [])
    if len(matches) == 1:
        real = matches[0]
        if upper not in real.raw_ids:
            real.raw_ids.append(upper)
        if original not in real.raw_ids:
            real.raw_ids.append(original)
        issues.append(issue(file, row_num, column, "id_mismatch", upper, real.id))
        return real.id, issues

    issues.append(issue(file, row_num, column, "unknown_id", upper, upper))
    return upper, issues


def _resolve_building(
    raw_location: str,
    buildings: list[Building],
    aliases: dict[str, list[str]],
    file: str,
    row_num: int,
) -> tuple[str, list[DataQualityIssue]]:
    import difflib

    issues: list[DataQualityIssue] = []
    loc = raw_location.strip()
    by_name = {b.name.lower(): b.id for b in buildings}

    if loc.lower() in by_name:
        return by_name[loc.lower()], issues

    names = [b.name for b in buildings]
    close = difflib.get_close_matches(loc, names, n=1, cutoff=0.6)
    if close:
        bid = by_name[close[0].lower()]
        issues.append(issue(file, row_num, "Location", "location_typo", loc, close[0]))
        return bid, issues

    hits = aliases.get(loc.lower(), [])
    if len(hits) == 1:
        return hits[0], issues
    if len(hits) > 1:
        issues.append(
            issue(file, row_num, "Location", "ambiguous_location", loc, ",".join(hits))
        )
        return hits[0], issues

    issues.append(issue(file, row_num, "Location", "unknown_location", loc, loc))
    s = loc.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s, issues


def clean_visits(
    logs: pd.DataFrame,
    buildings: list[Building],
    aliases: dict[str, list[str]],
    students: list[Student],
) -> tuple[list[Visit], list[DataQualityIssue]]:
    by_id = {s.id: s for s in students}
    by_name: dict[str, list[Student]] = {}
    for s in students:
        by_name.setdefault(s.name.lower(), []).append(s)

    visits: list[Visit] = []
    issues: list[DataQualityIssue] = []

    for i, row in logs.iterrows():
        row_num = int(i) + 1
        raw_sid = str(row["Student ID"]).strip()
        name = str(row["Name"]).strip()
        raw_loc = str(row["Location"]).strip()
        raw_time = str(row["Time"]).strip()

        sid, id_issues = _resolve_student_id(
            raw_sid, name, by_id, by_name, "security_logs.csv", row_num, "Student ID"
        )
        issues.extend(id_issues)

        bid, loc_issues = _resolve_building(
            raw_loc, buildings, aliases, "security_logs.csv", row_num
        )
        issues.extend(loc_issues)

        start, end = parse_time_range(raw_time)
        visits.append(
            Visit(
                id=f"v{len(visits) + 1:04d}",
                student_id=sid,
                building_id=bid,
                start=start,
                end=end,
                raw_time=raw_time,
                raw_student_id=raw_sid,
                raw_location=raw_loc,
            )
        )

    return visits, issues


def assign_lectures(
    students: list[Student], buildings: list[Building], visits: list[Visit]
) -> list[DataQualityIssue]:
    """Fill Student.lecture / lecture_building_id; infer real slot from logs."""
    issues: list[DataQualityIssue] = []

    subject_map: dict[str, tuple[str, Lecture]] = {}
    for b in buildings:
        for lec in b.lectures:
            subject_map[lec.subject.lower()] = (b.id, lec)

    for subj_lower, (bid, desc_lec) in subject_map.items():
        pairs: list[tuple[int, int]] = []
        for s in students:
            if s.subject.lower() != subj_lower:
                continue
            for v in visits:
                if (
                    v.student_id == s.id
                    and v.building_id == bid
                    and v.start < desc_lec.end
                    and v.end > desc_lec.start
                ):
                    pairs.append((v.start, v.end))

        if pairs:
            (start, end), _ = Counter(pairs).most_common(1)[0]
            if (start, end) != (desc_lec.start, desc_lec.end):
                lec = Lecture(
                    subject=desc_lec.subject, start=start, end=end, source="inferred"
                )
                issues.append(
                    issue(
                        "location_data.csv",
                        None,
                        "Description",
                        "lecture_time_differs_from_logs",
                        f"{desc_lec.subject} {desc_lec.start}-{desc_lec.end}",
                        f"{desc_lec.subject} {start}-{end}",
                    )
                )
            else:
                lec = desc_lec.model_copy()
        else:
            lec = desc_lec.model_copy()

        for s in students:
            if s.subject.lower() == subj_lower:
                s.lecture = lec.model_copy()
                s.lecture_building_id = bid

    for s in students:
        if s.subject.lower() not in subject_map:
            s.lecture = None
            s.lecture_building_id = None

    return issues
