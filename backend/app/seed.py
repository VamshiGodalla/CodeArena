"""Load starter problems into the database.

Run with:  docker compose exec api python -m app.seed
Safe to run more than once: problems that already exist are skipped.
"""
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Difficulty, Problem, TestCase


# ---------- Big hidden tests (catch slow solutions on Day 4) ----------

def _big_two_sum() -> tuple[str, str]:
    # 100,000 distinct even numbers, except the last one, which is 1 (the only odd number).
    # An odd target can only be made from that 1 plus one even number, so there's exactly one answer.
    n = 100_000
    nums = [2 * i for i in range(n)]
    nums[-1] = 1
    target = 1 + nums[50_000]  # 1 + 100000 = 100001
    return f"{n}\n{' '.join(map(str, nums))}\n{target}", "50000 99999"


def _big_lis() -> tuple[str, str]:
    # 0, 1, 2, ... 999 repeated 100 times. Values only go up to 999,
    # so the longest strictly increasing run is 0..999 = 1000 numbers.
    n = 100_000
    nums = [i % 1000 for i in range(n)]
    return f"{n}\n{' '.join(map(str, nums))}", "1000"


# ---------- The problems ----------

PROBLEMS = [
    {
        "title": "Sum of Two Numbers",
        "difficulty": Difficulty.EASY,
        "description": (
            "Read two integers a and b and print their sum.\n\n"
            "Input: one line with two integers a and b, separated by a space.\n"
            "Output: one integer, a + b."
        ),
        "constraints": "-10^9 <= a, b <= 10^9",
        "samples": [("3 5", "8"), ("-4 10", "6")],
        "hidden": [("0 0", "0"), ("1000000000 1000000000", "2000000000"), ("-7 -8", "-15")],
    },
    {
        "title": "Reverse a String",
        "difficulty": Difficulty.EASY,
        "description": (
            "Read a string s and print it reversed.\n\n"
            "Input: one line containing s (no spaces).\n"
            "Output: s reversed."
        ),
        "constraints": "1 <= length of s <= 10^5",
        "samples": [("hello", "olleh"), ("CodeArena", "anerAedoC")],
        "hidden": [("a", "a"), ("racecar", "racecar"), ("12345", "54321")],
    },
    {
        "title": "Maximum Element",
        "difficulty": Difficulty.EASY,
        "description": (
            "Given n integers, print the largest one.\n\n"
            "Input: the first line has n. The second line has n integers separated by spaces.\n"
            "Output: the largest integer."
        ),
        "constraints": "1 <= n <= 10^5, -10^9 <= each number <= 10^9",
        "samples": [("5\n3 9 2 7 4", "9"), ("3\n-5 -1 -9", "-1")],
        "hidden": [
            ("1\n42", "42"),
            ("4\n7 7 7 7", "7"),
            ("6\n-1000000000 0 999999999 5 -3 1000000000", "1000000000"),
        ],
    },
    {
        "title": "Two Sum",
        "difficulty": Difficulty.MEDIUM,
        "description": (
            "Given n integers and a target, find the two positions i < j whose numbers "
            "add up to the target. Exactly one such pair exists. Positions start at 0.\n\n"
            "Input: the first line has n. The second line has n integers. "
            "The third line has the target.\n"
            "Output: i and j separated by a space."
        ),
        "constraints": "2 <= n <= 10^5, -10^9 <= each number, target <= 10^9",
        "samples": [("4\n2 7 11 15\n9", "0 1"), ("3\n3 2 4\n6", "1 2")],
        "hidden": [("2\n3 3\n6", "0 1"), ("5\n1 4 10 -3 7\n17", "2 4"), _big_two_sum()],
    },
    {
        "title": "Longest Increasing Subsequence",
        "difficulty": Difficulty.HARD,
        "description": (
            "Given n integers, print the length of the longest strictly increasing "
            "subsequence. A subsequence keeps the original order but may skip numbers.\n\n"
            "Input: the first line has n. The second line has n integers.\n"
            "Output: one integer, the length."
        ),
        "constraints": "1 <= n <= 10^5, -10^9 <= each number <= 10^9",
        "samples": [("8\n10 9 2 5 3 7 101 18", "4"), ("6\n0 1 0 3 2 3", "4")],
        "hidden": [("1\n5", "1"), ("5\n5 4 3 2 1", "1"), ("7\n7 7 7 7 7 7 7", "1"), _big_lis()],
    },
]


def seed() -> None:
    db = SessionLocal()
    try:
        created = 0
        for p in PROBLEMS:
            existing = db.scalar(select(Problem).where(Problem.title == p["title"]))
            if existing is not None:
                print(f"skip    {p['title']} (already exists)")
                continue

            problem = Problem(
                title=p["title"],
                description=p["description"],
                difficulty=p["difficulty"],
                constraints=p["constraints"],
                is_published=True,
            )
            problem.test_cases = (
                [TestCase(input=i, expected_output=o, is_hidden=False) for i, o in p["samples"]]
                + [TestCase(input=i, expected_output=o, is_hidden=True) for i, o in p["hidden"]]
            )
            db.add(problem)
            created += 1
            print(f"create  {p['title']}")

        db.commit()
        print(f"Done: {created} problem(s) created.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()