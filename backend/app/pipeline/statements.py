from __future__ import annotations

import re
from dataclasses import dataclass

from app.models import DataQualityIssue, Statement, Student

from .quality import issue

_HEAD = re.compile(r"Student Number:\s*(?P<id>\S+)", re.I)
_TRAILING_HEADER = re.compile(r"\s*Statement\s+\d+\s*$", re.I)
_NUMBER = re.compile(r"Statement\s+(\d+)\s*$", re.I)
_NAME = re.compile(r"^\s*(?:Student\s+)?Name:\s*(.+?)\s*$", re.I | re.M)
_TESTIMONY = re.compile(r"Testimony:\s*", re.I)


@dataclass
class RawStatement:
    index: int              # 1-based position in the file (the written numbers are NOT unique)
    number: int | None      # the "Statement N" number as written (statement 6 appears twice!)
    raw_student_id: str     # exactly as written, e.g. "2813225b"
    name: str
    text: str


def parse_statements(text: str) -> list[RawStatement]:
    """Split on 'Student Number:'. Accepts 'Name:' and 'Student Name:'. Text is kept verbatim (trimmed)."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    heads = list(_HEAD.finditer(text))
    out: list[RawStatement] = []
    for i, m in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        body = _TRAILING_HEADER.sub("", text[m.end():end])   # drop next block's "Statement N" line
        before = text[(heads[i - 1].end() if i else 0):m.start()].rstrip()
        num = _NUMBER.search(before)
        t = _TESTIMONY.search(body)
        n = _NAME.search(body[: t.start()]) if t else None
        if not (t and n):
            raise ValueError(f"Statement #{i + 1} ({m.group('id')}): missing 'Name:' or 'Testimony:'")
        out.append(RawStatement(i + 1, int(num.group(1)) if num else None, m.group("id"),
                                n.group(1), body[t.end():].strip()))
    return out


def resolve_statements(
    raw: list[RawStatement], students: list[Student]
) -> tuple[list[Statement], list[DataQualityIssue]]:
    """Uppercase ID, name-match unknown IDs -> id_format / id_mismatch / unknown_id issues."""
    by_id = {s.id: s for s in students}
    by_name: dict[str, list[Student]] = {}
    for s in students:
        by_name.setdefault(s.name.lower(), []).append(s)

    statements: list[Statement] = []
    issues: list[DataQualityIssue] = []

    for rs in raw:
        original = rs.raw_student_id.strip()
        upper = original.upper()
        if upper != original:
            issues.append(
                issue(
                    "student_statements.txt",
                    rs.index,
                    "Student Number",
                    "id_format",
                    original,
                    upper,
                )
            )

        if upper in by_id:
            sid = upper
            if original != upper and original not in by_id[sid].raw_ids:
                by_id[sid].raw_ids.append(original)
        else:
            matches = by_name.get(rs.name.strip().lower(), [])
            if len(matches) == 1:
                sid = matches[0].id
                if upper not in matches[0].raw_ids:
                    matches[0].raw_ids.append(upper)
                if original not in matches[0].raw_ids:
                    matches[0].raw_ids.append(original)
                issues.append(
                    issue(
                        "student_statements.txt",
                        rs.index,
                        "Student Number",
                        "id_mismatch",
                        upper,
                        sid,
                    )
                )
            else:
                sid = upper
                issues.append(
                    issue(
                        "student_statements.txt",
                        rs.index,
                        "Student Number",
                        "unknown_id",
                        upper,
                        upper,
                    )
                )

        if sid in by_id:
            by_id[sid].has_statement = True

        statements.append(
            Statement(
                student_id=sid,
                raw_student_id=original,
                name=rs.name.strip(),
                text=rs.text,
                claims=[],
            )
        )

    return statements, issues
