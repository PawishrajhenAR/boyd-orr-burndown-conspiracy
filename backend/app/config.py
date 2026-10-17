from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# Repository root: boyd-orr-case/
PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Application settings, with environment-variable overrides."""

    RAW_DIR: Path = PROJECT_ROOT / "data" / "raw"

    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


class RuleConfig(BaseModel):
    """Configurable investigation and suspect-scoring rules."""

    CONSPIRATOR_COUNT: int = Field(default=6, ge=1)

    SEVERITY: dict[str, int] = Field(
        default_factory=lambda: {
            "missing_lecture": 3,
            "multiple_lectures": 2,
            "left_lecture_early": 2,
            "out_of_hours": 3,
            "impossible_overlap": 3,
            "age_restricted_venue": 3,
            "id_mismatch": 2,
            "id_format": 1,
            "statement_contradiction": 2,
            "statement_omission": 0,
            "false_society_claim": 2,
            "subject_without_lecture": 1,
        }
    )

    MIN_MEETING_MINUTES: int = Field(default=1, ge=1)


# Shared application settings and mutable investigation configuration.
settings = Settings()
rule_config = RuleConfig()