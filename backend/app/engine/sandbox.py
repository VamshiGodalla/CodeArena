import subprocess
import sys
from dataclasses import dataclass


@dataclass
class RunResult:
    stdout: str
    stderr: str
    timed_out: bool
    exit_code: int | None


def run_python(code: str, stdin_data: str, time_limit_sec: float) -> RunResult:
    """Run user's Python code with the given input. Stop it if it takes too long."""
    try:
        completed = subprocess.run(
            [sys.executable, "-c", code],
            input=stdin_data,
            capture_output=True,
            text=True,
            timeout=time_limit_sec,
        )
        return RunResult(
            stdout=completed.stdout,
            stderr=completed.stderr,
            timed_out=False,
            exit_code=completed.returncode,
        )
    except subprocess.TimeoutExpired as e:
        return RunResult(
            stdout=e.stdout or "",
            stderr=e.stderr or "",
            timed_out=True,
            exit_code=None,
        )