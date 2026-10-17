from __future__ import annotations

import re
from dataclasses import dataclass

from app.models import DataQualityIssue, Statement, Student

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


def resolve_statements(raw: list[RawStatement], students: list[Student]
                       ) -> tuple[list[Statement], list[DataQualityIssue]]:
    """STEP 3 (stub): uppercase ID, name-match unknown IDs -> id_format / id_mismatch / unknown_id issues."""
    raise NotImplementedError
