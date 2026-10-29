"""The `ci-ok` decision: one pass/fail over GitHub's `needs` JSON.

`uv run --no-project python scripts/ci_verdict.py [needs.json]` reads the JSON of
`${{ toJSON(needs) }}` (a file, or stdin when none is given), prints one line per job, and
exits 0 when the pull request may merge, 1 otherwise. `verdict` is pure; `main` only reads
and prints. Lines carry job names and results, nothing else.

- `changes` must be `success`, or the verdict fails before it reads any flag.
- A gating suite (`SUITES`) passes on `success`; on `skipped` only when its `changes` flag
  is "false". A "true" or missing flag, `failure` and `cancelled` fail.
- `ALWAYS_JOBS` must be `success`.
- `WARN_JOBS` and `PARKED_SUITES` (a suite that gates nothing, see `stack.yaml` `ci:`) pass
  on `success`, and on a parked suite skipped with a "false" flag; any other result is a
  warning, except `cancelled`, which fails.
- A job in no map fails by name.
"""

from __future__ import annotations

import json
import sys
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import cast

# job id -> the `changes` output flag that says whether the suite had to run.
SUITES: dict[str, str] = {"pytest": "pytest", "vitest": "vitest"}
# Suites CI runs that gate nothing (tests/test_stack_ci.py PARKED); they warn instead of fail.
PARKED_SUITES: dict[str, str] = {"e2e": "e2e"}
ALWAYS_JOBS = ("checks", "web")
WARN_JOBS = ("coverage",)
CHANGES = "changes"

Judge = Callable[[str, str], tuple[bool, str]]


def _result(entry: object) -> str | None:
    """The `result` of one `needs` entry, or None when the entry has no usable one."""
    if not isinstance(entry, Mapping):
        return None
    result = cast("Mapping[str, object]", entry).get("result")
    return result if isinstance(result, str) else None


def _flags(entry: object) -> Mapping[str, object]:
    """The `outputs` of the `changes` entry (empty when it has none)."""
    if not isinstance(entry, Mapping):
        return {}
    outputs = cast("Mapping[str, object]", entry).get("outputs")
    return cast("Mapping[str, object]", outputs) if isinstance(outputs, Mapping) else {}


def _gating(flags: Mapping[str, object], flag_name: str) -> Judge:
    def judge(name: str, result: str) -> tuple[bool, str]:
        if result == "success":
            return True, f"{name}: success"
        if result == "skipped":
            flag = flags.get(flag_name)
            if flag == "false":
                return True, f"{name}: skipped"
            shown = "missing" if flag is None else repr(flag)
            return False, f"{name}: skipped but its flag is {shown}"
        return False, f"{name}: {result}"

    return judge


def _always(name: str, result: str) -> tuple[bool, str]:
    return result == "success", f"{name}: {result}"


def _warning(flags: Mapping[str, object], flag_name: str | None) -> Judge:
    def judge(name: str, result: str) -> tuple[bool, str]:
        quiet_skip = (
            result == "skipped" and flag_name is not None and flags.get(flag_name) == "false"
        )
        if result == "success" or quiet_skip:
            return True, f"{name}: {result}"
        if result == "cancelled":
            return False, f"{name}: cancelled"
        return True, f"{name}: {result} (warning)"

    return judge


def verdict(needs: Mapping[str, object]) -> tuple[bool, list[str]]:
    """Whether the pull request may merge, and one line per job."""
    changes = _result(needs.get(CHANGES))
    if changes != "success":
        return False, [f"{CHANGES}: {changes or 'no result'}"]

    flags = _flags(needs[CHANGES])
    judges: dict[str, Judge] = {}
    for job, flag_name in SUITES.items():
        judges[job] = _gating(flags, flag_name)
    for job in ALWAYS_JOBS:
        judges[job] = _always
    for job, flag_name in PARKED_SUITES.items():
        judges[job] = _warning(flags, flag_name)
    for job in WARN_JOBS:
        judges[job] = _warning(flags, None)

    ok = True
    lines = [f"{CHANGES}: success"]
    for job, judge in judges.items():
        result = _result(needs.get(job))
        if job not in needs:
            passed, line = False, f"{job}: missing"
        elif result is None:
            passed, line = False, f"{job}: no result"
        else:
            passed, line = judge(job, result)
        ok = ok and passed
        lines.append(line)
    for job in needs:
        if job != CHANGES and job not in judges:
            ok = False
            lines.append(f"{job}: unknown job")
    return ok, lines


def main(argv: Sequence[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    raw = Path(args[0]).read_text() if args else sys.stdin.read()
    parsed: object = json.loads(raw)
    if not isinstance(parsed, dict):
        print("needs: not a JSON object")
        return 1
    ok, lines = verdict(cast("dict[str, object]", parsed))
    print("\n".join(lines))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
