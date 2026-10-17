from __future__ import annotations

import pandas as pd

from app.models import Building, DataQualityIssue, Student, Visit


def clean_students(people: pd.DataFrame) -> tuple[list[Student], list[DataQualityIssue]]:
    """Uppercase IDs, parse societies (list/set/NaN/duplicates). Lecture fields are filled later."""
    raise NotImplementedError


def clean_visits(logs: pd.DataFrame, buildings: list[Building], aliases: dict[str, list[str]],
                 students: list[Student]) -> tuple[list[Visit], list[DataQualityIssue]]:
    """IDs (id_format / id_mismatch / unknown_id), locations (typo fix), times (minutes, midnight wrap), ids v0001..."""
    raise NotImplementedError


def assign_lectures(students: list[Student], buildings: list[Building], visits: list[Visit]
                    ) -> list[DataQualityIssue]:
    """Fills Student.lecture / lecture_building_id in place; infers real slot from logs. Returns issues."""
    raise NotImplementedError