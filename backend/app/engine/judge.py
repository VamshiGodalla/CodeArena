from sqlalchemy import select
from sqlalchemy.orm import Session

from app.engine.sandbox import run_python
from app.models import Problem, SubmissionStatus, TestCase


VERDICT_TO_STATUS = {
    "Accepted": SubmissionStatus.ACCEPTED,
    "Wrong Answer": SubmissionStatus.WRONG_ANSWER,
    "Time Limit Exceeded": SubmissionStatus.TIME_LIMIT_EXCEEDED,
    "Runtime Error": SubmissionStatus.RUNTIME_ERROR,
}


def _normalize(text: str) -> list[str]:
    """Ignore extra spaces at line ends and blank lines at the start or end."""
    return [line.rstrip() for line in text.strip().splitlines()]


def outputs_match(expected: str, actual: str) -> bool:
    return _normalize(expected) == _normalize(actual)


def judge_submission(
    code: str,
    test_cases: list[tuple[str, str]],
    time_limit_sec: float,
) -> str:
    """Run the code on every test case. Return the first failing verdict, or 'Accepted'."""
    for test_input, expected_output in test_cases:
        result = run_python(code, test_input, time_limit_sec)

        if result.timed_out:
            return "Time Limit Exceeded"
        if result.exit_code != 0:
            return "Runtime Error"
        if not outputs_match(expected_output, result.stdout):
            return "Wrong Answer"

    return "Accepted"


def judge_problem(db: Session, problem_id: int, code: str) -> SubmissionStatus:
    """Load a problem's test cases from the database and judge the code against all of them."""
    problem = db.get(Problem, problem_id)
    if problem is None:
        return SubmissionStatus.INTERNAL_ERROR

    rows = db.scalars(
        select(TestCase)
        .where(TestCase.problem_id == problem_id)
        .order_by(TestCase.id)
    ).all()
    if not rows:
        return SubmissionStatus.INTERNAL_ERROR

    cases = [(t.input, t.expected_output) for t in rows]
    verdict = judge_submission(code, cases, problem.time_limit)
    return VERDICT_TO_STATUS.get(verdict, SubmissionStatus.INTERNAL_ERROR)