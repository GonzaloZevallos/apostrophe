"""`scripts/ci_vitest.py`: the arguments of the vitest step, from the changed files and vitest's
own listing. Pure over lists; `main` is tested through a listing file and an environment."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.ci_vitest import main, vitest_args


def test_a_full_vitest_run_has_no_arguments() -> None:
    assert vitest_args(True, True, ["web/src/a.test.ts"], ["src/b.test.ts"]) == []


def test_files_alone_become_web_relative_arguments() -> None:
    args = vitest_args(False, False, ["web/src/b.test.ts", "web/src/a.test.ts"], [])

    assert args == ["src/a.test.ts", "src/b.test.ts"]


def test_the_web_relative_files_the_changes_job_emits_reach_the_args() -> None:
    args = vitest_args(False, True, ["src/guard.test.ts", "src/a.test.tsx"], ["src/b.test.ts"])

    assert args == ["src/a.test.tsx", "src/b.test.ts", "src/guard.test.ts"]


def test_an_absolute_listed_path_under_web_but_outside_src_is_normalised() -> None:
    listed = ["/w/web/scripts/i18n/x.test.ts", "/home/runner/work/web/web/web/src/a.test.ts"]

    assert vitest_args(False, True, [], listed) == ["scripts/i18n/x.test.ts", "src/a.test.ts"]


def test_a_path_that_cannot_be_placed_makes_it_a_full_run() -> None:
    assert vitest_args(False, True, ["src/a.test.ts"], ["../app/x.test.ts"]) == []
    assert vitest_args(False, True, ["src/../../x.test.ts"], []) == []


def test_listed_files_absolute_or_relative_are_made_web_relative() -> None:
    listed = ["/home/runner/work/x/x/web/src/a.test.ts", "src/b.test.ts", "web/src/c.test.ts"]

    assert vitest_args(False, True, [], listed) == [
        "src/a.test.ts",
        "src/b.test.ts",
        "src/c.test.ts",
    ]


def test_the_union_is_sorted_and_deduplicated() -> None:
    args = vitest_args(
        False,
        True,
        ["web/src/b.test.ts", "web/src/a.test.ts"],
        ["/w/web/src/a.test.ts", "src/c.test.ts", "src/b.test.ts"],
    )

    assert args == ["src/a.test.ts", "src/b.test.ts", "src/c.test.ts"]


def test_blank_lines_and_paths_outside_web_are_dropped() -> None:
    args = vitest_args(
        False, True, ["/w/app/x.py", ""], ["", "  ", "/w/docs/a.md", "src/a.test.ts"]
    )

    assert args == ["src/a.test.ts"]


def test_an_empty_union_is_a_full_run() -> None:
    assert vitest_args(False, True, [], []) == []
    assert vitest_args(False, True, ["/w/app/x.py"], ["", "\n"]) == []


@pytest.mark.parametrize("name", ["-x.test.ts", "a b.test.ts", "*.test.ts"])
def test_an_unsafe_path_makes_it_a_full_run(name: str) -> None:
    assert vitest_args(False, True, [f"web/{name}", "web/src/ok.test.ts"], []) == []
    assert vitest_args(False, True, [], [name, "src/ok.test.ts"]) == []


def listing(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "listed.txt"
    path.write_text(text, encoding="utf-8")
    return path


def test_main_prints_one_args_line_for_the_output_file(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = listing(tmp_path, "/w/web/src/a.test.ts\n\nsrc/b.test.ts\n")
    env = {
        "VITEST_ALL": "false",
        "VITEST_CHANGED": "true",
        "VITEST_FILES": json.dumps(["web/src/c.test.ts"]),
    }

    assert main([str(path)], env) == 0

    assert capsys.readouterr().out == "args=src/a.test.ts src/b.test.ts src/c.test.ts\n"


def test_main_prints_empty_args_for_a_full_run(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = listing(tmp_path, "src/a.test.ts\n")
    env = {"VITEST_ALL": "true", "VITEST_CHANGED": "true", "VITEST_FILES": "[]"}

    assert main([str(path)], env) == 0

    assert capsys.readouterr().out == "args=\n"


def test_main_counts_a_missing_listing_as_empty(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    env = {"VITEST_ALL": "false", "VITEST_CHANGED": "true", "VITEST_FILES": '["web/src/a.test.ts"]'}

    assert main([str(tmp_path / "absent.txt")], env) == 0

    assert capsys.readouterr().out == "args=src/a.test.ts\n"


def test_main_fails_closed_on_a_missing_flag_or_malformed_files(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = listing(tmp_path, "src/a.test.ts\n")
    narrow = {"VITEST_ALL": "false", "VITEST_CHANGED": "true"}

    assert main([str(path)], {**narrow, "VITEST_FILES": "not json"}) == 0
    assert capsys.readouterr().out == "args=\n"
    assert main([str(path)], {**narrow, "VITEST_FILES": '{"a": 1}'}) == 0
    assert capsys.readouterr().out == "args=\n"
    assert main([str(path)], {**narrow, "VITEST_FILES": "[1]"}) == 0
    assert capsys.readouterr().out == "args=\n"
    assert main([str(path)], {"VITEST_FILES": "[]"}) == 0
    assert capsys.readouterr().out == "args=\n"
    assert main([str(path)], {**narrow}) == 0
    assert capsys.readouterr().out == "args=src/a.test.ts\n"


def test_main_prints_nothing_of_the_listing_beyond_the_paths(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = listing(tmp_path, "RUN v3.0.0 /secret/dir\nsrc/a.test.ts\n")
    env = {"VITEST_ALL": "false", "VITEST_CHANGED": "true", "VITEST_FILES": "[]"}

    assert main([str(path)], env) == 0

    out = capsys.readouterr().out
    assert "secret" not in out and "RUN" not in out
