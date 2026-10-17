from __future__ import annotations

from collections import Counter

from app.models import DataQualityIssue


def issue(file: str, row: int | None, column: str, kind: str, original: str, fixed: str) -> DataQualityIssue:
    """row = 1-based data row (header excluded); None for whole-file issues."""
    return DataQualityIssue(file=file, row=row, column=column, issue=kind, original=str(original), fixed=str(fixed))


def summarise(issues: list[DataQualityIssue]) -> dict[str, int]:
    return dict(Counter(i.issue for i in issues))
