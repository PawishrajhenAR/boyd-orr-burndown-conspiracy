from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

from app.models import Building, DataQualityIssue, Statement, Student, Visit

from .buildings import parse_buildings
from .clean import assign_lectures, clean_students, clean_visits
from .load import load_raw
from .quality import summarise
from .statements import resolve_statements


@dataclass
class CleanData:
    buildings: list[Building]
    students: list[Student]
    visits: list[Visit]
    statements: list[Statement]            # claims=[] (P2 fills claims)
    data_quality: list[DataQualityIssue]
    aliases: dict[str, list[str]]          # lowercase alias -> building_ids


def run_pipeline(raw_dir: Path) -> CleanData:
    """Load → buildings → clean students/visits → lectures → statements → quality."""
    raw = load_raw(raw_dir)
    subjects = {str(s).strip() for s in raw.people["Subject"].dropna().unique()}

    buildings, aliases, b_issues = parse_buildings(raw.locations, subjects)
    students, s_issues = clean_students(raw.people)
    visits, v_issues = clean_visits(raw.logs, buildings, aliases, students)
    lec_issues = assign_lectures(students, buildings, visits)
    statements, st_issues = resolve_statements(raw.statements, students)

    data_quality = [*b_issues, *s_issues, *v_issues, *lec_issues, *st_issues]
    return CleanData(
        buildings=buildings,
        students=students,
        visits=visits,
        statements=statements,
        data_quality=data_quality,
        aliases=aliases,
    )


def main() -> None:
    raw_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[3] / "data" / "raw"
    data = run_pipeline(raw_dir)
    print(f"{len(data.buildings)} buildings, {len(data.students)} students, {len(data.visits)} visits, "
          f"{len(data.statements)} statements")
    for kind, n in sorted(summarise(data.data_quality).items()):
        print(f"  {kind}: {n}")


if __name__ == "__main__":
    main()
