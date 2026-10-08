"""`scripts/affected.py` (ADR-0037): the wrapper behind the affected forms of `web-tests`
and `web-e2e`. Every call goes through an injected command runner, so no test runs git
or npm; the discovery tests read fixture trees under `tmp_path` and the real `web/src`.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import pytest

from scripts.affected import (
    REPO_ROOT,
    CommandResult,
    changed_paths,
    discover_guards,
    is_e2e_sound,
    main,
)

BASE = "abc1234"


class FakeRunner:
    """Answers git by its subcommand and npm by a queue of exit codes, and records every
    command it was given."""

    def __init__(
        self,
        *,
        diff: Sequence[str] = (),
        untracked: Sequence[str] = (),
        git_code: int = 0,
        npm_codes: Sequence[int] = (0, 0),
        selected: Sequence[str] = ("src/a.test.ts",),
        list_code: int = 0,
    ) -> None:
        self.diff = list(diff)
        self.untracked = list(untracked)
        self.git_code = git_code
        self.npm_codes = list(npm_codes)
        self.selected = list(selected)
        self.list_code = list_code
        self.commands: list[list[str]] = []

    def __call__(self, command: Sequence[str], *, capture: bool) -> CommandResult:
        self.commands.append(list(command))
        if command[0] == "git":
            if self.git_code != 0:
                return CommandResult(self.git_code, "")
            lines = self.diff if command[1] == "diff" else self.untracked
            return CommandResult(0, "".join(f"{line}\n" for line in lines))
        if "--list" in command:
            return CommandResult(
                self.list_code,
                f"Listing tests:\nTotal: {len(self.selected)} tests in 1 file\n",
            )
        if "list" in command:
            return CommandResult(self.list_code, "".join(f"{line}\n" for line in self.selected))
        return CommandResult(self.npm_codes.pop(0), "")

    @property
    def npm_commands(self) -> list[list[str]]:
        """The runs that execute tests or a build, not the selection listings."""
        listings = ("list", "--list")
        return [
            command
            for command in self.commands
            if command[0] == "npm" and not any(word in command for word in listings)
        ]


# --- changed_paths ---------------------------------------------------------------------


def test_changed_paths_is_the_diff_without_renames_plus_untracked_files() -> None:
    runner = FakeRunner(diff=["a.py", "b.py"], untracked=["new.py", "a.py"])

    assert changed_paths(BASE, runner) == ["a.py", "b.py", "new.py"]
    assert [
        "git",
        "diff",
        "--name-only",
        "--no-renames",
        BASE,
    ] in runner.commands
    assert [
        "git",
        "ls-files",
        "--others",
        "--exclude-standard",
    ] in runner.commands


def test_changed_paths_exits_one_when_git_fails() -> None:
    with pytest.raises(SystemExit) as raised:
        changed_paths("nosuchsha", FakeRunner(git_code=128))

    assert raised.value.code == 1


def test_changed_paths_exits_one_on_an_empty_union(
    capsys: pytest.CaptureFixture[str],
) -> None:
    with pytest.raises(SystemExit) as raised:
        changed_paths(BASE, FakeRunner())

    assert raised.value.code == 1
    assert "affected: nothing changed -> full" in capsys.readouterr().err


# --- is_e2e_sound ----------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "web/e2e/flow.spec.ts",
        "web/e2e/nested/deep.spec.ts",
        "web/e2e/helpers/seed.ts",
        "web/e2e/helpers/nested/other.ts",
    ],
)
def test_a_spec_and_a_helper_are_e2e_sound(path: str) -> None:
    assert is_e2e_sound(path)


@pytest.mark.parametrize(
    "path",
    [
        "web/e2e/env.ts",
        "web/e2e/freePort.ts",
        "web/e2e/backend.ts",
        "web/e2e/console.ts",
        "web/e2e/flow.spec.tsx",
        "web/e2e/helpers",
        "web/src/App.tsx",
        "web/src/routes.test.ts",
        "app/main.py",
        "other/web/e2e/flow.spec.ts",
    ],
)
def test_everything_else_is_not_e2e_sound(path: str) -> None:
    assert not is_e2e_sound(path)


# --- main: e2e -------------------------------------------------------------------------


def test_e2e_with_any_unsound_path_never_builds_and_exits_one(
    capsys: pytest.CaptureFixture[str],
) -> None:
    runner = FakeRunner(diff=["web/e2e/flow.spec.ts", "app/main.py"])

    assert main(["e2e", BASE], runner) == 1

    assert runner.npm_commands == []
    assert "affected: unsound -> full" in capsys.readouterr().err


@pytest.mark.parametrize("npm_code", [0, 1, 7])
def test_e2e_with_only_sound_paths_returns_playwrights_code(
    npm_code: int, capsys: pytest.CaptureFixture[str]
) -> None:
    runner = FakeRunner(
        diff=["web/e2e/flow.spec.ts"],
        untracked=["web/e2e/helpers/new.ts"],
        npm_codes=[npm_code],
    )

    assert main(["e2e", BASE], runner) == npm_code

    assert runner.npm_commands == [
        ["npm", "--prefix", "web", "run", "e2e", "--", f"--only-changed={BASE}"]
    ]
    assert "affected: e2e-only -> playwright --only-changed" in capsys.readouterr().err


def test_e2e_exits_one_when_playwright_selects_no_test(
    capsys: pytest.CaptureFixture[str],
) -> None:
    # `playwright test --only-changed` itself exits 0 here; the wrapper must not, and
    # must not build.
    runner = FakeRunner(diff=["web/e2e/helpers/unused.ts"], selected=[])

    assert main(["e2e", BASE], runner) == 1

    assert runner.npm_commands == []
    assert "affected: nothing selected -> full" in capsys.readouterr().err


def test_e2e_returns_the_code_of_a_failing_selection_listing() -> None:
    runner = FakeRunner(diff=["web/e2e/flow.spec.ts"], list_code=5)

    assert main(["e2e", BASE], runner) == 5

    assert runner.npm_commands == []


def test_e2e_lists_the_selection_without_building() -> None:
    runner = FakeRunner(diff=["web/e2e/flow.spec.ts"], npm_codes=[0])
    main(["e2e", BASE], runner)

    assert [
        "npm",
        "--prefix",
        "web",
        "exec",
        "--",
        "playwright",
        "test",
        "--list",
        f"--only-changed={BASE}",
    ] in runner.commands


def test_e2e_with_nothing_changed_never_builds_and_exits_one() -> None:
    runner = FakeRunner()

    with pytest.raises(SystemExit) as raised:
        main(["e2e", BASE], runner)

    assert raised.value.code == 1
    assert runner.npm_commands == []


# --- main: vitest ----------------------------------------------------------------------


def test_vitest_stops_at_a_failing_changed_run_and_skips_the_guards(
    capsys: pytest.CaptureFixture[str],
) -> None:
    runner = FakeRunner(diff=["web/src/a.ts"], npm_codes=[1, 0])

    assert main(["vitest", BASE], runner) == 1

    assert runner.npm_commands == [["npm", "--prefix", "web", "test", "--", f"--changed={BASE}"]]
    err = capsys.readouterr().err
    assert "affected: changed" in err
    assert "affected: guards" not in err


@pytest.mark.parametrize("guard_code", [0, 1])
def test_vitest_runs_the_guards_after_a_passing_changed_run(
    guard_code: int, capsys: pytest.CaptureFixture[str]
) -> None:
    runner = FakeRunner(diff=["web/src/a.ts"], npm_codes=[0, guard_code])

    assert main(["vitest", BASE], runner) == guard_code

    first, second = runner.npm_commands
    assert first == ["npm", "--prefix", "web", "test", "--", f"--changed={BASE}"]
    assert second[:5] == ["npm", "--prefix", "web", "test", "--"]
    guards = second[5:]
    assert "src/routes.test.ts" in guards
    assert f"affected: guards ({len(guards)} files)" in capsys.readouterr().err


def test_vitest_exits_one_when_changed_selects_no_test_file(
    capsys: pytest.CaptureFixture[str],
) -> None:
    # `vitest run --changed` itself exits 0 here; the wrapper must not.
    runner = FakeRunner(diff=["app/main.py"], selected=[])

    assert main(["vitest", BASE], runner) == 1

    assert runner.npm_commands == []
    assert "affected: nothing selected -> full" in capsys.readouterr().err


def test_vitest_returns_the_code_of_a_failing_selection_listing() -> None:
    runner = FakeRunner(diff=["web/src/a.ts"], list_code=3)

    assert main(["vitest", BASE], runner) == 3

    assert runner.npm_commands == []


def test_vitest_lists_the_selection_the_way_it_will_run_it() -> None:
    runner = FakeRunner(diff=["web/src/a.ts"])
    main(["vitest", BASE], runner)

    assert [
        "npm",
        "--prefix",
        "web",
        "exec",
        "--",
        "vitest",
        "list",
        f"--changed={BASE}",
        "--filesOnly",
    ] in runner.commands


def test_vitest_with_nothing_changed_runs_no_npm() -> None:
    runner = FakeRunner()

    with pytest.raises(SystemExit) as raised:
        main(["vitest", BASE], runner)

    assert raised.value.code == 1
    assert runner.npm_commands == []


def test_a_wrapper_never_passes_a_flag_that_accepts_an_empty_selection() -> None:
    vitest = FakeRunner(diff=["web/src/a.ts"], npm_codes=[0, 0])
    main(["vitest", BASE], vitest)
    e2e = FakeRunner(diff=["web/e2e/flow.spec.ts"], npm_codes=[0])
    main(["e2e", BASE], e2e)

    for command in [*vitest.commands, *e2e.commands]:
        for part in command:
            assert "passWithNoTests" not in part
            assert "pass-with-no-tests" not in part


@pytest.mark.parametrize(
    "argv",
    [[], ["vitest"], ["pytest", BASE], ["vitest", "--help"], ["e2e", "-x", BASE]],
)
def test_a_bad_command_line_is_refused_before_any_command_runs(
    argv: list[str],
) -> None:
    runner = FakeRunner(diff=["web/src/a.ts"])

    assert main(argv, runner) == 2

    assert runner.commands == []


# --- discover_guards: fixture trees ----------------------------------------------------


def _tree(root: Path, files: dict[str, str]) -> Path:
    web_src = root / "web" / "src"
    for name, text in files.items():
        path = web_src / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    return web_src


@pytest.mark.parametrize(
    "text",
    [
        "const f = import.meta.glob<string>('./*.css', { query: '?raw' })",
        "import css from './a.css?raw'",
        "import { readdirSync } from 'node:fs'",
        "import { readFileSync } from 'node:fs'",
        "import { existsSync } from 'node:fs'",
        "import url from './a.svg?url'",
    ],
)
def test_a_test_with_a_guard_pattern_of_its_own_is_found(tmp_path: Path, text: str) -> None:
    web_src = _tree(tmp_path, {"a.test.ts": text})

    assert discover_guards(web_src) == ["src/a.test.ts"]


def test_a_test_is_found_through_a_one_level_helper_import(tmp_path: Path) -> None:
    web_src = _tree(
        tmp_path,
        {
            "sub/viaHelper.test.ts": "import { scan } from './scan'\nscan()",
            "sub/scan.ts": "import { readdirSync } from 'node:fs'",
            "viaIndex.test.tsx": "import { scan } from './lib'\nscan()",
            "lib/index.ts": "import { readFileSync } from 'node:fs'",
        },
    )

    assert discover_guards(web_src) == ["src/sub/viaHelper.test.ts", "src/viaIndex.test.tsx"]


def test_a_two_level_chain_is_not_found_the_stated_limit(tmp_path: Path) -> None:
    web_src = _tree(
        tmp_path,
        {
            "deep.test.ts": "import { a } from './a'\na()",
            "a.ts": "import { b } from './b'\nexport const a = b",
            "b.ts": "import { readdirSync } from 'node:fs'",
        },
    )

    assert discover_guards(web_src) == []


def test_a_plain_component_test_is_not_found(tmp_path: Path) -> None:
    web_src = _tree(
        tmp_path,
        {
            "Button.test.tsx": "import { Button } from './Button'\nrender(<Button />)",
            "Button.tsx": "export const Button = () => null",
        },
    )

    assert discover_guards(web_src) == []


def test_a_test_file_imported_by_a_test_is_not_a_helper(tmp_path: Path) -> None:
    web_src = _tree(
        tmp_path,
        {
            "a.test.ts": "import './b.test'",
            "b.test.ts": "import { readdirSync } from 'node:fs'",
        },
    )

    assert discover_guards(web_src) == ["src/b.test.ts"]


# --- discover_guards: the real tree ----------------------------------------------------


def test_the_real_tree_holds_every_known_whole_tree_guard() -> None:
    found = set(discover_guards(REPO_ROOT / "web" / "src"))

    assert {
        "src/architecture/forbiddenApis.real.test.ts",
        "src/architecture/hexColors.real.test.ts",
        "src/architecture/touch.test.ts",
        "src/architecture/insets.test.ts",
        "src/architecture/installShell.test.ts",
        "src/components/inAppState.test.ts",
        "src/routes.test.ts",
    } <= found
