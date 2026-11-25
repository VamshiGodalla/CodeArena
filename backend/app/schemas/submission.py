from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import SubmissionStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Going in ----------

class SubmissionCreate(BaseModel):
    problem_id: int
    source_code: str = Field(min_length=1, max_length=50_000)
    language: Literal["python"] = "python"


# ---------- Coming out ----------

class CaseResultOut(ORMModel):
    test_case_id: int
    verdict: SubmissionStatus
    execution_time: float | None


class SubmissionOut(ORMModel):
    id: int
    problem_id: int
    language: str
    status: SubmissionStatus
    execution_time: float | None
    error_message: str | None
    created_at: datetime


class SubmissionDetail(SubmissionOut):
    source_code: str
    results: list[CaseResultOut]


class SubmissionListItem(BaseModel):
    id: int
    problem_id: int
    problem_title: str
    status: SubmissionStatus
    execution_time: float | None
    created_at: datetime


class StatsOut(BaseModel):
    total_submissions: int
    accepted_submissions: int
    acceptance_rate: float
    problems_attempted: int
    problems_solved: int
    solved_by_difficulty: dict[str, int]