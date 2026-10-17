from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

from app.models import Building, DataQualityIssue, Statement, Student, Visit

from .load import load_raw
from .quality import summarise


@dataclass
class CleanData:
    buildings: list[Building]
    students: list[Student]
    visits: list[Visit]
    statements: list[Statement]            # claims=[] (P2 fills claims)
    data_quality: list[DataQualityIssue]
    aliases: dict[str, list[str]]          # lowercase alias -> building_ids


def run_pipeline(raw_dir: Path) -> CleanData:
    """STUB until H6: only loading works so far (steps 2-5 raise NotImplementedError)."""
    load_raw(raw_dir)
    raise NotImplementedError("pipeline steps 2-5 not built yet")


def main() -> None:
    raw_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[3] / "data" / "raw"
    data = run_pipeline(raw_dir)
    print(f"{len(data.buildings)} buildings, {len(data.students)} students, {len(data.visits)} visits, "
          f"{len(data.statements)} statements")
    for kind, n in sorted(summarise(data.data_quality).items()):
        print(f"  {kind}: {n}")


if __name__ == "__main__":
    main()
