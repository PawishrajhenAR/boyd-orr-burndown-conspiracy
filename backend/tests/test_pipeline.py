"""P1 — pytest for the cleaning pipeline."""
from pathlib import Path

import pytest

from app.pipeline.run import run_pipeline

RAW = Path(__file__).resolve().parents[2] / "data" / "raw"


@pytest.fixture(scope="module")
def clean():
    return run_pipeline(RAW)


def test_counts(clean):
    assert len(clean.buildings) == 14
    assert len(clean.students) == 163
    assert len(clean.visits) == 662
    assert len(clean.statements) == 25


def test_building_hours_and_hive_age(clean):
    by = {b.id: b for b in clean.buildings}
    assert by["boyd-orr-building"].open_end == 1260
    assert by["library"].open_end == 1560
    assert by["kelvingrove-park"].always_open
    assert by["the-hive"].min_age == 18


def test_main_building_has_three_lectures(clean):
    main = next(b for b in clean.buildings if b.id == "main-building")
    subjects = {lec.subject: (lec.start, lec.end) for lec in main.lectures}
    assert subjects["Philosophy"] == (540, 660)
    assert subjects["Veterinary Medicine"] == (600, 720)
    assert subjects["Mathematics"] == (660, 780)


def test_physics_inferred_pharmacy_none(clean):
    phys = next(s for s in clean.students if s.subject == "Physics")
    assert phys.lecture is not None
    assert phys.lecture.start == 540 and phys.lecture.end == 600
    assert phys.lecture.source == "inferred"
    pharm = next(s for s in clean.students if s.subject == "Pharmacy")
    assert pharm.lecture is None


def test_midnight_wrap_visit(clean):
    v = next(v for v in clean.visits if v.raw_time == "2208-0048")
    assert v.start == 1328 and v.end == 1488


def test_no_unknown_buildings_and_typo_fixed(clean):
    ids = {b.id for b in clean.buildings}
    assert all(v.building_id in ids for v in clean.visits)
    typo = [i for i in clean.data_quality if i.issue == "location_typo"]
    assert any("Maragret" in i.original for i in typo)
    assert any(i.fixed == "Queen Margaret Union" for i in typo)
    assert any(v.building_id == "queen-margaret-union" and "Maragret" in v.raw_location for v in clean.visits)


def test_jonny_and_oscar_and_stuart_ids(clean):
    jonny = [v for v in clean.visits if v.student_id == "2712324G"]
    assert len(jonny) == 4
    assert all(v.raw_student_id.upper() == "2912324G" for v in jonny)
    oscar = next(s for s in clean.statements if s.name == "Oscar Brown")
    assert oscar.student_id == "2456431B"
    stuart = [v for v in clean.visits if v.student_id == "2813225B"]
    assert stuart and all(v.student_id == "2813225B" for v in stuart)


def test_aliases_required_nicknames(clean):
    a = clean.aliases
    assert "kelvingrove" in a and "kg" in a and "park" in a
    assert "boydy" in a and "hive" in a
    assert "medicine building" in a
    assert "qmu" in a and "guu" in a
    assert "the union" in a
    assert set(a["the union"]) == {"glasgow-university-union", "queen-margaret-union"}
    assert "kelvin" not in a  # bare kelvin must not match kelvingrove


def test_data_quality_minimums(clean):
    kinds = {i.issue for i in clean.data_quality}
    assert "id_mismatch" in kinds
    assert "id_format" in kinds
    assert "location_typo" in kinds
    assert "set_syntax" in kinds
    assert "lecture_time_differs_from_logs" in kinds
    assert sum(1 for i in clean.data_quality if i.issue == "id_mismatch") >= 2
    assert sum(1 for i in clean.data_quality if i.issue == "set_syntax") >= 3
