import time

from sqlalchemy import select

from app.db.session import SessionLocal
from app.engine.judge import outputs_match
from app.engine.sandbox import run_python
from app.models import Submission, SubmissionResult, SubmissionStatus, TestCase
from app.worker.celery_app import celery_app

MAX_ERROR_CHARS = 2000


def check_one_test(code: str, test_input: str, expected: str, time_limit: float):
    """Run the code on one test. Return (verdict, seconds taken, stderr)."""
    start = time.perf_counter()
    result = run_python(code, test_input, time_limit)
    elapsed = round(time.perf_counter() - start, 3)

    if result.timed_out:
        verdict = SubmissionStatus.TIME_LIMIT_EXCEEDED
    elif result.exit_code != 0:
        verdict = SubmissionStatus.RUNTIME_ERROR
    elif not outputs_match(expected, result.stdout):
        verdict = SubmissionStatus.WRONG_ANSWER
    else:
        verdict = SubmissionStatus.ACCEPTED

    return verdict, elapsed, result.stderr


@celery_app.task(name="judge_submission")
def judge_submission_task(submission_id: int) -> None:
    db = SessionLocal()
    try:
        submission = db.get(Submission, submission_id)
        if submission is None:
            return

        # 1. Mark it as running so the user sees progress
        submission.status = SubmissionStatus.RUNNING
        db.commit()

        # 2. Load all test cases for this problem (samples and hidden)
        tests = db.scalars(
            select(TestCase)
            .where(TestCase.problem_id == submission.problem_id)
            .order_by(TestCase.id)
        ).all()

        if not tests:
            submission.status = SubmissionStatus.INTERNAL_ERROR
            submission.error_message = "This problem has no test cases."
            db.commit()
            return

        # 3. Run each test, save its result, stop at the first failure
        final_verdict = SubmissionStatus.ACCEPTED
        slowest = 0.0

        for test in tests:
            verdict, elapsed, stderr = check_one_test(
                submission.source_code,
                test.input,
                test.expected_output,
                submission.problem.time_limit,
            )
            db.add(
                SubmissionResult(
                    submission_id=submission.id,
                    test_case_id=test.id,
                    verdict=verdict,
                    execution_time=elapsed,
                )
            )
            slowest = max(slowest, elapsed)

            if verdict != SubmissionStatus.ACCEPTED:
                final_verdict = verdict
                if verdict == SubmissionStatus.RUNTIME_ERROR:
                    submission.error_message = stderr[-MAX_ERROR_CHARS:]
                break

        # 4. Save the final verdict
        submission.status = final_verdict
        submission.execution_time = slowest
        db.commit()

    except Exception as exc:
        # Something broke in our code, not the user's: mark it so it never stays RUNNING forever
        db.rollback()
        submission = db.get(Submission, submission_id)
        if submission is not None:
            submission.status = SubmissionStatus.INTERNAL_ERROR
            submission.error_message = str(exc)[:500]
            db.commit()
        raise
    finally:
        db.close()