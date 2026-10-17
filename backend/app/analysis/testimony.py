"""

1. extract_claims(): find every building a statement mentions (via P1's alias
   dictionary), with character positions so the UI can highlight them.
2. Mark a claim as *hypothetical* when its clause talks about something that did
   NOT happen ("I was tempted to go to Hive", "a plan to go to HIVE").
3. Compare claims with the student's visits and produce flags:
   statement_contradiction, statement_omission, false_society_claim.
"""
import difflib
import re

from app.analysis.rules import FlagFactory, buildings_by_id, visits_by_student
from app.models import Claim, Flag, Statement, Visit
from app.pipeline.run import CleanData

# Words that mean "this place is mentioned, but they did not actually go there".
HYPOTHETICAL_CUES = [
    r"\btempted\b", r"\bplan(?:ned)?\b", r"\bwanted me\b", r"\btried to get me\b", r"\binstead\b",
    r"\bdidn[’']?t\b", r"\bdid not\b", r"\bwasn[’']?t\b", r"\bnever\b", r"\bwant to launch\b",
    r"\btake out\b", r"\bpromised he would\b", r"\bbefore\b.*\bopened\b",
]
CLAUSE_SPLIT = re.compile(r"[.!?;,]+|\bbut\b", re.IGNORECASE)   # clause = piece of a sentence
LECTURE_WORD = re.compile(r"\blecture", re.IGNORECASE)
MIN_CLAIMS_FOR_OMISSION = 3          # only statements that list places explicitly
SOCIETY_MATCH_RATIO = 0.85           # how similar a phrase must be to a society name (0..1)


def clause_bounds(text: str) -> list[tuple[int, int]]:
    """(start, end) character positions of every clause in the text."""
    bounds, start = [], 0
    for m in CLAUSE_SPLIT.finditer(text):
        bounds.append((start, m.start()))
        start = m.end()
    bounds.append((start, len(text)))
    return bounds


def is_hypothetical(text: str, pos: int) -> bool:
    """Does the clause containing character `pos` contain a hypothetical cue word?"""
    for start, end in clause_bounds(text):
        if start <= pos < end:
            clause = text[start:end]
            return any(re.search(cue, clause, re.IGNORECASE) for cue in HYPOTHETICAL_CUES)
    return False


def extract_claims(statement: Statement, aliases: dict[str, list[str]], visits: list[Visit]) -> list[Claim]:
    """Every building mentioned in the statement, longest alias first, no overlapping matches."""
    text = statement.text
    taken = [False] * len(text)                 # characters already used by a longer alias
    visited_ids = {v.building_id for v in visits}
    first_visit = {}
    for v in visits:
        first_visit.setdefault(v.building_id, v.id)

    claims: list[Claim] = []
    for alias in sorted(aliases, key=len, reverse=True):
        pattern = r"(?<![A-Za-z])" + re.escape(alias) + r"(?![A-Za-z])"
        for m in re.finditer(pattern, text, re.IGNORECASE):
            if any(taken[m.start():m.end()]):
                continue
            for i in range(m.start(), m.end()):
                taken[i] = True
            candidates = aliases[alias]
            building_id = next((b for b in candidates if b in visited_ids), candidates[0])
            hypothetical = is_hypothetical(text, m.start())
            claims.append(Claim(
                building_id=building_id, text=m.group(0), char_start=m.start(), char_end=m.end(),
                hypothetical=hypothetical,
                matched_visit_id=None if hypothetical else first_visit.get(building_id),
            ))
    claims.sort(key=lambda c: c.char_start)
    return claims


def snippet(text: str, start: int, end: int, pad: int = 35) -> str:
    """A short quote around a claim, for flag messages."""
    a, b = max(0, start - pad), min(len(text), end + pad)
    return ("…" if a else "") + text[a:b].strip() + ("…" if b < len(text) else "")


def society_mentions(text: str, all_societies: set[str]) -> list[tuple[str, int, int]]:
    """Societies named in the text: exact names, or 'X society/club' phrases close to a real name."""
    found, lower = [], text.lower()
    for soc in all_societies:
        i = lower.find(soc.lower())
        if i >= 0:
            found.append((soc, i, i + len(soc)))
    for m in re.finditer(r"((?:[\w'’-]+\s+){1,4})(society|club)\b", text, re.IGNORECASE):
        phrase = m.group(0).lower()
        words = phrase.split()
        for k in range(2, len(words) + 1):           # try "x society", "y x society", ...
            cand = " ".join(words[-k:])
            best = difflib.get_close_matches(cand, [s.lower() for s in all_societies], n=1,
                                             cutoff=SOCIETY_MATCH_RATIO)
            if best:
                name = next(s for s in all_societies if s.lower() == best[0])
                if not any(f[0] == name for f in found):
                    found.append((name, m.end() - len(cand), m.end()))
                break
    return found


def annotate_statements(clean: CleanData, ff: FlagFactory, existing_flags: list[Flag]) -> tuple[list[Statement], list[Flag]]:
    """Fill `claims` on every statement and return (statements, testimony flags)."""
    bmap = buildings_by_id(clean)
    by_student = visits_by_student(clean)
    students = {s.id: s for s in clean.students}
    all_societies = {soc for s in clean.students for soc in s.societies}
    missing_lecture = {f.student_id for f in existing_flags if f.rule == "missing_lecture"}

    statements: list[Statement] = []
    flags: list[Flag] = []
    for st in clean.statements:
        visits = by_student.get(st.student_id, [])
        claims = extract_claims(st, clean.aliases, visits)
        statements.append(st.model_copy(update={"claims": claims}))
        who = students[st.student_id].name if st.student_id in students else st.name

        # 1) places they claim but never swiped into
        reported = set()
        for c in claims:
            if c.hypothetical or c.matched_visit_id or c.building_id in reported:
                continue
            reported.add(c.building_id)
            bname = bmap[c.building_id].name if c.building_id in bmap else c.building_id
            flags.append(ff.make("statement_contradiction", st.student_id,
                title=f"Claims {bname}, no log",
                detail=f'{who} says "{snippet(st.text, c.char_start, c.char_end)}", '
                       f"but there is no record of them entering {bname}.",
                building_id=c.building_id, statement_span=(c.char_start, c.char_end)))

        # 2) says they went to a lecture, but the lecture rule says they didn't
        m = LECTURE_WORD.search(st.text)
        if m and st.student_id in missing_lecture:
            flags.append(ff.make("statement_contradiction", st.student_id,
                title="Claims a lecture they never attended",
                detail=f'{who} mentions a lecture ("{snippet(st.text, m.start(), m.end())}"), '
                       f"but the logs show they did not attend their own lecture.",
                statement_span=(m.start(), m.end())))

        # 3) places they visited but left out (only for statements that list places)
        claimed = {c.building_id for c in claims if not c.hypothetical}
        if len(claimed) >= MIN_CLAIMS_FOR_OMISSION:
            left_out = [v for v in visits if v.building_id not in claimed]
            if left_out:
                names = sorted({bmap[v.building_id].name for v in left_out if v.building_id in bmap})
                flags.append(ff.make("statement_omission", st.student_id,
                    title="Left places out of their story",
                    detail=f"{who}'s statement lists {len(claimed)} places but never mentions "
                           f"{', '.join(names)}, where they were logged.",
                    visit_ids=[v.id for v in left_out]))

        # 4) societies they mention but don't belong to
        member_of = set(students[st.student_id].societies) if st.student_id in students else set()
        for name, a, b in society_mentions(st.text, all_societies):
            if name not in member_of:
                flags.append(ff.make("false_society_claim", st.student_id,
                    title=f"Not a member of {name}",
                    detail=f'{who} talks about the {name} ("{snippet(st.text, a, b)}"), '
                           f"but their records show they are not a member.",
                    statement_span=(a, b)))
    return statements, flags