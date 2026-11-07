"""No two checks that run at the same moment write one path (GH-543).

`.agentic/stack.yaml` declares `parallel_checks: true`, so the gate starts every `checks` command
at once. `web-build` (`tsc -b && vite build`) and `web-e2e` (`vite build`, then Playwright against
servers that serve `web/dist`) both emptied and rewrote `web/dist`, and `web-types` and `web-build`
both wrote the `tsc -b` buildinfo: a rebuild in the middle of the e2e run fails an unrelated spec,
and the rerun passes. That was GH-483's `web-e2e` flake.

`WRITES` says, for each check, which shared paths its command writes and reads. It is a constant
in this file, and it is checked against the source: a command whose resolved text holds `vite
build` must declare `web/dist`, one that holds `tsc -b` must declare the buildinfo, and so on for
the markers in `MARKERS`. A check with no entry is refused, and an entry that writes nothing
shared must say why. `parallel_writer_problems` is a pure function, so each rule is tested on
in-memory data; the real files are checked as they are."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]

Data = dict[str, Any]

DIST = "web/dist"
BUILDINFO = "web/node_modules/.tmp"
VITE_CACHE = "web/node_modules/.vite"
E2E_RESULTS = "web/test-results"
PYTEST_CACHE = ".pytest_cache"
RUFF_CACHE = ".ruff_cache"
MYPY_CACHE = ".mypy_cache"
VENV = ".venv"


@dataclass(frozen=True)
class Entry:
    """What one check's command writes and reads among the paths the checks share."""

    writes: frozenset[str]
    reads: frozenset[str]
    source: str
    reason: str = ""  # required when `writes` is empty: why the command writes nothing shared


# One entry per key of `checks`. `source` is where the command is defined; the paths come from
# reading that source, and `MARKERS` checks the ones a text can show.
WRITES: dict[str, Entry] = {
    # stack.yaml `checks.tests`: pytest with the cache provider on (no `-p no:cacheprovider`).
    "tests": Entry(
        frozenset({PYTEST_CACHE}), frozenset({VENV, "uv.lock"}), "stack.yaml checks.tests"
    ),
    # stack.yaml `checks.tests-fast`: `-p no:cacheprovider` keeps `.pytest_cache` to `tests`.
    "tests-fast": Entry(
        frozenset(),
        frozenset({VENV, "uv.lock"}),
        "stack.yaml checks.tests-fast",
        reason="`-p no:cacheprovider` leaves .pytest_cache to `tests`; the tests use tmp_path",
    ),
    # stack.yaml `checks.lint`: ruff writes its cache.
    "lint": Entry(frozenset({RUFF_CACHE}), frozenset({VENV}), "stack.yaml checks.lint"),
    # stack.yaml `checks.types`: mypy writes its cache.
    "types": Entry(frozenset({MYPY_CACHE}), frozenset({VENV}), "stack.yaml checks.types"),
    # web/package.json:9 `typecheck` is `tsc -b`: its buildinfo goes to web/node_modules/.tmp
    # (web/tsconfig.app.json:3, tsconfig.node.json:3, tsconfig.scripts.json:3).
    "web-types": Entry(frozenset({BUILDINFO}), frozenset(), "web/package.json:9"),
    # web/package.json:10 `lint` is oxlint, which writes nothing.
    "web-lint": Entry(
        frozenset(),
        frozenset(),
        "web/package.json:10",
        reason="oxlint reads the sources and prints; it keeps no cache",
    ),
    # web/package.json:11 `test` is `vitest run`, which keeps its cache in node_modules/.vite.
    "web-tests": Entry(frozenset({VITE_CACHE}), frozenset(), "web/package.json:11"),
    # `web-build` (web/package.json:8, `tsc -b && vite build`) has no entry on purpose: it wrote
    # web/dist beside `web-e2e` and the buildinfo beside `web-types` (GH-543). A check added back
    # needs an entry, and the writer rules below refuse it while it shares a path.
    # web/package.json:14 `e2e` is `sh scripts/e2e.sh`; web/scripts/e2e.sh:23 runs `npx vite
    # build` (web/dist), and Playwright then serves web/dist from uvicorn (app/main.py:336-347)
    # and writes its run directory (web/scripts/e2e.sh:19).
    "web-e2e": Entry(
        frozenset({DIST, E2E_RESULTS}), frozenset({DIST, VENV}), "web/package.json:14"
    ),
}

# What a resolved command's text shows it writes: (pattern, path, what it is).
MARKERS: tuple[tuple[str, str, str], ...] = (
    (r"\bvite build\b", DIST, "`vite build`"),
    (r"\btsc -b\b", BUILDINFO, "`tsc -b`"),
    (r"\bvitest\b", VITE_CACHE, "`vitest`"),
    (r"\bruff\b", RUFF_CACHE, "`ruff`"),
    (r"\bmypy\b", MYPY_CACHE, "`mypy`"),
)
PYTEST_MARKER = r"\bpytest\b"
NO_CACHE_FLAG = "-p no:cacheprovider"

NPM_RUN = re.compile(r"^npm --prefix web run (?P<script>[\w:-]+)\s*$")
SH_SCRIPT = re.compile(r"\bsh (?P<path>scripts/[\w./-]+\.sh)\b")


def _overlap(a: str, b: str) -> bool:
    return a == b or a.startswith(b + "/") or b.startswith(a + "/")


def resolved_text(command: str, scripts: dict[str, str], web_files: dict[str, str]) -> str:
    """The text a check runs: an `npm --prefix web run X` becomes the script X of
    web/package.json, and a `sh scripts/Y.sh` in it becomes the text of web/scripts/Y.sh."""
    found = NPM_RUN.match(command)
    text = scripts.get(found["script"], command) if found else command
    script = SH_SCRIPT.search(text)
    if script is not None:
        text = f"{text}\n{web_files.get(script['path'], '')}"
    return text


def inferred_writes(text: str) -> set[tuple[str, str]]:
    """(path, what shows it) for each marker of `MARKERS` that `text` holds."""
    found = {(path, what) for pattern, path, what in MARKERS if re.search(pattern, text)}
    if re.search(PYTEST_MARKER, text) and NO_CACHE_FLAG not in text:
        found.add((PYTEST_CACHE, "`pytest` without `-p no:cacheprovider`"))
    return found


def parallel_writer_problems(
    stack: Data,
    writes: dict[str, Entry],
    scripts: dict[str, str],
    web_files: dict[str, str],
) -> list[str]:
    """Every way the checks that run at once share a path. Empty when `parallel_checks` is off."""
    if not stack.get("parallel_checks"):
        return []
    checks = cast("dict[str, str]", stack["checks"])
    problems: list[str] = []
    if not checks:
        return ["the table scanned zero checks: stack.yaml `checks` is empty"]
    for name, command in checks.items():
        entry = writes.get(name)
        if entry is None:
            problems.append(
                f"check {name!r} has no entry in WRITES: say which shared paths it writes and reads"
            )
            continue
        if not entry.writes and not entry.reason.strip():
            problems.append(f"check {name!r} writes nothing shared and gives no reason")
        text = resolved_text(command, scripts, web_files)
        for path, what in sorted(inferred_writes(text)):
            if not any(_overlap(path, declared) for declared in entry.writes):
                problems.append(f"check {name!r} runs {what} but its entry does not declare {path}")
    for name in writes:
        if name not in checks:
            problems.append(f"WRITES has an entry for {name!r}, which is not a check of stack.yaml")
    ordered = [name for name in checks if name in writes]
    for index, first in enumerate(ordered):
        for second in ordered[index + 1 :]:
            for a in sorted(writes[first].writes):
                for b in sorted(writes[second].writes):
                    if _overlap(a, b):
                        problems.append(
                            f"checks {first!r} and {second!r} both write {a}"
                            " and run at the same moment"
                        )
        for writer, reader in ((first, second) for second in ordered if second != first):
            for a in sorted(writes[writer].writes):
                for b in sorted(writes[reader].reads):
                    if _overlap(a, b) and a not in writes[reader].writes:
                        problems.append(
                            f"check {writer!r} writes {a} while check {reader!r} reads {b}"
                            " at the same moment"
                        )
    return problems


def _real_problems() -> list[str]:
    stack = cast("Data", yaml.safe_load((REPO_ROOT / ".agentic/stack.yaml").read_text("utf-8")))
    package = cast("Data", json.loads((REPO_ROOT / "web/package.json").read_text("utf-8")))
    e2e = "scripts/e2e.sh"
    web_files = {e2e: (REPO_ROOT / "web" / e2e).read_text("utf-8")}
    return parallel_writer_problems(
        stack, WRITES, cast("dict[str, str]", package["scripts"]), web_files
    )


def _stack(**checks: str) -> Data:
    return {"parallel_checks": True, "checks": checks}


SCRIPTS = {
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b",
    "e2e": "sh scripts/e2e.sh",
}
WEB_FILES = {"scripts/e2e.sh": "npx vite build || exit 1\nnpx playwright test\n"}
BUILD = "npm --prefix web run build"
E2E = "npm --prefix web run e2e"
TYPES = "npm --prefix web run typecheck"
QUIET = Entry(frozenset(), frozenset(), "a test entry", reason="a test command that writes nothing")


def test_the_real_checks_have_no_shared_writer() -> None:
    assert _real_problems() == []


def test_the_real_table_scans_the_checks_of_the_stack() -> None:
    stack = cast("Data", yaml.safe_load((REPO_ROOT / ".agentic/stack.yaml").read_text("utf-8")))
    assert stack["parallel_checks"] is True
    assert set(stack["checks"]) == set(WRITES)


def test_two_checks_that_write_web_dist_are_refused() -> None:
    writes = {
        "web-build": Entry(frozenset({DIST}), frozenset(), "x"),
        "web-e2e": Entry(frozenset({DIST}), frozenset({DIST}), "x"),
    }
    problems = parallel_writer_problems(
        _stack(**{"web-build": BUILD, "web-e2e": E2E}), writes, SCRIPTS, WEB_FILES
    )
    assert (
        "checks 'web-build' and 'web-e2e' both write web/dist and run at the same moment"
        in problems
    )


def test_a_path_under_another_checks_write_is_the_same_path() -> None:
    writes = {
        "a": Entry(frozenset({DIST}), frozenset(), "x"),
        "b": Entry(frozenset({DIST + "/assets"}), frozenset(), "x"),
    }
    problems = parallel_writer_problems(_stack(a="echo a", b="echo b"), writes, {}, {})
    assert problems == ["checks 'a' and 'b' both write web/dist and run at the same moment"]


def test_a_check_that_reads_a_path_another_writes_is_refused() -> None:
    writes = {
        "builder": Entry(frozenset({DIST}), frozenset(), "x"),
        "server": Entry(frozenset({"web/test-results"}), frozenset({DIST}), "x"),
    }
    problems = parallel_writer_problems(_stack(builder="echo b", server="echo s"), writes, {}, {})
    assert problems == [
        "check 'builder' writes web/dist while check 'server' reads web/dist at the same moment"
    ]


def test_a_check_with_no_entry_is_refused() -> None:
    problems = parallel_writer_problems(
        _stack(**{"web-new": "echo hi"}), {"web-types": QUIET}, {}, {}
    )
    assert (
        "check 'web-new' has no entry in WRITES: say which shared paths it writes and reads"
        in problems
    )


def test_an_entry_for_a_removed_check_is_refused() -> None:
    problems = parallel_writer_problems(_stack(a="echo a"), {"a": QUIET, "gone": QUIET}, {}, {})
    assert problems == ["WRITES has an entry for 'gone', which is not a check of stack.yaml"]


def test_a_vite_build_without_web_dist_is_refused() -> None:
    entry = Entry(frozenset({BUILDINFO}), frozenset(), "x")
    problems = parallel_writer_problems(
        _stack(**{"web-build": BUILD}), {"web-build": entry}, SCRIPTS, WEB_FILES
    )
    assert problems == [
        "check 'web-build' runs `vite build` but its entry does not declare web/dist"
    ]


def test_a_vite_build_inside_e2e_sh_must_declare_web_dist() -> None:
    entry = Entry(frozenset({E2E_RESULTS}), frozenset({DIST}), "x")
    problems = parallel_writer_problems(
        _stack(**{"web-e2e": E2E}), {"web-e2e": entry}, SCRIPTS, WEB_FILES
    )
    assert problems == ["check 'web-e2e' runs `vite build` but its entry does not declare web/dist"]


def test_a_tsc_build_without_the_buildinfo_is_refused() -> None:
    problems = parallel_writer_problems(
        _stack(**{"web-types": TYPES}), {"web-types": QUIET}, SCRIPTS, WEB_FILES
    )
    assert problems == [
        "check 'web-types' runs `tsc -b` but its entry does not declare web/node_modules/.tmp"
    ]


def test_pytest_without_the_no_cache_flag_must_declare_its_cache() -> None:
    problems = parallel_writer_problems(_stack(tests="pytest -n 4"), {"tests": QUIET}, {}, {})
    assert problems == [
        "check 'tests' runs `pytest` without `-p no:cacheprovider` "
        "but its entry does not declare .pytest_cache"
    ]


def test_an_entry_that_writes_nothing_needs_a_reason() -> None:
    silent = Entry(frozenset(), frozenset(), "x")
    problems = parallel_writer_problems(_stack(a="echo a"), {"a": silent}, {}, {})
    assert problems == ["check 'a' writes nothing shared and gives no reason"]


def test_a_table_that_scans_zero_checks_is_refused() -> None:
    problems = parallel_writer_problems(_stack(), WRITES, SCRIPTS, WEB_FILES)
    assert problems == ["the table scanned zero checks: stack.yaml `checks` is empty"]


def test_nothing_is_checked_when_the_checks_do_not_run_at_once() -> None:
    stack: Data = {"parallel_checks": False, "checks": {"web-build": BUILD, "web-e2e": E2E}}
    assert parallel_writer_problems(stack, WRITES, SCRIPTS, WEB_FILES) == []


def test_a_check_that_writes_only_what_it_declares_passes() -> None:
    stack = _stack(**{"web-types": TYPES, "web-e2e": E2E})
    writes = {k: WRITES[k] for k in ("web-types", "web-e2e")}
    assert parallel_writer_problems(stack, writes, SCRIPTS, WEB_FILES) == []
