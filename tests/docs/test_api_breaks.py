"""The OpenAPI breaking-change check of the CI `docs` job, at its seams: the pure `verdict` table,
`base_env`, `generate_base_spec` and `main` driven through an injected `run` over a throwaway git
repository in `tmp_path`, and `BASE_EXPORT` run for real."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

import pytest

from scripts.docs.api_breaks import (
    BASE_EXPORT,
    EXPORT_TIMEOUT,
    GIT_TIMEOUT,
    OASDIFF_BREAK,
    OASDIFF_NO_BREAK,
    OASDIFF_TIMEOUT,
    SPEC_PATH,
    SYNC_TIMEOUT,
    TIMED_OUT,
    BaseExportFailed,
    BaseSpecMissing,
    Verdict,
    base_env,
    base_export_argv,
    generate_base_spec,
    main,
    verdict,
)
from scripts.docs.openapi_export import build_docs_app, export_openapi

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


def _spec(*operations: str) -> str:
    return json.dumps({"openapi": "3.1.0", "paths": {name: {"get": {}} for name in operations}})


BASE_LOCK = "# the base's lockfile\n"
HEAD_LOCK = "# the head's lockfile\n"
GENERATED_BASE = _spec("/analysis", "/results")  # what the base code exports
WORKSPACE_HEAD = _spec("/analysis")  # what `generate` wrote at the head: /results is removed
COMMITTED_BASE = _spec("/analysis")  # stale committed copies that must never be read
COMMITTED_HEAD = _spec("/analysis", "/results")


class FakeRun:
    """The injected `Run`: real git over the repository, fake uv, worktree python and oasdiff."""

    def __init__(self) -> None:
        self.sync_code = 0
        self.export_code = 0
        self.export_text = GENERATED_BASE
        self.worktree_code = 0
        self.oasdiff_missing = False
        self.calls: list[tuple[list[str], Path, dict[str, str], float]] = []
        self.sync_lock_text = ""

    def __call__(
        self, argv: Sequence[str], cwd: Path, env: Mapping[str, str], timeout: float
    ) -> int:
        self.calls.append((list(argv), cwd, dict(env), timeout))
        tool = argv[0]
        if tool == "git":
            if argv[1:3] == ["worktree", "add"] and self.worktree_code:
                return self.worktree_code
            return subprocess.run(
                argv, cwd=cwd, env=env, capture_output=True, check=False
            ).returncode
        if tool == "uv":
            self.sync_lock_text = (cwd / "uv.lock").read_text()
            return self.sync_code
        if tool.endswith("/.venv/bin/python"):
            assert argv[1:3] == ["-c", BASE_EXPORT]
            if not self.export_code:
                Path(argv[3]).write_text(self.export_text, encoding="utf-8")
            return self.export_code
        assert tool == "oasdiff", tool
        if self.oasdiff_missing:
            raise FileNotFoundError(tool)
        before = set(json.loads(Path(argv[2]).read_text())["paths"])
        after = set(json.loads((cwd / argv[3]).read_text())["paths"])
        return OASDIFF_BREAK if before - after else OASDIFF_NO_BREAK

    def called(self, tool: str) -> list[tuple[list[str], Path, dict[str, str], float]]:
        return [call for call in self.calls if call[0][0].endswith(tool)]


class Scene:
    def __init__(self, repo: Path, runner_temp: Path) -> None:
        self.repo = repo
        self.runner_temp = runner_temp
        self.run = FakeRun()


@pytest.fixture
def scene(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Scene:
    """A repository whose `origin/x` and HEAD each commit a different (stale) spec and lockfile,
    with the freshly generated head spec in the workspace, as the `docs` job leaves it."""
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "--quiet")
    (repo / "docs" / "api").mkdir(parents=True)
    (repo / "scripts" / "docs").mkdir(parents=True)
    (repo / "scripts" / "docs" / "openapi_export.py").write_text("# export\n")
    (repo / "uv.lock").write_text(BASE_LOCK)
    (repo / SPEC_PATH).write_text(COMMITTED_BASE)
    _git(repo, "add", "--all")
    _git(repo, "commit", "--quiet", "--message", "base")
    _git(repo, "update-ref", "refs/remotes/origin/x", "HEAD")
    (repo / "uv.lock").write_text(HEAD_LOCK)
    (repo / SPEC_PATH).write_text(COMMITTED_HEAD)
    _git(repo, "commit", "--quiet", "--all", "--message", "head")
    (repo / SPEC_PATH).write_text(WORKSPACE_HEAD)
    runner_temp = tmp_path / "runner"
    runner_temp.mkdir()
    monkeypatch.chdir(repo)
    monkeypatch.setenv("GITHUB_EVENT_NAME", "pull_request")
    monkeypatch.setenv("GITHUB_BASE_REF", "x")
    monkeypatch.setenv("RUNNER_TEMP", str(runner_temp))
    monkeypatch.setenv("VIRTUAL_ENV", str(repo / ".venv"))
    monkeypatch.setenv("PYTHONPATH", str(repo))
    monkeypatch.setenv("UV_PROJECT_ENVIRONMENT", str(repo / ".venv"))
    monkeypatch.delenv("PR_BODY", raising=False)
    return Scene(repo, runner_temp)


def _worktrees(repo: Path) -> list[str]:
    listed = subprocess.run(
        ["git", "worktree", "list", "--porcelain"],
        cwd=repo,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return [line for line in listed.splitlines() if line.startswith("worktree ")]


def _leftovers(runner_temp: Path) -> list[Path]:
    return list(runner_temp.glob("api-breaks-base-*"))


def test_base_env_drops_the_body_and_the_heads_venv_and_points_uv_at_the_worktree() -> None:
    parent = {
        "PATH": "/bin",
        "UV_CACHE_DIR": "/cache",
        "PR_BODY": "Breaking-API: secret",
        "VIRTUAL_ENV": "/head/.venv",
        "PYTHONPATH": "/head",
        "UV_PROJECT_ENVIRONMENT": "/head/.venv",
    }
    env = base_env(parent, Path("/wt"))
    assert env == {"PATH": "/bin", "UV_CACHE_DIR": "/cache", "UV_PROJECT_ENVIRONMENT": "/wt/.venv"}
    assert "PR_BODY" in parent


def test_base_export_command_writes_the_apps_document(tmp_path: Path) -> None:
    out = tmp_path / "openapi.json"
    repo_root = Path(__file__).resolve().parents[2]
    argv = base_export_argv(Path(sys.executable), out)
    done = subprocess.run(
        argv, cwd=repo_root, env=dict(os.environ), capture_output=True, check=False
    )
    assert done.returncode == 0, done.stderr.decode()
    text = out.read_text(encoding="utf-8")
    assert text
    assert "openapi" in json.loads(text)
    assert text == export_openapi(build_docs_app())


def test_the_base_is_synced_in_its_own_worktree_with_its_own_lockfile(
    scene: Scene, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("PR_BODY", "Breaking-API: the results route is gone")
    assert main(scene.run) == 0
    (sync,) = scene.run.called("uv")
    argv, cwd, env, timeout = sync
    assert argv == ["uv", "sync", "--locked"]
    assert cwd.name == "base"
    assert cwd != scene.repo
    assert cwd.parent.parent == scene.runner_temp
    assert scene.run.sync_lock_text == BASE_LOCK
    assert (scene.repo / "uv.lock").read_text() == HEAD_LOCK
    assert env["UV_PROJECT_ENVIRONMENT"] == str(cwd / ".venv")
    assert "PR_BODY" not in env
    assert "VIRTUAL_ENV" not in env
    assert "PYTHONPATH" not in env
    assert timeout == SYNC_TIMEOUT
    (export,) = scene.run.called("python")
    assert export[1] == cwd
    assert export[0][0] == str(cwd / ".venv" / "bin" / "python")
    assert export[3] == EXPORT_TIMEOUT
    assert "the results route is gone" not in capsys.readouterr().out


def test_no_child_ever_sees_the_body_and_every_call_has_a_timeout(
    scene: Scene, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("PR_BODY", "Breaking-API: moved")
    assert main(scene.run) == 0
    assert scene.run.calls
    for argv, _, env, timeout in scene.run.calls:
        assert "PR_BODY" not in env, argv
        assert all("moved" not in part for part in argv)
        assert 0 < timeout <= SYNC_TIMEOUT
    assert scene.run.called("oasdiff")[0][3] == OASDIFF_TIMEOUT
    assert {call[3] for call in scene.run.called("git")} == {GIT_TIMEOUT}


def test_a_removed_operation_fails_without_a_declaration_and_is_declared_with_one(
    scene: Scene, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(scene.run) == 1
    assert "api_breaks: FAIL (oasdiff exit 1)" in capsys.readouterr().out
    monkeypatch.setenv("PR_BODY", "Fixes.\n\nBreaking-API: dropped /results\n")
    assert main(scene.run) == 0
    out = capsys.readouterr().out
    assert "api_breaks: DECLARED_BREAK (oasdiff exit 1)" in out
    assert "dropped /results" not in out


def test_the_head_spec_is_the_workspace_file_and_the_base_is_the_generated_one(
    scene: Scene,
) -> None:
    """The stale committed copies would give PASS on either side; only the generated base and
    the workspace head show the removed operation."""
    assert main(scene.run) == 1
    (oasdiff,) = scene.run.called("oasdiff")
    assert oasdiff[0][-3] == SPEC_PATH
    assert oasdiff[1] == scene.repo


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        pytest.param("sync_code", 2, "base sync exited 2", id="sync fails"),
        pytest.param("sync_code", TIMED_OUT, "base sync timed out", id="sync times out"),
        pytest.param("export_code", 3, "base export exited 3", id="export fails"),
        pytest.param("export_code", TIMED_OUT, "base export timed out", id="export times out"),
        pytest.param("export_text", "", "base export exited 0", id="export writes nothing"),
        pytest.param("worktree_code", 128, "base worktree exited 128", id="worktree add fails"),
    ],
)
def test_a_failed_step_of_the_base_fails_the_job_names_the_step_and_cleans_up(
    scene: Scene, capsys: pytest.CaptureFixture[str], field: str, value: object, message: str
) -> None:
    setattr(scene.run, field, value)
    assert main(scene.run) == 1
    assert f"api_breaks: FAIL, {message}" in capsys.readouterr().out
    assert not scene.run.called("oasdiff")
    assert len(_worktrees(scene.repo)) == 1
    assert _leftovers(scene.runner_temp) == []


def test_a_successful_run_also_removes_its_worktree_and_temp_dir(scene: Scene) -> None:
    assert main(scene.run) == 1
    assert len(_worktrees(scene.repo)) == 1
    assert _leftovers(scene.runner_temp) == []


def test_a_stale_worktree_registration_does_not_stop_the_comparison(
    scene: Scene, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    gone = tmp_path / "gone"
    _git(scene.repo, "worktree", "add", "--detach", str(gone), "origin/x")
    shutil.rmtree(gone)
    assert len(_worktrees(scene.repo)) == 2
    assert main(scene.run) == 1
    assert "api_breaks: FAIL (oasdiff exit 1)" in capsys.readouterr().out
    assert scene.run.called("uv")


def test_a_base_without_the_export_module_is_a_logged_skip(
    scene: Scene, capsys: pytest.CaptureFixture[str]
) -> None:
    _git(scene.repo, "rm", "--quiet", "--cached", "scripts/docs/openapi_export.py")
    _git(scene.repo, "commit", "--quiet", "--message", "no export")
    _git(scene.repo, "update-ref", "refs/remotes/origin/x", "HEAD")
    assert main(scene.run) == 0
    assert "api_breaks: SKIP, the base ref has no scripts/docs/openapi_export.py" in (
        capsys.readouterr().out
    )
    assert not scene.run.called("uv")
    assert _leftovers(scene.runner_temp) == []


def test_a_missing_base_ref_fails(
    scene: Scene, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("GITHUB_BASE_REF", "nope")
    assert main(scene.run) == 1
    assert "api_breaks: FAIL, the base ref origin/<GITHUB_BASE_REF> is not in the checkout" in (
        capsys.readouterr().out
    )
    assert _leftovers(scene.runner_temp) == []


@pytest.mark.parametrize("content", [None, ""], ids=["missing", "empty"])
def test_a_workspace_without_the_generated_spec_fails_and_never_regenerates_it(
    scene: Scene, capsys: pytest.CaptureFixture[str], content: str | None
) -> None:
    if content is None:
        (scene.repo / SPEC_PATH).unlink()
    else:
        (scene.repo / SPEC_PATH).write_text(content)
    assert main(scene.run) == 1
    assert (
        "api_breaks: FAIL, docs/api/openapi.json is not in the workspace; "
        "scripts.docs.generate must run first"
    ) in capsys.readouterr().out
    assert scene.run.calls == []


def test_a_missing_oasdiff_binary_fails(scene: Scene, capsys: pytest.CaptureFixture[str]) -> None:
    scene.run.oasdiff_missing = True
    assert main(scene.run) == 1
    assert "api_breaks: FAIL (oasdiff exit None)" in capsys.readouterr().out


def test_a_non_pull_request_event_is_a_skip_that_runs_nothing(
    scene: Scene, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("GITHUB_EVENT_NAME", "push")
    assert main(scene.run) == 0
    assert "api_breaks: SKIP, not a pull_request event" in capsys.readouterr().out
    assert scene.run.calls == []


def test_main_fails_without_runner_temp_rather_than_using_the_system_temp_dir(
    scene: Scene, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("RUNNER_TEMP")
    assert main(scene.run) == 1
    assert "api_breaks: FAIL, RUNNER_TEMP is not set" in capsys.readouterr().out
    assert scene.run.calls == []


def test_generate_base_spec_returns_the_exported_text_or_raises_with_the_step(
    scene: Scene,
) -> None:
    assert generate_base_spec("x", scene.repo, scene.runner_temp, scene.run) == GENERATED_BASE
    assert (
        generate_base_spec("nope", scene.repo, scene.runner_temp, scene.run)
        is BaseSpecMissing.REF_MISSING
    )
    scene.run.sync_code = TIMED_OUT
    with pytest.raises(BaseExportFailed) as raised:
        generate_base_spec("x", scene.repo, scene.runner_temp, scene.run)
    assert (raised.value.step, raised.value.code) == ("sync", TIMED_OUT)
