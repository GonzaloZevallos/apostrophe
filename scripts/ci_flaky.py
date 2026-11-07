"""The flaky report of CI (GH-563): which tests failed on a first attempt and passed on the retry.

A suite retries a failed test once, only when `CI` is set (Playwright `retries`, vitest `retry`,
pytest `--reruns 1`). A test with at least one failed attempt and a final pass is flaky; a test
that failed on its final attempt is not, whatever its history: it leaves its job red. Two commands,
both always exit 0 and print test ids only, never a message, a stack or captured output (those can
hold what a test typed; CODING_STANDARDS section 9, the same rule as `scripts/e2e_failures.py`):

    ci_flaky.py extract <playwright|pytest|vitest> <raw result file> <out.json>
        reads one suite's raw result and writes `{"v":1,"check":"<name>","tests":["<id>",...]}`;
        a missing or unreadable input writes an empty list.
    ci_flaky.py report <dir>
        reads every `*.json` below <dir> (the downloaded `flaky-*` artifacts), adds the shards of
        a check up and prints one block line per check that has a flaky test.

Raw inputs, with the field names read from a real run of the pinned versions:
    playwright  the `json` reporter: each spec of `suites[...].specs[]` has `tests[].results[]`,
                each with a `status` (`passed`, `failed`, `timedOut`, `interrupted`, `skipped`);
                a serial group reruns whole, so only a test with a failed result before its final
                passed one counts, not the members that passed twice or were skipped and then ran.
    pytest      `--junitxml` with `-o junit_family=xunit1` (it adds `file`): pytest-rerunfailures
                writes each attempt as a `testcase`, a failed attempt before the last as a bare one
                and the final attempt with its `failure` or `error`, if any.
    vitest      the `json` reporter: `testResults[].assertionResults[]` with a `status` and one
                `failureMessages` entry per failed attempt; a test that passed after a retry has
                status `passed` and a non-empty `failureMessages`.

The format is the one agentic-system #464 defines (ADR-0085, GH-478, merge commit
d052f6d74429ef4f2a34dc416b3aea27abeeed8a, `agentic/core/process/domain/ci.py`):

    A CI job prints a line `agentic-flakes: ` followed by a JSON object
    `{"v":1,"check":"<name>","tests":["<id>",...]}` for the flakes its own reruns found.
    `check` is a name the stack declares in `checks:` at the task's base; any other is dropped.
    The system reads the log of the jobs named in the stack's `ci:` (here `ci-ok`), keeps the
    lines that start with the prefix once gh's columns and timestamp are stripped, and per
    `(job, check)` the last block wins. A block with another `v`, a non-string `check`, ids that
    are not a list of strings or bad JSON is dropped whole. An id longer than 200 characters, or
    with a newline, a backtick, `<!--`, `-->` or `{{`, is dropped. The block is evidence, never a
    verdict: it changes no pass, fail or merge decision.

So `report` prints those lines to stdout, in the log of the `ci-ok` job.
"""

from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Final

BLOCK_PREFIX: Final = "agentic-flakes: "
VERSION: Final = 1
# The longest id the system's reader keeps (`FLAKE_ID_MAX_CHARS`): a longer one is cut, not lost.
ID_MAX_CHARS: Final = 200
SEPARATOR: Final = " › "
# The stack's check each suite belongs to (`.agentic/stack.yaml`, `checks:`).
CHECKS: Final = {"playwright": "web-e2e", "pytest": "tests", "vitest": "web-tests"}
FAILED_ATTEMPT: Final = frozenset({"failed", "timedOut", "interrupted"})


def _mapping(value: object) -> Mapping[str, object]:
    return value if isinstance(value, dict) else {}


def _sequence(value: object) -> Sequence[object]:
    return value if isinstance(value, list) else []


def _text(value: object) -> str:
    return value if isinstance(value, str) else ""


def _playwright_suite(suite: Mapping[str, object], titles: Sequence[str]) -> list[str]:
    """The flaky ids below `suite`; `titles` are the describe titles above it, none for a file."""
    found: list[str] = []
    for spec_raw in _sequence(suite.get("specs")):
        spec = _mapping(spec_raw)
        for test_raw in _sequence(spec.get("tests")):
            statuses = [
                _text(_mapping(result).get("status"))
                for result in _sequence(_mapping(test_raw).get("results"))
            ]
            if statuses[-1:] == ["passed"] and FAILED_ATTEMPT.intersection(statuses[:-1]):
                path = SEPARATOR.join([*titles, _text(spec.get("title"))])
                found.append(f"{_text(spec.get('file'))}{SEPARATOR}{path}")
    for child in _sequence(suite.get("suites")):
        child_map = _mapping(child)
        found += _playwright_suite(child_map, [*titles, _text(child_map.get("title"))])
    return found


def _playwright(text: str) -> list[str]:
    report = _mapping(json.loads(text))
    return [
        found
        for suite in _sequence(report.get("suites"))
        for found in _playwright_suite(_mapping(suite), [])
    ]


def _pytest_node_id(case: ET.Element) -> str:
    """`<file>::<Class>::<name>` of a junit testcase: xunit1 gives `file`, and `classname` is the
    dotted module followed by the classes."""
    name, classname, file = case.get("name", ""), case.get("classname", ""), case.get("file", "")
    if not file:
        return f"{classname}::{name}"
    module = file.removesuffix(".py").replace("/", ".")
    classes = classname.removeprefix(module).strip(".")
    return "::".join([file, *([classes.replace(".", "::")] if classes else []), name])


def _pytest(text: str) -> list[str]:
    attempts: dict[str, list[bool]] = {}
    for case in ET.fromstring(text).iter("testcase"):
        passed = all(case.find(tag) is None for tag in ("failure", "error", "skipped"))
        attempts.setdefault(_pytest_node_id(case), []).append(passed)
    return [node for node, passed in attempts.items() if len(passed) > 1 and passed[-1]]


def _relative(name: str) -> str:
    try:
        return str(Path(name).relative_to(Path.cwd()))
    except ValueError:
        return name


def _vitest(text: str) -> list[str]:
    found: list[str] = []
    for file_raw in _sequence(_mapping(json.loads(text)).get("testResults")):
        file = _mapping(file_raw)
        for test_raw in _sequence(file.get("assertionResults")):
            test = _mapping(test_raw)
            if test.get("status") == "passed" and _sequence(test.get("failureMessages")):
                titles = [
                    *map(_text, _sequence(test.get("ancestorTitles"))),
                    _text(test.get("title")),
                ]
                found.append(SEPARATOR.join([_relative(_text(file.get("name"))), *titles]))
    return found


READERS: Final[Mapping[str, Callable[[str], list[str]]]] = {
    "playwright": _playwright,
    "pytest": _pytest,
    "vitest": _vitest,
}


def _bounded(ids: Sequence[str]) -> list[str]:
    """`ids` without repeats, in order, each cut to what the system's reader accepts."""
    return list(dict.fromkeys(each[:ID_MAX_CHARS] for each in ids))


def flaky_ids(suite: str, raw_path: Path) -> list[str]:
    """The flaky test ids of one suite's raw result: none when it is missing or unreadable."""
    try:
        return _bounded(READERS[suite](raw_path.read_text(encoding="utf-8")))
    except (OSError, ValueError, ET.ParseError):
        return []


def _block(check: str, ids: Sequence[str]) -> str:
    return BLOCK_PREFIX + json.dumps(
        {"v": VERSION, "check": check, "tests": list(ids)},
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _normalised(path: Path) -> tuple[str, list[str]] | None:
    """`(check, ids)` of one file `extract` wrote, `None` for anything else."""
    try:
        data = _mapping(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return None
    check, ids = data.get("check"), data.get("tests")
    if not isinstance(check, str) or not isinstance(ids, list):
        return None
    return check, [each for each in ids if isinstance(each, str)]


def report_lines(directory: Path) -> list[str]:
    """One block line per check with a flaky test among the files below `directory`, by check."""
    merged: dict[str, list[str]] = {}
    for path in sorted(directory.rglob("*.json")):
        read = _normalised(path)
        if read is not None:
            merged.setdefault(read[0], []).extend(read[1])
    return [_block(check, _bounded(ids)) for check, ids in sorted(merged.items()) if ids]


def _extract(suite: str, raw_path: Path, out_path: Path) -> None:
    payload = {"v": VERSION, "check": CHECKS[suite], "tests": flaky_ids(suite, raw_path)}
    try:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    except OSError:
        return


def main(argv: Sequence[str]) -> int:
    """Always 0: the report never changes the result of the job it runs in."""
    match list(argv):
        case ["extract", suite, raw, out] if suite in CHECKS:
            _extract(suite, Path(raw), Path(out))
        case ["report", directory]:
            for line in report_lines(Path(directory)):
                print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
