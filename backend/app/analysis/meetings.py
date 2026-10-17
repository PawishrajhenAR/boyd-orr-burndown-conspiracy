"""

Two different students "met" if they were in the same building with
overlapping times for at least MIN_MEETING_MINUTES.

Algorithm: a *sweep line*. For each building we walk through its visits in
start-time order, keeping an "active" list of visits that haven't ended yet.
Each new visit is only compared with the active ones, instead of with every
other visit in the dataset, which keeps it fast even with thousands of logs.
"""
from collections import defaultdict

from app.analysis.timeutil import overlap
from app.config import RuleConfig, rule_config as default_config
from app.models import Meeting, Visit
from app.pipeline.run import CleanData


def find_meetings(clean: CleanData, config: RuleConfig = default_config) -> list[Meeting]:
    by_building: dict[str, list[Visit]] = defaultdict(list)
    for v in clean.visits:
        by_building[v.building_id].append(v)

    meetings: list[Meeting] = []
    for building_id in sorted(by_building):
        visits = sorted(by_building[building_id], key=lambda v: (v.start, v.end))
        active: list[Visit] = []
        for v in visits:
            active = [a for a in active if a.end > v.start]          # drop visits that already ended
            for a in active:
                if a.student_id == v.student_id:
                    continue                                          # can't meet yourself
                mins = overlap(a.start, a.end, v.start, v.end)
                if mins >= config.MIN_MEETING_MINUTES:
                    first, second = sorted([a.student_id, v.student_id])
                    meetings.append(Meeting(
                        id="", a=first, b=second, building_id=building_id,
                        start=max(a.start, v.start), end=min(a.end, v.end), minutes=mins))
            active.append(v)

    meetings.sort(key=lambda m: (m.start, m.building_id, m.a, m.b))
    return [m.model_copy(update={"id": f"m{i:05d}"}) for i, m in enumerate(meetings, start=1)]


def contacts(meetings: list[Meeting]) -> dict[str, set[str]]:
    """student_id -> set of everyone they met at least once."""
    out: dict[str, set[str]] = defaultdict(set)
    for m in meetings:
        out[m.a].add(m.b)
        out[m.b].add(m.a)
    return out