"""The OpenAPI breaking-change verdict of the CI `docs` job, at its two seams: the pure
`verdict` table, and `read_base_spec` against a throwaway git repository in `tmp_path`."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from scripts.docs.api_breaks import (
    OASDIFF_BREAK,
    OASDIFF_NO_BREAK,
    BaseSpecMissing,
    Verdict,
    main,
    read_base_spec,
    verdict,
)

SPEC = '{"openapi": "3.1.0"}\n'
DECLARED = "Fixes things.\n\nBreaking-API: the analysis route moved to /results\n"


@pytest.mark.parametrize(
    ("base_spec", "oasdiff_exit", "pr_body", "expected"),
    [
        pytest.param(None, None, None, Verdict.SKIP, id="no base spec skips"),
        pytest.param(
            None, OASDIFF_BREAK, "", Verdict.SKIP, id="no base spec skips whatever the exit"
        ),
        pytest.param(SPEC, OASDIFF_NO_BREAK, None, Verdict.PASS, id="exit 0 passes"),
        pytest.param(
            SPEC, OASDIFF_NO_BREAK, DECLARED, Verdict.PASS, id="exit 0 passes with a declaration"
        ),
        pytest.param(SPEC, OASDIFF_BREAK, DECLARED, Verdict.DECLARED_BREAK, id="declared break"),
        pytest.param(
            SPEC, OASDIFF_BREAK, "no declaration here", Verdict.FAIL, id="undeclared break"
        ),
        pytest.param(SPEC, OASDIFF_BREAK, None, Verdict.FAIL, id="a None body is an empty body"),
        pytest.param(SPEC, OASDIFF_BREAK, "Breaking-API:", Verdict.FAIL, id="empty reason"),
        pytest.param(
            SPEC, OASDIFF_BREAK, "Breaking-API:\n", Verdict.FAIL, id="empty reason then newline"
        ),
        pytest.param(SPEC, OASDIFF_BREAK, "Breaking-API:   \t \n", Verdict.FAIL, id="blank reason"),
        pytest.param(
            SPEC,
            OASDIFF_BREAK,
            "Breaking-API:\nmoved the route",
            Verdict.FAIL,
            id="the reason is not on the next line",
        ),
        pytest.param(
            SPEC,
            OASDIFF_BREAK,
            "intro\r\nBreaking-API: moved the route\r\n",
            Verdict.DECLARED_BREAK,
            id="CRLF body",
        ),
        pytest.param(
            SPEC, OASDIFF_BREAK, "Breaking-API:no space\n", Verdict.DECLARED_BREAK, id="no space"
        ),
        pytest.param(
            SPEC,
            OASDIFF_BREAK,
            "see Breaking-API: moved the route",
            Verdict.FAIL,
            id="token in the middle of a line",
        ),
        pytest.param(
            SPEC,
            OASDIFF_BREAK,
            "breaking-api: moved the route",
            Verdict.FAIL,
            id="the token is case sensitive",
        ),
        pytest.param(SPEC, 2, DECLARED, Verdict.FAIL, id="a tool error is never a declared break"),
        pytest.param(SPEC, 102, DECLARED, Verdict.FAIL, id="oasdiff load error code"),
        pytest.param(SPEC, None, DECLARED, Verdict.FAIL, id="oasdiff did not run"),
        pytest.param(SPEC, None, None, Verdict.FAIL, id="oasdiff did not run, no body"),
    ],
)
def test_verdict(
    base_spec: str | None, oasdiff_exit: int | None, pr_body: str | None, expected: Verdict
) -> None:
    assert verdict(base_spec, oasdiff_exit, pr_body) is expected


def _git(repo: Path, *args: str) -> None:
    subprocess.run(
        [
            "git",
            "-c",
            "user.name=Test",
            "-c",
            "user.email=test@example.com",
            "-c",
            "commit.gpgsign=false",
            *args,
        ],
        cwd=repo,
        check=True,
        capture_output=True,
    )


def _repo_with_origin_x(tmp_path: Path, files: dict[str, str]) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "--quiet")
    for name, text in files.items():
        target = repo / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)
    _git(repo, "add", "--all")
    _git(repo, "commit", "--quiet", "--message", "base")
    _git(repo, "update-ref", "refs/remotes/origin/x", "HEAD")
    return repo


def test_read_base_spec_returns_the_text_of_the_base_ref(tmp_path: Path) -> None:
    repo = _repo_with_origin_x(tmp_path, {"docs/api/openapi.json": SPEC})
    assert read_base_spec("x", repo) == SPEC


def test_read_base_spec_is_absent_when_the_ref_has_no_spec(tmp_path: Path) -> None:
    repo = _repo_with_origin_x(tmp_path, {"README.md": "hello\n"})
    assert read_base_spec("x", repo) is BaseSpecMissing.ABSENT


def test_read_base_spec_reports_a_ref_that_does_not_exist(tmp_path: Path) -> None:
    repo = _repo_with_origin_x(tmp_path, {"docs/api/openapi.json": SPEC})
    assert read_base_spec("nope", repo) is BaseSpecMissing.REF_MISSING


def test_main_fails_without_runner_temp_rather_than_using_the_system_temp_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    repo = _repo_with_origin_x(tmp_path, {"docs/api/openapi.json": SPEC})
    monkeypatch.chdir(repo)
    monkeypatch.setenv("GITHUB_EVENT_NAME", "pull_request")
    monkeypatch.setenv("GITHUB_BASE_REF", "x")
    monkeypatch.delenv("RUNNER_TEMP", raising=False)
    assert main() == 1
    assert "api_breaks: FAIL, RUNNER_TEMP is not set" in capsys.readouterr().out
