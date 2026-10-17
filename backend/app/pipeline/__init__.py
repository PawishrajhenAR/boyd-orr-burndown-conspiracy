from __future__ import annotations

import pandas as pd

from app.models import Building, DataQualityIssue


def slug(name: str) -> str:
    """'Boyd Orr Building' -> 'boyd-orr-building'."""
    raise NotImplementedError


def parse_buildings(locations: pd.DataFrame, subjects: set[str]
                    ) -> tuple[list[Building], dict[str, list[str]], list[DataQualityIssue]]:
    """Returns (buildings, aliases {lowercase alias -> [building_id,...]}, issues). `subjects` = people-data subjects."""
    raise NotImplementedError
