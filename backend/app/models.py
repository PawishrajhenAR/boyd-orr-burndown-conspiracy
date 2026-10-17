from typing import Literal

from pydantic import BaseModel


class Lecture(BaseModel):
    subject: str
    start: int
    end: int
    source: Literal["description", "inferred"]


class Building(BaseModel):
    id: str
    name: str
    lat: float
    lon: float

    open_start: int
    open_end: int
    always_open: bool
    open_label: str

    lectures: list[Lecture]
    min_age: int | None
    description: str
    aliases: list[str]


class Student(BaseModel):
    id: str
    name: str
    age: int
    sex: str
    year: int
    subject: str
    height: int
    hair_colour: str

    societies: list[str]
    has_statement: bool
    raw_ids: list[str]

    lecture: Lecture | None
    lecture_building_id: str | None


class Visit(BaseModel):
    id: str
    student_id: str
    building_id: str

    start: int
    end: int

    raw_time: str
    raw_student_id: str
    raw_location: str


class Claim(BaseModel):
    building_id: str
    text: str
    char_start: int
    char_end: int
    hypothetical: bool
    matched_visit_id: str | None


class Statement(BaseModel):
    student_id: str
    raw_student_id: str
    name: str
    text: str
    claims: list[Claim]


class Flag(BaseModel):
    id: str
    student_id: str

    rule: Literal[
        "missing_lecture",
        "multiple_lectures",
        "left_lecture_early",
        "out_of_hours",
        "impossible_overlap",
        "age_restricted_venue",
        "id_mismatch",
        "id_format",
        "statement_contradiction",
        "statement_omission",
        "false_society_claim",
        "subject_without_lecture",
    ]

    severity: int

    title: str
    detail: str

    visit_ids: list[str]
    building_id: str | None
    time: int | None

    statement_span: tuple[int, int] | None


class Meeting(BaseModel):
    id: str
    a: str
    b: str
    building_id: str

    start: int
    end: int
    minutes: int


class Suspect(BaseModel):
    student_id: str
    score: int
    flag_count: int
    rank: int

    verdict: Literal[
        "conspirator",
        "mastermind",
        "suspicious",
        "clear",
    ]

    conspirators_met: list[str]
    meeting_ids_with_conspirators: list[str]


class DataQualityIssue(BaseModel):
    file: str
    row: int | None
    column: str
    issue: str
    original: str
    fixed: str


class Oddity(BaseModel):
    id: str
    title: str
    detail: str

    student_ids: list[str]
    building_ids: list[str]


class CaseMeta(BaseModel):
    case_name: str
    generated_at: str
    day_label: str
    source_files: list[str]

    counts: dict[str, int]

    conspirator_count: int
    time_min: int
    time_max: int


class Case(BaseModel):
    meta: CaseMeta

    buildings: list[Building]
    students: list[Student]
    visits: list[Visit]
    statements: list[Statement]

    flags: list[Flag]
    meetings: list[Meeting]
    suspects: list[Suspect]

    data_quality: list[DataQualityIssue]
    oddities: list[Oddity]