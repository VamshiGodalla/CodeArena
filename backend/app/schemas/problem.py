from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models import Difficulty


# ---------- Test cases ----------

class TestCaseCreate(BaseModel):
    """What an admin sends to add one test case."""
    input: str
    expected_output: str
    is_hidden: bool = True  # hidden by default, so nothing leaks by accident


class TestCaseOut(BaseModel):
    """Full test case, including hidden ones. Admin only."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    input: str
    expected_output: str
    is_hidden: bool


class SampleTestCase(BaseModel):
    """A sample shown to normal users. No id, no is_hidden flag."""
    model_config = ConfigDict(from_attributes=True)

    input: str
    expected_output: str


# ---------- Problems: coming IN (admin) ----------

class ProblemCreate(BaseModel):
    """What an admin sends to create a problem."""
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    difficulty: Difficulty
    constraints: str | None = None
    time_limit: float = Field(default=2.0, gt=0, le=10)       # seconds
    memory_limit: int = Field(default=256, ge=16, le=1024)    # megabytes
    is_published: bool = False
    test_cases: list[TestCaseCreate] = []


class ProblemUpdate(BaseModel):
    """What an admin sends to edit a problem. Every field is optional."""
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    difficulty: Difficulty | None = None
    constraints: str | None = None
    time_limit: float | None = Field(default=None, gt=0, le=10)
    memory_limit: int | None = Field(default=None, ge=16, le=1024)
    is_published: bool | None = None


# ---------- Problems: going OUT ----------

class ProblemSummary(BaseModel):
    """One row in the problem list. Short on purpose."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    difficulty: Difficulty


class ProblemDetail(ProblemSummary):
    """One full problem, as a normal user sees it."""
    description: str
    constraints: str | None
    time_limit: float
    memory_limit: int
    sample_test_cases: list[SampleTestCase] = []


class ProblemAdminOut(ProblemDetail):
    """One full problem, as an admin sees it: everything."""
    is_published: bool
    created_at: datetime
    test_cases: list[TestCaseOut] = []