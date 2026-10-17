"""Tests for Person 2's analysis code.

`make_tiny_case()` builds a mini campus where each student is designed to
break exactly one rule (or none), so every rule can be checked precisely.
"""
import pytest

from app.analysis.timeutil import hhmm, overlap
from app.models import Building, Lecture, Statement, Student, Visit
from app.pipeline.run import CleanData


# ---------- helpers that keep the fixture short ----------

def building(bid, name, open_start, open_end, lectures=(), min_age=None, always_open=False, aliases=()):
    return Building(
        id=bid, name=name, lat=55.87, lon=-4.29,
        open_start=open_start, open_end=open_end, always_open=always_open,
        open_label=f"{hhmm(open_start)}-{hhmm(open_end)}",
        lectures=list(lectures), min_age=min_age, description="", aliases=list(aliases),
    )


def student(sid, name, subject, age=22, lecture=None, lecture_building_id=None,
            societies=(), has_statement=False, raw_ids=None):
    return Student(
        id=sid, name=name, age=age, sex="Female", year=2, subject=subject, height=170,
        hair_colour="#884422", societies=list(societies), has_statement=has_statement,
        raw_ids=raw_ids if raw_ids is not None else [sid],
        lecture=lecture, lecture_building_id=lecture_building_id,
    )


def make_tiny_case() -> CleanData:
    cs_lecture = Lecture(subject="Computing Science", start=600, end=720, source="description")      # 10:00-12:00
    phil_lecture = Lecture(subject="Philosophy", start=540, end=660, source="description")           # 09:00-11:00

    buildings = [
        building("boyd-orr-building", "Boyd Orr Building", 480, 1260, [cs_lecture], aliases=["boyd orr", "boydy"]),
        building("main-building", "Main Building", 540, 1020, [phil_lecture], aliases=["main building"]),
        building("library", "Library", 420, 1560, aliases=["library"]),                              # 07:00-02:00
        building("the-hive", "The Hive", 1320, 1560, min_age=18, aliases=["hive", "the hive"]),     # 22:00-02:00, 18+
        building("kelvingrove-park", "Kelvingrove Park", 0, 2880, always_open=True, aliases=["park", "kelvingrove"]),
    ]

    students = [
        # Ann: perfectly clean. CS lecture once, library in the evening.
        student("S1", "Ann Clean", "Computing Science", 24, cs_lecture, "boyd-orr-building"),
        # Ben: lecture fine, but back in Boyd Orr at 22:08 (closes 21:00)      -> out_of_hours
        student("S2", "Ben Late", "Computing Science", 23, cs_lecture, "boyd-orr-building"),
        # Cat: 17 years old at The Hive (18+ only)                            -> age_restricted_venue
        student("S3", "Cat Young", "Philosophy", 17, phil_lecture, "main-building"),
        # Dan: never goes to his Philosophy lecture                            -> missing_lecture
        student("S4", "Dan Skip", "Philosophy", 21, phil_lecture, "main-building", has_statement=True),
        # Eve: in Boyd Orr and the park at the same time                        -> impossible_overlap
        student("S5", "Eve Twice", "Computing Science", 22, cs_lecture, "boyd-orr-building"),
    ]

    raw = [  # (student_id, building_id, start, end)
        ("S1", "boyd-orr-building", 600, 720), ("S1", "library", 1020, 1140),
        ("S2", "boyd-orr-building", 600, 720), ("S2", "boyd-orr-building", 1328, 1339),
        ("S3", "main-building", 540, 660), ("S3", "the-hive", 1328, 1488),
        ("S4", "library", 600, 700),
        ("S5", "boyd-orr-building", 600, 720), ("S5", "kelvingrove-park", 690, 800),
    ]
    visits = [
        Visit(id=f"v{i:04d}", student_id=s, building_id=b, start=st, end=en,
              raw_time=f"{hhmm(st)[:5].replace(':', '')}-{hhmm(en)[:5].replace(':', '')}",
              raw_student_id=s, raw_location=b)
        for i, (s, b, st, en) in enumerate(raw, start=1)
    ]

    statements = [
        Statement(student_id="S4", raw_student_id="S4", name="Dan Skip",
                  text="I went to my philosophy lecture in the Main Building, then studied in the library.",
                  claims=[]),
    ]

    aliases = {}
    for b in buildings:
        for a in [b.name.lower(), *b.aliases]:
            aliases.setdefault(a.lower(), []).append(b.id)

    return CleanData(buildings=buildings, students=students, visits=visits,
                     statements=statements, data_quality=[], aliases=aliases)


@pytest.fixture
def tiny() -> CleanData:
    return make_tiny_case()


# ---------- Step 1 tests ----------

def test_hhmm_formats_times():
    assert hhmm(540) == "09:00"
    assert hhmm(1328) == "22:08"
    assert hhmm(1488) == "00:48 (+1)"


def test_overlap_counts_shared_minutes():
    assert overlap(600, 720, 690, 800) == 30   # 11:30-12:00 shared
    assert overlap(600, 720, 720, 800) == 0    # touching is not overlapping
    assert overlap(600, 720, 900, 950) == 0


def test_tiny_case_builds(tiny):
    assert len(tiny.buildings) == 5
    assert len(tiny.students) == 5
    assert len(tiny.visits) == 9
    assert tiny.aliases["boydy"] == ["boyd-orr-building"]