import json
import logging
import re
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

from app.config import PROJECT_ROOT, rule_config, settings
from app.models import Case

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Case File #1105 — The Boyd Orr Firework Plot",
    description=(
        "Investigate student movements, check alibis, inspect evidence, "
        "and identify suspicious connections. The API supports reusable "
        "case data and configurable investigation rules."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

SAMPLE_CASE_PATH = (
    PROJECT_ROOT / "frontend" / "public" / "case.sample.json"
)

# In-memory cache: populated during startup.
case_cache: Case | None = None


def load_sample_case() -> Case:
    """Load the valid sample case used when the real pipeline isn't ready."""
    if not SAMPLE_CASE_PATH.exists():
        raise RuntimeError(
            f"Sample case not found at {SAMPLE_CASE_PATH}. "
            "Create frontend/public/case.sample.json first."
        )

    try:
        return Case.model_validate_json(
            SAMPLE_CASE_PATH.read_text(encoding="utf-8")
        )
    except Exception as exc:
        raise RuntimeError(
            f"The sample case is invalid: {exc}"
        ) from exc


def generate_case(raw_dir: Path) -> Case:
    """Run the cleaning pipeline and build the investigation case."""
    from app.analysis.build_case import build_case
    from app.pipeline.run import run_pipeline

    clean = run_pipeline(raw_dir)
    return build_case(clean, rule_config)


def refresh_case() -> Case:
    """Build a case from raw data, falling back to the sample if necessary."""
    global case_cache

    try:
        case_cache = generate_case(settings.RAW_DIR)
        logger.info("Investigation case built from raw data.")
    except Exception:
        logger.warning(
            "The real data pipeline is not ready or failed. "
            "Loading the sample case instead.",
            exc_info=True,
        )
        case_cache = load_sample_case()

    return case_cache


@app.on_event("startup")
def startup_event() -> None:
    """Prepare the cached case when the API starts."""
    refresh_case()


def get_case() -> Case:
    """Return the cached case, ensuring one is available."""
    if case_cache is None:
        return refresh_case()

    return case_cache


def normalise_student_id(raw_id: str) -> str:
    """Normalise an ID for lookup without assuming a particular ID value."""
    return re.sub(r"\s+", "", raw_id).upper()


def find_student(case: Case, raw_id: str):
    """Resolve a canonical student ID or any recorded raw ID."""
    target = normalise_student_id(raw_id)

    for student in case.students:
        candidates = {
            normalise_student_id(student.id),
            *(normalise_student_id(item) for item in student.raw_ids),
        }

        if target in candidates:
            return student

    return None


class RuleConfigUpdate(BaseModel):
    """Optional settings accepted by PUT /api/config."""

    CONSPIRATOR_COUNT: int | None = Field(default=None, ge=1)
    SEVERITY: dict[str, int] | None = None
    MIN_MEETING_MINUTES: int | None = Field(default=None, ge=1)


@app.get(
    "/api/health",
    summary="Check API health",
    description="Returns a simple status response when the API is running.",
)
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/api/case",
    response_model=Case,
    summary="Get the complete investigation case",
    description=(
        "Returns the cached case, including students, buildings, visits, "
        "statements, flags, meetings, suspect scores, data-quality issues, "
        "and oddities."
    ),
)
def get_full_case() -> Case:
    return get_case()


@app.get(
    "/api/students/{student_id}",
    summary="Get evidence for one student",
    description=(
        "Accepts a canonical student ID or a raw ID recorded in the data. "
        "Returns the student's profile and related investigation evidence."
    ),
)
def get_student_details(student_id: str) -> dict[str, Any]:
    case = get_case()
    student = find_student(case, student_id)

    if student is None:
        raise HTTPException(
            status_code=404,
            detail=f"No student found for ID '{student_id}'.",
        )

    visits = [
        visit
        for visit in case.visits
        if visit.student_id == student.id
    ]

    statement = next(
        (
            item
            for item in case.statements
            if item.student_id == student.id
        ),
        None,
    )

    flags = [
        flag
        for flag in case.flags
        if flag.student_id == student.id
    ]

    suspect = next(
        (
            item
            for item in case.suspects
            if item.student_id == student.id
        ),
        None,
    )

    meetings = [
        meeting
        for meeting in case.meetings
        if meeting.a == student.id or meeting.b == student.id
    ]

    return {
        "student": student,
        "visits": visits,
        "statement": statement,
        "flags": flags,
        "suspect": suspect,
        "meetings": meetings,
    }


@app.get(
    "/api/buildings/{building_id}",
    summary="Get building details and recorded visits",
)
def get_building_details(building_id: str) -> dict[str, Any]:
    case = get_case()

    building = next(
        (
            item
            for item in case.buildings
            if item.id == building_id
        ),
        None,
    )

    if building is None:
        raise HTTPException(
            status_code=404,
            detail=f"No building found with ID '{building_id}'.",
        )

    visits = [
        visit
        for visit in case.visits
        if visit.building_id == building.id
    ]

    return {
        "building": building,
        "visits": visits,
    }


@app.get(
    "/api/meetings",
    summary="Filter recorded meetings",
    description=(
        "Optionally return meetings that start at or before a specified "
        "investigation minute, and/or meetings involving one student."
    ),
)
def get_meetings(
    until: int | None = Query(
        default=None,
        ge=0,
        description="Include meetings starting at or before this minute.",
    ),
    student: str | None = Query(
        default=None,
        description="Canonical or raw student ID.",
    ),
) -> list:
    case = get_case()
    meetings = case.meetings

    if until is not None:
        meetings = [
            meeting
            for meeting in meetings
            if meeting.start <= until
        ]

    if student is not None:
        resolved_student = find_student(case, student)

        if resolved_student is None:
            raise HTTPException(
                status_code=404,
                detail=f"No student found for ID '{student}'.",
            )

        meetings = [
            meeting
            for meeting in meetings
            if (
                meeting.a == resolved_student.id
                or meeting.b == resolved_student.id
            )
        ]

    return meetings


@app.post(
    "/api/upload",
    response_model=Case,
    summary="Upload four source files and rebuild the case",
    description=(
        "Upload people data, security logs, building locations, and "
        "student statements. The API runs the pipeline and replaces "
        "the cached case only after successful processing."
    ),
)
async def upload_case(
    people: UploadFile = File(..., description="People data CSV"),
    logs: UploadFile = File(..., description="Security logs CSV"),
    locations: UploadFile = File(..., description="Building locations CSV"),
    statements: UploadFile = File(..., description="Student statements text"),
) -> Case:
    global case_cache

    uploads = {
        "people_data.csv": people,
        "security_logs.csv": logs,
        "location_data.csv": locations,
        "student_statements.txt": statements,
    }

    try:
        with tempfile.TemporaryDirectory(
            prefix="boyd-orr-upload-"
        ) as temp_dir:
            temp_path = Path(temp_dir)

            for filename, upload in uploads.items():
                content = await upload.read()

                if not content:
                    raise HTTPException(
                        status_code=422,
                        detail=f"The uploaded file '{filename}' is empty.",
                    )

                destination = temp_path / filename
                destination.write_bytes(content)

            try:
                new_case = generate_case(temp_path)
            except HTTPException:
                raise
            except Exception as exc:
                logger.exception("Uploaded files could not be processed.")
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "The uploaded files could not be processed. "
                        f"Check their formats and contents. Reason: {exc}"
                    ),
                ) from exc

            # Replace the cache only after successful processing.
            case_cache = new_case
            logger.info("Investigation case rebuilt from uploaded files.")

            return new_case

    finally:
        for upload in uploads.values():
            await upload.close()


@app.get(
    "/api/config",
    summary="Get investigation rule configuration",
)
def get_config() -> dict[str, Any]:
    return rule_config.model_dump()


@app.put(
    "/api/config",
    summary="Update investigation rules and re-score the case",
    description=(
        "Updates the configurable rule weights, conspirator count, "
        "or minimum meeting duration, then rebuilds the investigation "
        "results from the existing cleaned data."
    ),
)
def update_config(update: RuleConfigUpdate) -> Case:
    global case_cache

    changes = update.model_dump(exclude_unset=True, exclude_none=True)

    if not changes:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one configuration value to update.",
        )

    old_config = rule_config.model_dump()

    try:
        for key, value in changes.items():
            setattr(rule_config, key, value)

        # Re-run analysis using the existing raw data.
        # The pipeline is rerun here for compatibility with the agreed
        # build_case(clean, config) interface.
        new_case = generate_case(settings.RAW_DIR)
        case_cache = new_case

    except Exception as exc:
        # Restore the previous configuration if rebuilding fails.
        for key, value in old_config.items():
            setattr(rule_config, key, value)

        logger.exception("Configuration update failed.")
        raise HTTPException(
            status_code=500,
            detail=f"Could not apply the new configuration: {exc}",
        ) from exc

    return new_case