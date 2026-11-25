from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Difficulty, Problem, Submission, SubmissionStatus, TestCase, User
from app.schemas.submission import (
    RunCaseOut,
    RunRequest,
    RunResponse,
    StatsOut,
    SubmissionCreate,
    SubmissionDetail,
    SubmissionListItem,
    SubmissionOut,
)
from app.worker.tasks import check_one_test, judge_submission_task

router = APIRouter(tags=["submissions"])

PENDING = (SubmissionStatus.QUEUED, SubmissionStatus.RUNNING)
MAX_PENDING_PER_USER = 3


def _get_published_problem(db: Session, problem_id: int) -> Problem:
    problem = db.get(Problem, problem_id)
    if problem is None or not problem.is_published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Problem not found")
    return problem


@router.post("/submissions", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def create_submission(
    data: SubmissionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    problem = _get_published_problem(db, data.problem_id)

    # Simple abuse protection: one user can't flood the queue
    pending = db.scalar(
        select(func.count())
        .select_from(Submission)
        .where(Submission.user_id == user.id, Submission.status.in_(PENDING))
    )
    if pending >= MAX_PENDING_PER_USER:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "You already have 3 submissions being judged. Wait for them to finish.",
        )

    submission = Submission(
        user_id=user.id,
        problem_id=problem.id,
        source_code=data.source_code,
        language=data.language,
        status=SubmissionStatus.QUEUED,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Put the job on the queue. If Redis is down, don't leave it stuck as QUEUED.
    try:
        judge_submission_task.delay(submission.id)
    except Exception:
        submission.status = SubmissionStatus.INTERNAL_ERROR
        submission.error_message = "Could not queue this submission for judging."
        db.commit()
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The judge is unavailable right now. Try again in a moment.",
        )

    return submission


@router.post("/submissions/run", response_model=RunResponse)
def run_samples(
    data: RunRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Run code on the sample tests only. Nothing is saved."""
    problem = _get_published_problem(db, data.problem_id)

    samples = db.scalars(
        select(TestCase)
        .where(TestCase.problem_id == problem.id, TestCase.is_hidden.is_(False))
        .order_by(TestCase.id)
    ).all()
    if not samples:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This problem has no sample tests to run.")

    cases = []
    overall = SubmissionStatus.ACCEPTED
    for test in samples:
        verdict, elapsed, run = check_one_test(
            data.source_code, test.input, test.expected_output, problem.time_limit
        )
        cases.append(
            RunCaseOut(
                input=test.input,
                expected_output=test.expected_output,
                actual_output=run.stdout[:10_000],
                verdict=verdict,
                execution_time=elapsed,
                error=run.stderr[-2000:] or None,
            )
        )
        if verdict != SubmissionStatus.ACCEPTED and overall == SubmissionStatus.ACCEPTED:
            overall = verdict

    return RunResponse(status=overall, cases=cases)


@router.get("/submissions/{submission_id}", response_model=SubmissionDetail)
def get_submission(
    submission_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.scalar(
        select(Submission)
        .options(selectinload(Submission.results))
        .where(Submission.id == submission_id)
    )
    # 404 (not 403) for other people's submissions, so IDs can't be probed
    if submission is None or (submission.user_id != user.id and not user.is_admin):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")

    detail = SubmissionDetail.model_validate(submission)
    detail.results.sort(key=lambda r: r.test_case_id)
    return detail


@router.get("/users/me/submissions", response_model=list[SubmissionListItem])
def my_submissions(
    problem_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        select(Submission, Problem.title)
        .join(Problem, Problem.id == Submission.problem_id)
        .where(Submission.user_id == user.id)
    )
    if problem_id is not None:
        query = query.where(Submission.problem_id == problem_id)

    rows = db.execute(query.order_by(Submission.created_at.desc()).limit(limit)).all()
    return [
        SubmissionListItem(
            id=s.id,
            problem_id=s.problem_id,
            problem_title=title,
            status=s.status,
            execution_time=s.execution_time,
            created_at=s.created_at,
        )
        for s, title in rows
    ]


@router.get("/users/me/stats", response_model=StatsOut)
def my_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mine = Submission.user_id == user.id
    accepted_filter = Submission.status == SubmissionStatus.ACCEPTED

    total = db.scalar(select(func.count()).select_from(Submission).where(mine)) or 0
    accepted = db.scalar(
        select(func.count()).select_from(Submission).where(mine, accepted_filter)
    ) or 0
    attempted = db.scalar(
        select(func.count(func.distinct(Submission.problem_id))).where(mine)
    ) or 0

    # Distinct problems solved, grouped by difficulty
    rows = db.execute(
        select(Problem.difficulty, func.count(func.distinct(Submission.problem_id)))
        .join(Problem, Problem.id == Submission.problem_id)
        .where(mine, accepted_filter)
        .group_by(Problem.difficulty)
    ).all()
    by_difficulty = {d.value: 0 for d in Difficulty}
    for difficulty, count in rows:
        by_difficulty[getattr(difficulty, "value", difficulty)] = count

    return StatsOut(
        total_submissions=total,
        accepted_submissions=accepted,
        acceptance_rate=round(accepted / total * 100, 1) if total else 0.0,
        problems_attempted=attempted,
        problems_solved=sum(by_difficulty.values()),
        solved_by_difficulty=by_difficulty,
    )