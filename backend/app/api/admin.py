from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models import Problem, TestCase
from app.schemas.problem import (
    ProblemAdminOut,
    ProblemCreate,
    ProblemUpdate,
    SampleTestCase,
    TestCaseCreate,
    TestCaseOut,
)

# Every endpoint in this file requires an admin. One line protects them all.
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


# ---------- Small helpers ----------

def _get_problem_or_404(db: Session, problem_id: int) -> Problem:
    problem = db.get(Problem, problem_id)
    if problem is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    return problem


def _to_admin_out(problem: Problem) -> ProblemAdminOut:
    out = ProblemAdminOut.model_validate(problem)
    # Also fill in what a normal user would see, as a preview
    out.sample_test_cases = [
        SampleTestCase.model_validate(tc) for tc in problem.test_cases if not tc.is_hidden
    ]
    return out


def _commit_or_409(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A problem with this title already exists",
        )


# ---------- Problems ----------

@router.get("/problems", response_model=list[ProblemAdminOut])
def list_all_problems(db: Session = Depends(get_db)):
    """All problems, published or not."""
    problems = db.scalars(select(Problem).order_by(Problem.id)).all()
    return [_to_admin_out(p) for p in problems]


@router.post("/problems", response_model=ProblemAdminOut, status_code=status.HTTP_201_CREATED)
def create_problem(data: ProblemCreate, db: Session = Depends(get_db)):
    problem = Problem(**data.model_dump(exclude={"test_cases"}))
    problem.test_cases = [TestCase(**tc.model_dump()) for tc in data.test_cases]
    db.add(problem)
    _commit_or_409(db)
    db.refresh(problem)
    return _to_admin_out(problem)


@router.patch("/problems/{problem_id}", response_model=ProblemAdminOut)
def update_problem(problem_id: int, data: ProblemUpdate, db: Session = Depends(get_db)):
    problem = _get_problem_or_404(db, problem_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(problem, field, value)
    _commit_or_409(db)
    db.refresh(problem)
    return _to_admin_out(problem)


@router.delete("/problems/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_problem(problem_id: int, db: Session = Depends(get_db)):
    problem = _get_problem_or_404(db, problem_id)
    db.delete(problem)
    db.commit()


# ---------- Test cases ----------

@router.post(
    "/problems/{problem_id}/test-cases",
    response_model=TestCaseOut,
    status_code=status.HTTP_201_CREATED,
)
def add_test_case(problem_id: int, data: TestCaseCreate, db: Session = Depends(get_db)):
    problem = _get_problem_or_404(db, problem_id)
    test_case = TestCase(problem_id=problem.id, **data.model_dump())
    db.add(test_case)
    db.commit()
    db.refresh(test_case)
    return test_case


@router.delete("/test-cases/{test_case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_test_case(test_case_id: int, db: Session = Depends(get_db)):
    test_case = db.get(TestCase, test_case_id)
    if test_case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")
    db.delete(test_case)
    db.commit()