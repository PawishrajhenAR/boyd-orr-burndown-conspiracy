"""Export the current investigation case to the frontend's offline JSON file."""

import json
import logging
import sys
from pathlib import Path

from app.config import PROJECT_ROOT, settings
from app.models import Case

logger = logging.getLogger(__name__)

OUTPUT_PATH = PROJECT_ROOT / "frontend" / "public" / "case.json"


def build_export_case() -> Case:
    """Build a case from the raw data using the shared pipeline and analysis."""
    from app.analysis.build_case import build_case
    from app.pipeline.run import run_pipeline

    clean = run_pipeline(settings.RAW_DIR)
    return build_case(clean, __import__(
        "app.config", fromlist=["rule_config"]
    ).rule_config)


def export_case(
    case: Case,
    output_path: Path = OUTPUT_PATH,
) -> Path:
    """Write a validated Case to JSON and return the output path."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    case_data = case.model_dump(mode="json")

    output_path.write_text(
        json.dumps(
            case_data,
            indent=2,
            sort_keys=True,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    logger.info("Exported investigation case to %s", output_path)
    return output_path


def main() -> int:
    """Build and export the real case."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    try:
        case = build_export_case()
        output_path = export_case(case)
    except Exception:
        logger.exception(
            "Could not export the case. Check the raw files and ensure "
            "P1's pipeline and P2's analysis modules are implemented."
        )
        return 1

    print(f"Case exported successfully: {output_path}")
    print(f"Students: {len(case.students)}")
    print(f"Buildings: {len(case.buildings)}")
    print(f"Visits: {len(case.visits)}")
    print(f"Flags: {len(case.flags)}")
    print(f"Meetings: {len(case.meetings)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())