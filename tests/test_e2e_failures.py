"""`scripts/e2e_failures.py` (ADR-0040, GH-251): the names of the failing e2e tests, read
from the junit file Playwright wrote, printed as the last lines of a red `web-e2e` run.
Every junit file is written here, in the shape Playwright's own reporter produces."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.e2e_failures import MISSING_LINE, failures, main

JUNIT = """<testsuites id="" name="" tests="5" failures="1" skipped="1" errors="1">
<testsuite name="a.spec.ts" tests="3" failures="1" skipped="1" errors="0">
<testcase name="group › passes" classname="a.spec.ts" time="0.005">
</testcase>
<testcase name="group › fails" classname="a.spec.ts" time="0.008">
<failure message="expect(received).toBe(expected) // Object.is equality">
<![CDATA[ Expected: 2 Received: 1 customer Ana 11.000 ]]>
</failure>
</testcase>
<testcase name="group › skipped" classname="a.spec.ts">
<skipped>
</skipped>
</testcase>
</testsuite>
<testsuite name="b.spec.ts" tests="2" failures="0" skipped="0" errors="1">
<testcase name="top fail" classname="b.spec.ts" time="0.004">
<error message="boom" type="Error">
<![CDATA[ Error: boom ]]>
</error>
</testcase>
<testcase name="fine" classname="b.spec.ts" time="0.004">
</testcase>
</testsuite>
</testsuites>
"""


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "junit.xml"
    path.write_text(text)
    return path


def test_failed_and_errored_cases_are_named_in_file_order(tmp_path: Path) -> None:
    assert failures(write(tmp_path, JUNIT)) == [
        "a.spec.ts › group › fails",
        "b.spec.ts › top fail",
    ]


def test_passed_and_skipped_cases_are_not_named(tmp_path: Path) -> None:
    only_green = """<testsuites><testsuite name="a.spec.ts">
<testcase name="ok" classname="a.spec.ts"></testcase>
<testcase name="later" classname="a.spec.ts"><skipped></skipped></testcase>
</testsuite></testsuites>"""
    assert failures(write(tmp_path, only_green)) == []


def test_main_prints_only_names_never_messages(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([str(write(tmp_path, JUNIT))]) == 0
    printed = capsys.readouterr().out
    assert printed == "a.spec.ts › group › fails\nb.spec.ts › top fail\n"
    assert "Ana" not in printed
    assert "boom" not in printed


def test_a_missing_junit_prints_one_fixed_line_and_exits_zero(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([str(tmp_path / "absent.xml")]) == 0
    assert capsys.readouterr().out == MISSING_LINE + "\n"


def test_an_unreadable_junit_prints_the_same_fixed_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([str(write(tmp_path, "<testsuites><oops"))]) == 0
    assert capsys.readouterr().out == MISSING_LINE + "\n"


def test_no_argument_prints_the_fixed_line_and_exits_zero(
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert main([]) == 0
    assert capsys.readouterr().out == MISSING_LINE + "\n"
