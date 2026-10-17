"""Log-based rule checks (Person 2).

Each rule is a function `rule_x(clean, ff) -> list[Flag]`.
`ff` is a FlagFactory that numbers flags (f0001, f0002, ...) and looks up
each rule's severity from the config, so severities are never hard-coded here.
Statement-based rules live in testimony.py.
"""
from collections import defaultdict

from app.analysis.timeutil import hhmm, overlap
from app.config import RuleConfig, rule_config as default_config
from app.models import Building, Flag, Student, Visit
from app.pipeline.run import CleanData

LECTURE_TOLERANCE_MIN = 10   # arriving/leaving within 10 minutes of the slot still counts as "on time"


class FlagFactory:
    """Creates Flag objects with unique IDs and the configured severity."""

    def __init__(self, config: RuleConfig):
        self.config = config
        self.count = 0

    def make(self, rule: str, student_id: str, title: str, detail: str,
             visit_ids: list[str] | None = None, building_id: str | None = None,
             time: int | None = None, statement_span: tuple[int, int] | None = None) -> Flag:
        self.count += 1
        return Flag(
            id=f"f{self.count:04d}", student_id=student_id, rule=rule,
            severity=self.config.SEVERITY[rule], title=title, detail=detail,
            visit_ids=visit_ids or [], building_id=building_id, time=time,
            statement_span=statement_span,
        )


# ---------- small lookup helpers ----------

def visits_by_student(clean: CleanData) -> dict[str, list[Visit]]:
    """student_id -> that student's visits, sorted by start time."""
    grouped: dict[str, list[Visit]] = defaultdict(list)
    for v in clean.visits:
        grouped[v.student_id].append(v)
    for vs in grouped.values():
        vs.sort(key=lambda v: v.start)
    return grouped


def buildings_by_id(clean: CleanData) -> dict[str, Building]:
    return {b.id: b for b in clean.buildings}


def subjects_with_lectures(clean: CleanData) -> set[str]:
    """Every subject that has a lecture in at least one building."""
    return {lec.subject for b in clean.buildings for lec in b.lectures}


def inside_opening_hours(b: Building, start: int, end: int) -> bool:
    """True if the whole visit fits in the building's opening window.

    We also try the window shifted back one day, because a building open until
    02:00 (e.g. 07:00-02:00) is legitimately open at 00:30 'this morning'.
    """
    if b.always_open:
        return True
    return any(b.open_start + shift <= start and end <= b.open_end + shift for shift in (-1440, 0))


# ---------- rules ----------

def rule_lectures(clean: CleanData, ff: FlagFactory) -> list[Flag]:
    """Brief rule 1: every student attends their mandatory lecture exactly once.

    Produces: subject_without_lecture, missing_lecture, multiple_lectures, left_lecture_early.
    """
    flags: list[Flag] = []
    by_student = visits_by_student(clean)
    taught = subjects_with_lectures(clean)
    for s in clean.students:
        visits = by_student.get(s.id, [])
        if s.lecture is None or s.lecture_building_id is None:
            if s.subject not in taught:
                flags.append(ff.make("subject_without_lecture", s.id,
                    title=f"No {s.subject} lecture exists",
                    detail=f"{s.name} studies {s.subject}, but no building on campus hosts {s.subject} lectures."))
                flags.append(ff.make("missing_lecture", s.id,
                    title="Could not attend a lecture",
                    detail=f"The rule says every student attends their lecture, but {s.subject} has no lecture on campus, so {s.name} cannot have attended one."))
            else:
                flags.append(ff.make("missing_lecture", s.id,
                    title="Lecture unknown",
                    detail=f"{s.subject} lectures exist, but no lecture slot was assigned to {s.name}."))
            continue

        slot = s.lecture
        attended = [v for v in visits
                    if v.building_id == s.lecture_building_id and overlap(v.start, v.end, slot.start, slot.end) > 0]
        slot_txt = f"{hhmm(slot.start)}-{hhmm(slot.end)}"
        if not attended:
            flags.append(ff.make("missing_lecture", s.id,
                title="Skipped mandatory lecture",
                detail=f"{s.name} has no swipe into the {s.subject} lecture building during {slot_txt}.",
                building_id=s.lecture_building_id, time=slot.start))
        elif len(attended) > 1:
            flags.append(ff.make("multiple_lectures", s.id,
                title="Attended lecture more than once",
                detail=f"{s.name} swiped into the {s.subject} lecture {len(attended)} times during {slot_txt}.",
                visit_ids=[v.id for v in attended], building_id=s.lecture_building_id, time=attended[1].start))
        else:
            v = attended[0]
            late = v.start - slot.start
            early = slot.end - v.end
            if late > LECTURE_TOLERANCE_MIN or early > LECTURE_TOLERANCE_MIN:
                parts = []
                if late > LECTURE_TOLERANCE_MIN:
                    parts.append(f"arrived {late} min late")
                if early > LECTURE_TOLERANCE_MIN:
                    parts.append(f"left {early} min early")
                flags.append(ff.make("left_lecture_early", s.id,
                    title="Left lecture early" if early > LECTURE_TOLERANCE_MIN else "Late to lecture",
                    detail=f"{s.name} was in the {s.subject} lecture {hhmm(v.start)}-{hhmm(v.end)} "
                           f"(slot {slot_txt}): {' and '.join(parts)}.",
                    visit_ids=[v.id], building_id=v.building_id, time=v.start))
    return flags


def rule_out_of_hours(clean: CleanData, ff: FlagFactory) -> list[Flag]:
    """Brief rule 2: students have no out-of-hours access to buildings."""
    flags: list[Flag] = []
    bmap = buildings_by_id(clean)
    names = {s.id: s.name for s in clean.students}
    for v in clean.visits:
        b = bmap.get(v.building_id)
        if b is None or inside_opening_hours(b, v.start, v.end):
            continue
        flags.append(ff.make("out_of_hours", v.student_id,
            title=f"After hours in {b.name}",
            detail=f"{names.get(v.student_id, v.student_id)} was in {b.name} {hhmm(v.start)}-{hhmm(v.end)}, "
                   f"but it is only open {b.open_label}.",
            visit_ids=[v.id], building_id=b.id, time=v.start))
    return flags


def rule_impossible_overlap(clean: CleanData, ff: FlagFactory) -> list[Flag]:
    """A person cannot be in two different buildings at the same time."""
    flags: list[Flag] = []
    bmap = buildings_by_id(clean)
    names = {s.id: s.name for s in clean.students}
    for sid, vs in visits_by_student(clean).items():
        for i, a in enumerate(vs):
            for b in vs[i + 1:]:
                if b.start >= a.end:          # sorted by start, so later visits can't overlap a either
                    break
                if a.building_id == b.building_id:
                    continue
                mins = overlap(a.start, a.end, b.start, b.end)
                if mins > 0:
                    an = bmap[a.building_id].name if a.building_id in bmap else a.building_id
                    bn = bmap[b.building_id].name if b.building_id in bmap else b.building_id
                    flags.append(ff.make("impossible_overlap", sid,
                        title="In two places at once",
                        detail=f"{names.get(sid, sid)} is logged in {an} {hhmm(a.start)}-{hhmm(a.end)} "
                               f"and in {bn} {hhmm(b.start)}-{hhmm(b.end)} at the same time ({mins} min overlap).",
                        visit_ids=[a.id, b.id], building_id=b.building_id, time=b.start))
    return flags


def rule_age_restricted(clean: CleanData, ff: FlagFactory) -> list[Flag]:
    """Venues with a minimum age (parsed from descriptions, e.g. 'over 18s only')."""
    flags: list[Flag] = []
    bmap = buildings_by_id(clean)
    students = {s.id: s for s in clean.students}
    for v in clean.visits:
        b, s = bmap.get(v.building_id), students.get(v.student_id)
        if b is None or s is None or b.min_age is None or s.age >= b.min_age:
            continue
        flags.append(ff.make("age_restricted_venue", s.id,
            title=f"Under {b.min_age} in {b.name}",
            detail=f"{s.name} is {s.age}, but {b.name} is strictly {b.min_age}+. "
                   f"They were there {hhmm(v.start)}-{hhmm(v.end)}.",
            visit_ids=[v.id], building_id=b.id, time=v.start))
    return flags


def rule_ids(clean: CleanData, ff: FlagFactory) -> list[Flag]:
    """Records filed under a different ID (id_mismatch) or the same ID typed differently (id_format)."""
    flags: list[Flag] = []
    for s in clean.students:
        for raw in s.raw_ids:
            if raw == s.id:
                continue
            visit_ids = [v.id for v in clean.visits if v.student_id == s.id and v.raw_student_id == raw]
            in_statement = any(st.student_id == s.id and st.raw_student_id == raw for st in clean.statements)
            n = len(visit_ids)
            sources = []
            if n:
                sources.append(f"{n} log{'s' if n != 1 else ''}")
            if in_statement:
                sources.append("the statement")
            where = " and ".join(sources) or "a record"
            verb = "uses" if where in ("1 log", "the statement", "a record") else "use"
            if raw.upper() == s.id.upper():
                flags.append(ff.make("id_format", s.id,
                    title="ID typed inconsistently",
                    detail=f"{where.capitalize()} {verb} '{raw}' instead of {s.id} (letter case differs).",
                    visit_ids=visit_ids))
            else:
                flags.append(ff.make("id_mismatch", s.id,
                    title="Records under a different ID",
                    detail=f"{where.capitalize()} for {s.name} {verb} ID '{raw}', which is not their student ID {s.id}.",
                    visit_ids=visit_ids))
    return flags


ALL_RULES = [rule_lectures, rule_out_of_hours, rule_impossible_overlap, rule_age_restricted, rule_ids]


def run_rules(clean: CleanData, config: RuleConfig = default_config, ff: FlagFactory | None = None) -> list[Flag]:
    """Run every log-based rule and return all flags."""
    ff = ff or FlagFactory(config)
    flags: list[Flag] = []
    for rule in ALL_RULES:
        flags.extend(rule(clean, ff))
    return flags
