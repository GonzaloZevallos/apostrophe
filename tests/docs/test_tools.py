"""The node tools of the docs generator: depcruise and redocly through the tool seam.

Everything here fakes `subprocess.run` or the tool runner; no test spawns node.
"""

from __future__ import annotations

import subprocess
import threading
import time
from pathlib import Path

import pytest

from scripts.docs.tools import (
    ToolCall,
    ToolError,
    argv_for,
    call_env,
    depcruise_call,
    node_tool_path,
    paracelsus_call,
    pyreverse_call,
    redocly_call,
    run_all,
    subprocess_runner,
)

ROOT = Path("/repo")


def test_node_tool_path_is_under_web_node_modules_bin() -> None:
    assert node_tool_path(ROOT, "depcruise") == str(ROOT / "web/node_modules/.bin/depcruise")


def test_depcruise_argv_cruises_with_an_anchored_include_only_from_web() -> None:
    call = depcruise_call("front/flash", ["src/flash"], "^src/flash/")
    assert call.cwd == "web"
    assert argv_for(call, "unused", ROOT) == [
        str(ROOT / "web/node_modules/.bin/depcruise"),
        "--config", ".dependency-cruiser.cjs",
        "--output-type", "mermaid",
        "--include-only", "^src/flash/",
        "src/flash",
    ]  # fmt: skip


def test_depcruise_argv_adds_collapse_for_the_overview() -> None:
    call = depcruise_call("front/overview", ["src"], "^src/", collapse="^src/[^/]+")
    argv = argv_for(call, "unused", ROOT)
    assert argv[argv.index("--collapse") + 1] == "^src/[^/]+"
    assert argv[-1] == "src"
    assert "--collapse" not in argv_for(depcruise_call("f", ["src"], "^src/"), "unused", ROOT)


@pytest.mark.parametrize(
    "include_only", ["", "src/", "^src", "^web/src/", "^", "src/flash/", "node_modules"]
)
def test_depcruise_call_refuses_an_include_only_not_anchored_at_src(include_only: str) -> None:
    with pytest.raises(ValueError, match=r"include-only must be anchored at \^src/"):
        depcruise_call("front/x", ["src"], include_only)


def test_redocly_argv_builds_docs_from_the_temp_dir_with_the_root_config() -> None:
    call = redocly_call("api/reference", '{"openapi": "3.1.0"}')
    assert call.cwd == "."
    assert call.inputs == (("openapi.json", '{"openapi": "3.1.0"}'),)
    assert call.product == "index.html"
    assert argv_for(call, "../x/docs-gen-1", ROOT) == [
        str(ROOT / "web/node_modules/.bin/redocly"),
        "build-docs", "../x/docs-gen-1/openapi.json",
        "-o", "../x/docs-gen-1/index.html",
        "--inlineBundle",
        "--config", "redocly.yaml",
    ]  # fmt: skip


def test_part_one_calls_keep_their_cwd_and_have_no_inputs() -> None:
    for call in (
        pyreverse_call("c/a", "a", ["app/a"], "classes"),
        paracelsus_call("er/x"),
    ):
        assert call.cwd == "."
        assert call.inputs == ()


@pytest.mark.parametrize("cwd", ["/etc", "../elsewhere", "web/../..", ""])
def test_a_call_cwd_must_be_repo_relative(cwd: str) -> None:
    with pytest.raises(ValueError, match="cwd must be repo-relative"):
        ToolCall("x", "depcruise", "^src/", ("src",), cwd=cwd)


@pytest.mark.parametrize("name", ["/abs/openapi.json", "../openapi.json", "a/../../b", ""])
def test_an_input_name_must_stay_inside_the_temp_dir(name: str) -> None:
    with pytest.raises(ValueError, match="input names must be relative"):
        ToolCall("x", "redocly", "", ("a",), inputs=((name, "{}"),))


def test_redocly_env_turns_telemetry_and_the_update_notice_off() -> None:
    env = call_env(redocly_call("api/reference", "{}"), {"HOME": "/h"})
    assert env["REDOCLY_TELEMETRY"] == "off"
    assert env["REDOCLY_SUPPRESS_UPDATE_NOTICE"] == "true"
    assert env["HOME"] == "/h"
    assert env["PYTHONHASHSEED"] == "0"


def test_other_tools_do_not_get_the_redocly_variables() -> None:
    env = call_env(depcruise_call("f", ["src"], "^src/"), {})
    assert "REDOCLY_TELEMETRY" not in env
    assert "REDOCLY_SUPPRESS_UPDATE_NOTICE" not in env


def test_runner_runs_depcruise_in_web_and_returns_its_stdout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, object] = {}

    def fake_run(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        seen.update(kwargs, argv=argv)
        return subprocess.CompletedProcess(argv, 0, "flowchart LR\n", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    run_tool = subprocess_runner(tmp_path)
    assert run_tool(depcruise_call("front/flash", ["src/flash"], "^src/flash/")) == "flowchart LR\n"
    assert seen["cwd"] == tmp_path / "web"
    assert seen.get("shell") is None
    argv = seen["argv"]
    assert isinstance(argv, list)
    assert argv[0] == str(tmp_path / "web/node_modules/.bin/depcruise")


def test_runner_writes_inputs_into_the_temp_dir_and_reads_the_product(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: dict[str, object] = {}

    def fake_run(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        seen.update(kwargs, argv=argv)
        source = tmp_path / argv[2]
        seen["input_text"] = source.read_text(encoding="utf-8")
        (tmp_path / argv[4]).write_text("<html></html>", encoding="utf-8")
        return subprocess.CompletedProcess(argv, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    html = subprocess_runner(tmp_path)(redocly_call("api/reference", '{"openapi": "3.1.0"}'))
    assert html == "<html></html>"
    assert seen["input_text"] == '{"openapi": "3.1.0"}'
    assert seen["cwd"] == tmp_path
    argv = seen["argv"]
    assert isinstance(argv, list)
    assert not Path(argv[2]).is_absolute()
    assert not (tmp_path / argv[2]).exists()
    env = seen["env"]
    assert isinstance(env, dict)
    assert env["REDOCLY_TELEMETRY"] == "off"


def test_runner_names_the_missing_product(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_run(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(argv, 0, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    with pytest.raises(ToolError, match="api/reference: redocly left no index.html"):
        subprocess_runner(tmp_path)(redocly_call("api/reference", "{}"))


def test_runner_turns_a_failing_depcruise_into_a_tool_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fake_run(argv: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(argv, 1, "", "ERROR: cannot resolve\nboom")

    monkeypatch.setattr(subprocess, "run", fake_run)
    with pytest.raises(ToolError, match="front/x: depcruise exited 1: boom"):
        subprocess_runner(tmp_path)(depcruise_call("front/x", ["src/x"], "^src/x/"))


def test_run_all_respects_max_workers() -> None:
    calls = [depcruise_call(f"f/{n}", [f"src/{n}"], f"^src/{n}/") for n in range(8)]
    lock = threading.Lock()
    live = 0
    peak = 0

    def run(call: ToolCall) -> str:
        nonlocal live, peak
        with lock:
            live += 1
            peak = max(peak, live)
        time.sleep(0.02)
        with lock:
            live -= 1
        return call.name

    assert list(run_all(calls, run, max_workers=2)) == sorted(c.name for c in calls)
    assert peak <= 2


def test_run_all_refuses_a_pool_without_workers() -> None:
    with pytest.raises(ValueError, match="max_workers must be at least 1"):
        run_all([depcruise_call("f/a", ["src/a"], "^src/a/")], lambda c: "", max_workers=0)
