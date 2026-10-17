"""

score       = sum of severities of the DISTINCT rules a student breaks
              (each rule counts once, so 4 overlaps don't outweigh 3 kinds of irregularity)
conspirator = top CONSPIRATOR_COUNT students with score >= SUSPICIOUS_MIN_SCORE
suspicious  = other students with score >= SUSPICIOUS_MIN_SCORE
mastermind  = the ONE student with no serious flag (severity >= 2) who met ALL conspirators
              (brief: "nothing inconsistent ... except that they met the conspirators")
"""
from app.analysis.meetings import contacts
from app.config import RuleConfig, rule_config as default_config
from app.models import Flag, Meeting, Student, Suspect

SUSPICIOUS_MIN_SCORE = 3      # one high-severity rule, or two medium ones
SERIOUS_SEVERITY = 2          # a mastermind may only have flags below this (e.g. a typo in their ID)


def score_students(students: list[Student], flags: list[Flag]) -> dict[str, tuple[int, int]]:
    """student_id -> (score, flag_count)."""
    per_rule: dict[str, dict[str, int]] = {s.id: {} for s in students}
    counts: dict[str, int] = {s.id: 0 for s in students}
    for f in flags:
        if f.student_id not in per_rule:
            continue
        rules = per_rule[f.student_id]
        rules[f.rule] = max(rules.get(f.rule, 0), f.severity)
        counts[f.student_id] += 1
    return {sid: (sum(rules.values()), counts[sid]) for sid, rules in per_rule.items()}


def build_suspects(students: list[Student], flags: list[Flag], meetings: list[Meeting],
                   config: RuleConfig = default_config) -> list[Suspect]:
    names = {s.id: s.name for s in students}
    scores = score_students(students, flags)

    # 1) rank everyone: highest score first, then more flags, then name (A-Z)
    order = sorted(students, key=lambda s: (-scores[s.id][0], -scores[s.id][1], s.name))
    rank = {s.id: i for i, s in enumerate(order, start=1)}

    # 2) conspirators and suspicious
    eligible = [s.id for s in order if scores[s.id][0] >= SUSPICIOUS_MIN_SCORE]
    conspirators = set(eligible[:config.CONSPIRATOR_COUNT])
    verdict = {s.id: "clear" for s in students}
    for sid in eligible:
        verdict[sid] = "conspirator" if sid in conspirators else "suspicious"

    # 3) who met which conspirators, and in which meetings
    met = contacts(meetings)
    meeting_ids: dict[str, list[str]] = {s.id: [] for s in students}
    for m in meetings:
        if m.b in conspirators and m.a in meeting_ids:
            meeting_ids[m.a].append(m.id)
        if m.a in conspirators and m.b in meeting_ids:
            meeting_ids[m.b].append(m.id)

    # 4) mastermind: no serious flags, met every single conspirator
    serious = {f.student_id for f in flags if f.severity >= SERIOUS_SEVERITY}
    candidates = [s.id for s in students if s.id not in serious and s.id not in conspirators]
    met_all = [sid for sid in candidates
               if conspirators and conspirators <= met.get(sid, set())]
    if len(met_all) == 1:
        verdict[met_all[0]] = "mastermind"
    else:
        for sid in met_all:              # several perfect matches: can't tell, so flag them all for review
            verdict[sid] = "suspicious"

    suspects = [
        Suspect(
            student_id=s.id, score=scores[s.id][0], flag_count=scores[s.id][1], rank=rank[s.id],
            verdict=verdict[s.id],
            conspirators_met=sorted(met.get(s.id, set()) & conspirators, key=lambda x: names.get(x, x)),
            meeting_ids_with_conspirators=meeting_ids[s.id],
        )
        for s in students
    ]
    return sorted(suspects, key=lambda x: x.rank)