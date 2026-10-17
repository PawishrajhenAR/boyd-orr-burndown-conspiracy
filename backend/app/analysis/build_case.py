"""

Order: log rules -> testimony (claims + statement flags) -> meetings
       -> scores/verdicts -> oddities -> meta.

Run a readable summary on the real data:
    python -m app.analysis.build_case
"""
from datetime import datetime, timezone

from app.analysis.meetings import find_meetings
from app.analysis.oddities import detect_oddities
from app.analysis.rules import FlagFactory, run_rules
from app.analysis.scoring import build_suspects
from app.analysis.testimony import annotate_statements
from app.config import RuleConfig, rule_config as default_config
from app.models import Case, CaseMeta
from app.pipeline.run import CleanData

CASE_NAME = "Case File #1105: The Boyd Orr Firework Plot"
DAY_LABEL = "4 November"
SOURCE_FILES = ["people_data.csv", "security_logs.csv", "location_data.csv", "student_statements.txt"]


def build_case(clean: CleanData, config: RuleConfig = default_config) -> Case:
    ff = FlagFactory(config)
    log_flags = run_rules(clean, config, ff)
    statements, testimony_flags = annotate_statements(clean, ff, log_flags)
    flags = log_flags + testimony_flags
    meetings = find_meetings(clean, config)
    suspects = build_suspects(clean.students, flags, meetings, config)
    oddities = detect_oddities(clean, meetings)

    times = [v.start for v in clean.visits] + [v.end for v in clean.visits]
    meta = CaseMeta(
        case_name=CASE_NAME,
        generated_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        day_label=DAY_LABEL,
        source_files=SOURCE_FILES,
        counts={
            "students": len(clean.students), "visits": len(clean.visits),
            "buildings": len(clean.buildings), "statements": len(clean.statements),
            "flags": len(flags), "meetings": len(meetings),
            "data_quality_issues": len(clean.data_quality), "oddities": len(oddities),
            "conspirators": sum(1 for s in suspects if s.verdict == "conspirator"),
        },
        conspirator_count=config.CONSPIRATOR_COUNT,
        time_min=min(times, default=0),
        time_max=max(times, default=1440),
    )
    return Case(meta=meta, buildings=clean.buildings, students=clean.students, visits=clean.visits,
                statements=statements, flags=flags, meetings=meetings, suspects=suspects,
                data_quality=clean.data_quality, oddities=oddities)


def print_summary(case: Case) -> None:
    names = {s.id: s.name for s in case.students}
    print(f"{case.meta.case_name}\n{case.meta.counts}\n")
    print(f"{'rank':<5}{'student':<20}{'score':<7}{'verdict':<13}rules broken")
    for x in case.suspects:
        if x.verdict == "clear":
            continue
        rules = sorted({f.rule for f in case.flags if f.student_id == x.student_id and f.severity > 0})
        extra = f"  (met {len(x.conspirators_met)}/{case.meta.conspirator_count} conspirators)" if x.verdict == "mastermind" else ""
        print(f"{x.rank:<5}{names[x.student_id]:<20}{x.score:<7}{x.verdict:<13}{', '.join(rules) or '-'}{extra}")
    print(f"\n{len(case.oddities)} oddities:")
    for o in case.oddities:
        print(f"  - {o.title}")


if __name__ == "__main__":
    from app.config import settings
    from app.pipeline.run import run_pipeline
    print_summary(build_case(run_pipeline(settings.RAW_DIR)))