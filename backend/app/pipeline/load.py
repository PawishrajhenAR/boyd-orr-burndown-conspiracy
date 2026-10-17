from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .statements import RawStatement, parse_statements

DEFAULT_FILES = {"people": "people_data.csv", "logs": "security_logs.csv",
                 "locations": "location_data.csv", "statements": "student_statements.txt"}
REQUIRED_COLUMNS = {
    "people": ["Student ID", "Name", "Age", "Sex", "Year of Study", "Subject", "Height", "Hair colour", "Societies"],
    "logs": ["Student ID", "Name", "Location", "Time"],
    "locations": ["Building Name", "Geolocation", "Opening Times", "Description"],
}


@dataclass
class RawData:
    people: pd.DataFrame          # all columns are str; truly empty cells are NaN; row number = index + 1
                                  # NOTE: the 38 "empty" societies are the literal text 'N/A' (kept as text for clean.py)
    logs: pd.DataFrame
    locations: pd.DataFrame
    statements: list[RawStatement]
    source_files: list[str]


def find_file(raw_dir: Path, key: str, filenames: dict[str, str] | None = None) -> Path:
    """Exact filename first, then 'stem*suffix' (so location_data_1.csv still works)."""
    name = (filenames or {}).get(key, DEFAULT_FILES[key])
    exact = raw_dir / name
    if exact.exists():
        return exact
    p = Path(name)
    hits = sorted(raw_dir.glob(f"{p.stem}*{p.suffix}"))
    if hits:
        return hits[0]
    raise FileNotFoundError(f"Could not find '{name}' (or '{p.stem}*{p.suffix}') in {raw_dir}")


def read_csv_clean(path: Path, key: str) -> pd.DataFrame:
    # dtype=str keeps leading zeros ("0900-1000"); only truly empty cells become NaN (not "NA"/"None" text)
    df = pd.read_csv(path, dtype=str, keep_default_na=False, na_values=[""], encoding="utf-8-sig")
    df.columns = [c.strip() for c in df.columns]
    missing = [c for c in REQUIRED_COLUMNS[key] if c not in df.columns]
    if missing:
        raise ValueError(f"{path.name}: missing columns {missing}; found {list(df.columns)}")
    return df.apply(lambda col: col.str.strip())


def load_raw(raw_dir: Path | str, filenames: dict[str, str] | None = None) -> RawData:
    raw_dir = Path(raw_dir)
    paths = {k: find_file(raw_dir, k, filenames) for k in DEFAULT_FILES}
    statements = parse_statements(paths["statements"].read_text(encoding="utf-8-sig"))
    return RawData(
        people=read_csv_clean(paths["people"], "people"),
        logs=read_csv_clean(paths["logs"], "logs"),
        locations=read_csv_clean(paths["locations"], "locations"),
        statements=statements,
        source_files=[p.name for p in paths.values()],
    )
