from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Difficulty, Problem
from app.schemas.problem import ProblemDetail, ProblemSummary, SampleTestCase

router = APIRouter(prefix="/problems", tags=["problems"])


@router.get("", response_model=list[ProblemSummary])
def list_problems(
    difficulty: Difficulty | None = None,
    db: Session = Depends(get_db),
):
    """List published problems, optionally filtered by difficulty."""
    query = select(Problem).where(Problem.is_published.is_(True)).order_by(Problem.id)
    if difficulty is not None:
        query = query.where(Problem.difficulty == difficulty)
    return db.scalars(query).all()


@router.get("/{problem_id}", response_model=ProblemDetail)
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    """Show one published problem with its SAMPLE test cases only."""
    problem = db.get(Problem, problem_id)
    if problem is None or not problem.is_published:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    detail = ProblemDetail.model_validate(problem)
    detail.sample_test_cases = [
        SampleTestCase.model_validate(tc) for tc in problem.test_cases if not tc.is_hidden
    ]
    return detail