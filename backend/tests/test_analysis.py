"""
`make_tiny_case()` builds a mini campus where each student is designed to
break exactly one rule (or none), so every rule can be checked precisely.
"""
from pathlib import Path

import pytest

from app.analysis.build_case import build_case
from app.analysis.meetings import contacts, find_meetings
from app.analysis.oddities import detect_oddities
from app.analysis.rules import FlagFactory, run_rules
from app.analysis.scoring import build_suspects, score_students
from app.analysis.testimony import annotate_statements, is_hypothetical
from app.config import rule_config
from app.analysis.timeutil import hhmm, overlap
from app.models import Building, Case, Lecture, Statement, Student, Visit
from app.pipeline.run import CleanData, run_pipeline


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
        student("S1", "Ann Clean", "Computing Science", 24, cs_lecture, "boyd-orr-building",
                societies=["Soup Society", "Chess Club"], has_statement=True),
        # Ben: lecture fine, but back in Boyd Orr at 22:08 (closes 21:00)      -> out_of_hours
        student("S2", "Ben Late", "Computing Science", 23, cs_lecture, "boyd-orr-building"),
        # Cat: 17 years old at The Hive (18+ only)                            -> age_restricted_venue
        student("S3", "Cat Young", "Philosophy", 17, phil_lecture, "main-building"),
        # Dan: never goes to his Philosophy lecture                            -> missing_lecture
        student("S4", "Dan Skip", "Philosophy", 21, phil_lecture, "main-building", has_statement=True),
        # Eve: in Boyd Orr and the park at the same time                        -> impossible_overlap
        student("S5", "Eve Twice", "Computing Science", 22, cs_lecture, "boyd-orr-building"),
        # Fay: in her lecture only 10:00-11:30 (slot ends 12:00)              -> left_lecture_early
        student("S6", "Fay Early", "Computing Science", 22, cs_lecture, "boyd-orr-building"),
        # Gus: studies a subject that has no lecture anywhere                  -> subject_without_lecture + missing_lecture
        student("S7", "Gus Nocourse", "Pharmacy", 21, has_statement=True),
        # Hal: logs filed under 'x8', statement under 's8'                     -> id_mismatch + id_format
        student("S8", "Hal Mixup", "Computing Science", 25, cs_lecture, "boyd-orr-building",
                has_statement=True, raw_ids=["S8", "X8", "s8"]),
    ]

    raw = [  # (student_id, building_id, start, end)
        ("S1", "boyd-orr-building", 600, 720), ("S1", "library", 1020, 1140),
        ("S2", "boyd-orr-building", 600, 720), ("S2", "boyd-orr-building", 1328, 1339),
        ("S3", "main-building", 540, 660), ("S3", "the-hive", 1328, 1488),
        ("S4", "library", 600, 700),
        ("S5", "boyd-orr-building", 600, 720), ("S5", "kelvingrove-park", 690, 800),
        ("S6", "boyd-orr-building", 600, 690),
        ("S7", "library", 600, 700),
        ("S8", "boyd-orr-building", 600, 720),
    ]
    visits = [
        Visit(id=f"v{i:04d}", student_id=s, building_id=b, start=st, end=en,
              raw_time=f"{hhmm(st)[:5].replace(':', '')}-{hhmm(en)[:5].replace(':', '')}",
              raw_student_id="X8" if s == "S8" else s, raw_location=b)
        for i, (s, b, st, en) in enumerate(raw, start=1)
    ]

    statements = [
        Statement(student_id="S4", raw_student_id="S4", name="Dan Skip",
                  text="I went to my philosophy lecture in the Main Building, then studied in the library.",
                  claims=[]),
        Statement(student_id="S8", raw_student_id="s8", name="Hal Mixup",
                  text="I was at my lecture in the Boyd Orr all morning.", claims=[]),
        # Ann: mentions the Hive only hypothetically, and a society she IS in -> no flags
        Statement(student_id="S1", raw_student_id="S1", name="Ann Clean",
                  text="Lecture at the Boydy, then I was tempted to go to the Hive, but I studied in the library "
                       "with the Soup Society instead of going out.", claims=[]),
        # Gus: claims a society he is not in                                  -> false_society_claim
        Statement(student_id="S7", raw_student_id="S7", name="Gus Nocourse",
                  text="I went to a soup society meeting in the library.", claims=[]),
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
    assert len(tiny.students) == 8
    assert len(tiny.visits) == 12
    assert tiny.aliases["boydy"] == ["boyd-orr-building"]


# ---------- Step 2 tests: log-based rules ----------

def rules_by_student(flags):
    """student_id -> set of rule names, so tests can compare whole sets."""
    out = {}
    for f in flags:
        out.setdefault(f.student_id, set()).add(f.rule)
    return out


def test_each_student_breaks_exactly_the_planned_rules(tiny):
    got = rules_by_student(run_rules(tiny))
    assert got == {
        "S2": {"out_of_hours"},
        "S3": {"age_restricted_venue"},
        "S4": {"missing_lecture"},
        "S5": {"impossible_overlap"},
        "S6": {"left_lecture_early"},
        "S7": {"subject_without_lecture", "missing_lecture"},
        "S8": {"id_mismatch", "id_format"},
    }
    assert "S1" not in got          # Ann (the clean control) must have no flags at all


def test_flags_have_readable_times_and_severity(tiny):
    flags = run_rules(tiny)
    late = next(f for f in flags if f.rule == "out_of_hours")
    assert "22:08" in late.detail and late.severity == 3
    assert late.visit_ids == ["v0004"]
    assert len({f.id for f in flags}) == len(flags)   # every flag id is unique


def test_library_after_midnight_is_not_out_of_hours(tiny):
    # Library is open 07:00-02:00, so 00:30 (=30) and 01:30 next day (=1530) are both fine.
    tiny.visits.append(tiny.visits[0].model_copy(update={"id": "v0100", "building_id": "library", "start": 30, "end": 60}))
    tiny.visits.append(tiny.visits[0].model_copy(update={"id": "v0101", "building_id": "library", "start": 1500, "end": 1530}))
    assert "S1" not in rules_by_student(run_rules(tiny))


def test_multiple_lectures(tiny):
    tiny.visits.append(tiny.visits[0].model_copy(update={"id": "v0102", "start": 730, "end": 740}))
    tiny.visits[0] = tiny.visits[0].model_copy(update={"end": 650})
    tiny.visits.append(tiny.visits[0].model_copy(update={"id": "v0103", "start": 660, "end": 720}))
    assert rules_by_student(run_rules(tiny))["S1"] == {"multiple_lectures"}


# ---------- Step 3 tests: testimony annotation ----------

def all_flags(clean):
    """Log rules + testimony flags, sharing one FlagFactory so IDs stay unique."""
    ff = FlagFactory(rule_config)
    log_flags = run_rules(clean, ff=ff)
    statements, t_flags = annotate_statements(clean, ff, log_flags)
    return statements, log_flags + t_flags


def test_testimony_flags_exactly_the_planned_students(tiny):
    _, flags = all_flags(tiny)
    got = rules_by_student(flags)
    assert got["S4"] == {"missing_lecture", "statement_contradiction"}   # claims Main Building + a lecture
    assert got["S7"] == {"subject_without_lecture", "missing_lecture", "false_society_claim"}
    assert got["S8"] == {"id_mismatch", "id_format"}                      # his claim (Boyd Orr) is true
    assert "S1" not in got                                                # hypothetical Hive -> no flag


def test_claims_have_positions_and_status(tiny):
    statements, _ = all_flags(tiny)
    ann = next(s for s in statements if s.student_id == "S1")
    by_place = {c.building_id: c for c in ann.claims}
    assert set(by_place) == {"boyd-orr-building", "the-hive", "library"}
    assert by_place["the-hive"].hypothetical is True
    assert by_place["boyd-orr-building"].matched_visit_id == "v0001"
    c = by_place["boyd-orr-building"]
    assert ann.text[c.char_start:c.char_end] == "Boydy"                  # positions point at the word


def test_dan_gets_two_contradictions_with_spans(tiny):
    _, flags = all_flags(tiny)
    dan = [f for f in flags if f.student_id == "S4" and f.rule == "statement_contradiction"]
    assert len(dan) == 2                                                  # Main Building + "lecture"
    assert all(f.statement_span is not None for f in dan)


def test_hypothetical_cues():
    assert is_hypothetical("I was tempted to go to Hive but I was shattered", 23)
    assert is_hypothetical("I already had a plan to go to HIVE.", 30)
    assert not is_hypothetical("Then I headed to the Adam Smith to close up a group project.", 21)


# ---------- Step 4 tests: meetings ----------

def test_meetings_in_tiny_campus(tiny):
    ms = find_meetings(tiny)
    # Boyd Orr 10:00-12:00: S1, S2, S5, S6, S8 are all there -> every pair of the 5 = 10 meetings.
    # Library 10:00-11:40: S4 and S7 -> 1 meeting. Everyone else is alone.
    assert len(ms) == 11
    lib = next(m for m in ms if m.building_id == "library")
    assert (lib.a, lib.b, lib.start, lib.end, lib.minutes) == ("S4", "S7", 600, 700, 100)
    assert all(m.a < m.b for m in ms)                       # each pair stored once, in ID order
    assert [m.id for m in ms][:2] == ["m00001", "m00002"]


def test_touching_visits_do_not_meet(tiny):
    # Fay leaves Boyd Orr at 11:30; someone arriving exactly at 11:30 has 0 shared minutes.
    tiny.visits.append(tiny.visits[0].model_copy(update={"id": "v0200", "student_id": "S7", "start": 690, "end": 700}))
    ms = find_meetings(tiny)
    assert not any({m.a, m.b} == {"S6", "S7"} for m in ms)


def test_min_minutes_is_configurable(tiny):
    strict = rule_config.model_copy(update={"MIN_MEETING_MINUTES": 101})
    assert not any(m.building_id == "library" for m in find_meetings(tiny, strict))   # only 100 min together


def test_contacts(tiny):
    c = contacts(find_meetings(tiny))
    assert c["S4"] == {"S7"}
    assert c["S1"] == {"S2", "S5", "S6", "S8"}


# ---------- Step 5 tests: scoring and verdicts ----------

def suspects_for(clean, config=rule_config):
    _, flags = all_flags(clean)
    return {x.student_id: x for x in build_suspects(clean.students, flags, find_meetings(clean, config), config)}


def test_scores_count_each_rule_once(tiny):
    _, flags = all_flags(tiny)
    scores = score_students(tiny.students, flags)
    assert scores["S7"] == (6, 3)        # subject_without_lecture 1 + missing_lecture 3 + false_society 2
    assert scores["S4"] == (5, 3)        # missing_lecture 3 + statement_contradiction 2 (2 flags, counted once)
    assert scores["S1"] == (0, 0)


def test_top_six_are_conspirators_and_ranked(tiny):
    sus = suspects_for(tiny)
    conspirators = {k for k, v in sus.items() if v.verdict == "conspirator"}
    assert conspirators == {"S7", "S4", "S8", "S2", "S3", "S5"}
    assert sus["S7"].rank == 1 and sus["S4"].rank == 2
    assert sus["S6"].verdict == "clear"            # score 2 is below the threshold
    assert sorted(x.rank for x in sus.values()) == list(range(1, 9))


def test_no_mastermind_when_nobody_met_all(tiny):
    sus = suspects_for(tiny)
    assert "mastermind" not in {v.verdict for v in sus.values()}
    assert set(sus["S1"].conspirators_met) == {"S2", "S5", "S8"}   # Ann met only 3 of the 6


def test_mastermind_found_when_clean_student_met_all(tiny):
    # Only 4 conspirators this time; let Dan (S4) and Gus (S7) also pass by Ann in the library.
    tiny.visits.append(tiny.visits[0].model_copy(update={"id": "v0300", "student_id": "S4", "building_id": "library", "start": 1030, "end": 1050}))
    tiny.visits.append(tiny.visits[0].model_copy(update={"id": "v0301", "student_id": "S7", "building_id": "library", "start": 1060, "end": 1080}))
    four = rule_config.model_copy(update={"CONSPIRATOR_COUNT": 4})
    sus = suspects_for(tiny, four)
    assert {k for k, v in sus.items() if v.verdict == "conspirator"} == {"S7", "S4", "S8", "S2"}
    assert sus["S1"].verdict == "mastermind"
    assert set(sus["S1"].conspirators_met) == {"S7", "S4", "S8", "S2"}
    assert len(sus["S1"].meeting_ids_with_conspirators) == 4


# ---------- Step 6 tests: oddities ----------

def test_oddities_on_tiny_campus(tiny):
    odd = detect_oddities(tiny, find_meetings(tiny))
    titles = [o.title for o in odd]
    assert "No timetable for Pharmacy" in titles
    assert any(t.startswith("Unusual age: Cat Young") for t in titles)
    one = next(o for o in odd if o.title == "Only one log all day")
    assert set(one.student_ids) == {"S4", "S6", "S7", "S8"}
    assert len({o.id for o in odd}) == len(odd)


# ---------- Step 7 tests: the whole Case ----------

def test_build_case_is_valid_json_for_the_api(tiny):
    case = build_case(tiny, rule_config)
    again = Case.model_validate_json(case.model_dump_json())      # survives the trip to JSON and back
    assert again.meta.counts["students"] == 8
    assert again.meta.counts["conspirators"] == 6
    assert again.meta.time_min == 540 and again.meta.time_max == 1488
    assert len({f.id for f in again.flags}) == len(again.flags)
    assert any(st.claims for st in again.statements)                # claims were filled in
    assert [x.rank for x in again.suspects] == list(range(1, 9))


# ---------- Acceptance tests on the REAL data (need P1's pipeline + data/raw) ----------

REAL_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"
CONSPIRATORS = {"2456431B", "2774868P", "2786843M", "2546112P", "2712324G", "2813225B"}
MASTERMIND = "2453876J"


@pytest.fixture(scope="module")
def real_case():
    if not (REAL_DIR / "people_data.csv").exists():
        pytest.skip("real data is not in data/raw yet")
    try:
        clean = run_pipeline(REAL_DIR)
    except NotImplementedError:
        pytest.skip("P1's run_pipeline is not ready yet")
    if clean is None or not clean.visits:
        pytest.skip("P1's run_pipeline returned no data yet")
    return build_case(clean, rule_config)


def real_rules(case, sid):
    return {f.rule for f in case.flags if f.student_id == sid}


def test_real_exact_six_conspirators(real_case):
    assert {x.student_id for x in real_case.suspects if x.verdict == "conspirator"} == CONSPIRATORS


def test_real_mastermind_is_clean_and_met_all_six(real_case):
    boss = next(x for x in real_case.suspects if x.verdict == "mastermind")
    assert boss.student_id == MASTERMIND
    assert set(boss.conspirators_met) == CONSPIRATORS
    assert not [f for f in real_case.flags if f.student_id == MASTERMIND and f.severity >= 2]


def test_real_paul_butler_is_seventh_and_suspicious(real_case):
    paul = next(x for x in real_case.suspects if x.student_id == "2729563B")
    assert paul.verdict == "suspicious" and paul.rank == 7


def test_real_key_flags(real_case):
    assert "out_of_hours" in real_rules(real_case, "2786843M")                       # Abdul, Boyd Orr 22:08
    assert "age_restricted_venue" in real_rules(real_case, "2813225B")               # Stuart, The Hive
    assert "impossible_overlap" in real_rules(real_case, "2456431B")                 # Oscar
    assert {"missing_lecture", "impossible_overlap"} <= real_rules(real_case, "2774868P")      # Alice
    assert {"missing_lecture", "false_society_claim"} <= real_rules(real_case, "2546112P")     # Eric
    assert {"id_mismatch", "left_lecture_early", "statement_contradiction"} <= real_rules(real_case, "2712324G")  # Jonny


def test_real_no_false_contradictions(real_case):
    for sid in ["2797619M", "2425599J", "2527287T", "2522391J"]:     # Russell M., Angela, Danny, Lee
        assert "statement_contradiction" not in real_rules(real_case, sid)


def test_real_conspirator_count_is_configurable():
    if not (REAL_DIR / "people_data.csv").exists():
        pytest.skip("real data is not in data/raw yet")
    try:
        clean = run_pipeline(REAL_DIR)
    except NotImplementedError:
        pytest.skip("P1's run_pipeline is not ready yet")
    if clean is None or not clean.visits:
        pytest.skip("P1's run_pipeline returned no data yet")
    five = build_case(clean, rule_config.model_copy(update={"CONSPIRATOR_COUNT": 5}))
    assert sum(1 for x in five.suspects if x.verdict == "conspirator") == 5