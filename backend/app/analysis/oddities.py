"""

Each detector is generic (works on any case file) and returns Oddity objects
with a plain-English explanation. Nothing here changes scores or verdicts.
"""
import re
from collections import Counter, defaultdict

from app.analysis.meetings import contacts
from app.analysis.rules import buildings_by_id, subjects_with_lectures, visits_by_student
from app.analysis.timeutil import hhmm
from app.models import Meeting, Oddity
from app.pipeline.run import CleanData

NIGHT_START, NIGHT_END = 0, 6 * 60          # 00:00-06:00
AGE_LOW, AGE_HIGH = 18, 30


def detect_oddities(clean: CleanData, meetings: list[Meeting]) -> list[Oddity]:
    found: list[tuple[str, str, list[str], list[str]]] = []      # (title, detail, student_ids, building_ids)
    bmap = buildings_by_id(clean)
    by_student = visits_by_student(clean)
    names = {s.id: s.name for s in clean.students}

    # 1) documented lecture time vs the time students actually swiped
    documented = {lec.subject: (b.id, lec) for b in clean.buildings for lec in b.lectures}
    seen = set()
    for s in clean.students:
        if s.lecture and s.lecture.source == "inferred" and s.subject in documented and s.subject not in seen:
            seen.add(s.subject)
            bid, doc = documented[s.subject]
            found.append((f"{s.subject} lecture time doesn't match the timetable",
                f"The building description says {s.subject} runs {hhmm(doc.start)}-{hhmm(doc.end)}, "
                f"but students actually swiped {hhmm(s.lecture.start)}-{hhmm(s.lecture.end)}. "
                f"We used the time from the logs.",
                [x.id for x in clean.students if x.subject == s.subject], [bid]))

    # 2) subjects with no lecture anywhere
    taught = subjects_with_lectures(clean)
    for subj, ids in sorted(_group(clean.students, lambda s: s.subject).items()):
        if subj not in taught:
            found.append((f"No timetable for {subj}",
                f"{len(ids)} student(s) study {subj}, but no building hosts {subj} lectures.", ids, []))

    # 3) students with no logs, or only one
    no_logs = [s.id for s in clean.students if not by_student.get(s.id)]
    if no_logs:
        found.append(("Students with no access logs",
            f"{len(no_logs)} student(s) never appear in the security logs: "
            f"{', '.join(names[i] for i in no_logs)}.", no_logs, []))
    one_log = [s.id for s in clean.students if len(by_student.get(s.id, [])) == 1]
    if one_log:
        found.append(("Only one log all day",
            f"{len(one_log)} student(s) were logged only once: "
            f"{', '.join(names[i] for i in one_log)}. Their alibis are hard to check.", one_log, []))

    # 4) night-time visits to always-open places (allowed, but unusual)
    for v in clean.visits:
        b = bmap.get(v.building_id)
        start = v.start % 1440
        if b and b.always_open and NIGHT_START <= start < NIGHT_END:
            found.append((f"Night-time visit to {b.name}",
                f"{names.get(v.student_id, v.student_id)} was in {b.name} {hhmm(v.start)}-{hhmm(v.end)}. "
                f"It's always open, so it isn't against the rules, but it is unusual.", [v.student_id], [b.id]))

    # 5) unusual ages
    for s in clean.students:
        if s.age < AGE_LOW or s.age > AGE_HIGH:
            found.append((f"Unusual age: {s.name} ({s.age})",
                f"{s.name} is {s.age}, outside the usual {AGE_LOW}-{AGE_HIGH} range for students "
                f"(year {s.year} of {s.subject}).", [s.id], []))

    # 6) statements that name each other, and logs confirm they met
    met = contacts(meetings)
    first_names = {}
    for st in clean.statements:
        first_names.setdefault(names.get(st.student_id, st.name).split()[0].lower(), st.student_id)
    pairs = set()
    for st in clean.statements:
        for word in set(re.findall(r"[A-Za-z]+", st.text.lower())):
            other = first_names.get(word)
            if other and other != st.student_id and other in met.get(st.student_id, set()):
                other_st = next((x for x in clean.statements if x.student_id == other), None)
                own_first = names.get(st.student_id, st.name).split()[0].lower()
                if other_st and own_first in other_st.text.lower():
                    pairs.add(tuple(sorted([st.student_id, other])))
    for a, b in sorted(pairs):
        found.append((f"Statements corroborate: {names[a]} & {names[b]}",
            f"{names[a]} and {names[b]} each mention the other in their statements, "
            f"and the logs confirm they were together.", [a, b], []))

    # 7) data-format quirks found during cleaning (from P1's data_quality list)
    for issue, n in sorted(Counter(q.issue for q in clean.data_quality).items()):
        examples = [q for q in clean.data_quality if q.issue == issue][:3]
        found.append((f"Data quirk: {issue.replace('_', ' ')} ({n})",
            f"{n} record(s) needed fixing, e.g. " +
            "; ".join(f"'{q.original}' -> '{q.fixed}' ({q.file})" for q in examples) + ".", [], []))

    return [Oddity(id=f"o{i:03d}", title=t, detail=d, student_ids=s, building_ids=b)
            for i, (t, d, s, b) in enumerate(found, start=1)]


def _group(items, key):
    out = defaultdict(list)
    for x in items:
        out[key(x)].append(x.id)
    return out