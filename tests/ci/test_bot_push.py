"""`scripts/ci/bot-push.sh`: puts a bot commit on a branch that may have moved while a workflow ran.

Every test runs the script as a command against a bare scratch remote and asserts the exit code, the
remote's head and the one summary line. Hooks of the remote (a pre-receive that refuses) are written
into the bare repository.
"""

from __future__ import annotations

import contextlib
import os
import shutil
import subprocess
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "ci" / "bot-push.sh"
BOT = "41898283+github-actions[bot]@users.noreply.github.com"
LABEL = "Screen images"
NOTE = "the next master run updates the images."
SCREENS = "docs/assets/screens"
IGNORE = "docs/assets/screens/**"

HOOK = """#!/bin/sh
# Counts the pushes to master. The first REFUSE of them are refused; the first of those lands the
# commit parked at refs/pending/next on master, the way a concurrent run would.
refuse={refuse}
land={land}
touches_master=0
while read -r old new ref; do
  [ "$ref" = refs/heads/master ] && touches_master=1
done
[ "$touches_master" -eq 1 ] || exit 0
count=$(cat hook-count 2>/dev/null || echo 0)
count=$((count + 1))
echo "$count" > hook-count
if [ "$count" -le "$refuse" ]; then
  if [ "$count" -eq 1 ] && [ "$land" -eq 1 ]; then
    env -u GIT_QUARANTINE_PATH -u GIT_OBJECT_DIRECTORY -u GIT_ALTERNATE_OBJECT_DIRECTORIES \\
      git update-ref refs/heads/master refs/pending/next
  fi
  echo "hook: push refused" >&2
  exit 1
fi
exit 0
"""


def skipped(base: str, tip: str) -> str:
    return f"{LABEL}: not pushed, master moved from {base} to {tip} during the run; {NOTE}"


def git(cwd: Path, *args: str, who: str = "human", check: bool = True) -> str:
    email = BOT if who == "bot" else "dev@example.com"
    name = "github-actions[bot]" if who == "bot" else "Dev"
    env = {
        **os.environ,
        "GIT_AUTHOR_NAME": name,
        "GIT_AUTHOR_EMAIL": email,
        "GIT_COMMITTER_NAME": name,
        "GIT_COMMITTER_EMAIL": email,
    }
    done = subprocess.run(
        ["git", "-c", "protocol.file.allow=always", *args],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=check,
    )
    return done.stdout.strip()


@dataclass(frozen=True)
class Scratch:
    origin: Path
    work: Path
    other: Path
    base: str
    rev: str
    summary: Path

    def commit(
        self, repo: Path, files: Mapping[str, str | None], *, bot: bool, message: str = "change"
    ) -> str:
        """A commit in `repo` that writes the files (None deletes one); returns its sha."""
        for name, content in files.items():
            if content is None:
                (repo / name).unlink()
                with contextlib.suppress(OSError):
                    (repo / name).parent.rmdir()
        for name, content in files.items():
            if content is not None:
                (repo / name).parent.mkdir(parents=True, exist_ok=True)
                (repo / name).write_text(content, encoding="utf-8")
        who = "bot" if bot else "human"
        git(repo, "add", "-A", who=who)
        git(repo, "commit", "-q", "-m", message, who=who)
        return git(repo, "rev-parse", "HEAD")

    def land(self, files: Mapping[str, str | None], *, bot: bool) -> str:
        """A commit another run pushed to master."""
        sha = self.commit(self.other, files, bot=bot)
        git(self.other, "push", "-q", "origin", "master")
        return sha

    def land_merge(self, side: Mapping[str, str | None], *, side_bot: bool, merge_bot: bool) -> str:
        """A merge, with `side` committed on a branch off master, pushed to master."""
        git(self.other, "checkout", "-q", "-b", "side")
        self.commit(self.other, side, bot=side_bot)
        git(self.other, "checkout", "-q", "master")
        who = "bot" if merge_bot else "human"
        git(self.other, "merge", "-q", "--no-ff", "-m", "merge", "side", who=who)
        git(self.other, "push", "-q", "origin", "master")
        return git(self.other, "rev-parse", "HEAD")

    def install_hook(self, refuse: int, land: str | None = None) -> None:
        """A pre-receive hook refusing the first `refuse` pushes to master; the first one also
        moves master to the commit `land` (made in `other`, not pushed) when it is given."""
        if land is not None:
            git(self.other, "push", "-q", "origin", f"{land}:refs/pending/next")
        hook = self.origin / "hooks" / "pre-receive"
        hook.write_text(HOOK.format(refuse=refuse, land=int(land is not None)), encoding="utf-8")
        hook.chmod(0o755)

    def hook_count(self) -> int:
        counter = self.origin / "hook-count"
        return int(counter.read_text()) if counter.exists() else 0

    def run(self, *args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(SCRIPT), *args],
            cwd=cwd or self.work,
            capture_output=True,
            text=True,
            check=False,
        )

    def push(
        self,
        *extra: str,
        rev: str | None = None,
        summary: str | None = None,
        cwd: Path | None = None,
    ) -> subprocess.CompletedProcess[str]:
        """The script with the arguments of the screen-images call; `extra` comes last."""
        return self.run(
            "--sha", self.base,
            "--commit", rev or self.rev,
            "--summary", summary if summary is not None else str(self.summary),
            "--label", LABEL,
            "--skip-note", NOTE,
            "--ignore", IGNORE,
            *extra,
            cwd=cwd,
        )  # fmt: skip

    def origin_head(self) -> str:
        return git(self.origin, "rev-parse", "master")

    def summary_lines(self) -> list[str]:
        return self.summary.read_text().splitlines() if self.summary.exists() else []

    def outcome(self, done: subprocess.CompletedProcess[str], code: int, head: str) -> str:
        """Asserts the exit code, the remote's head and one summary line; returns the line."""
        assert done.returncode == code, done.stderr
        assert self.origin_head() == head
        lines = self.summary_lines()
        assert len(lines) == 1, lines
        assert lines[0].startswith(f"{LABEL}: ")
        assert done.stdout == ""
        return lines[0]


@pytest.fixture
def scratch(tmp_path: Path) -> Scratch:
    origin = tmp_path / "origin.git"
    subprocess.run(["git", "init", "-q", "--bare", "-b", "master", str(origin)], check=True)
    work = tmp_path / "work"
    subprocess.run(["git", "clone", "-q", str(origin), str(work)], check=True)
    git(work, "checkout", "-q", "-b", "master")
    (work / SCREENS).mkdir(parents=True)
    (work / SCREENS / "a.webp").write_text("first")
    (work / "app").mkdir()
    (work / "app" / "x.py").write_text("x = 1\n")
    git(work, "add", "-A")
    git(work, "commit", "-q", "-m", "base")
    git(work, "push", "-q", "origin", "master")
    base = git(work, "rev-parse", "HEAD")
    other = tmp_path / "other"
    subprocess.run(["git", "clone", "-q", str(origin), str(other)], check=True)
    placeholder = Scratch(origin, work, other, base, base, tmp_path / "summary.md")
    rev = placeholder.commit(
        work, {f"{SCREENS}/a.webp": "rev", f"{SCREENS}/b.webp": "new"}, bot=True
    )
    return Scratch(origin, work, other, base, rev, tmp_path / "summary.md")


def test_master_did_not_move_pushes_the_commit_itself(scratch: Scratch) -> None:
    done = scratch.push()

    line = scratch.outcome(done, 0, scratch.rev)
    assert line == f"{LABEL}: pushed {scratch.rev} to master."


def test_master_moved_by_a_bot_commit_on_an_owned_path_pushes_on_top_of_it(
    scratch: Scratch,
) -> None:
    landed = scratch.land({"docs/api/new.md": "api"}, bot=True)

    done = scratch.push()

    head = scratch.origin_head()
    line = scratch.outcome(done, 0, head)
    assert line == f"{LABEL}: pushed {head} to master."
    assert git(scratch.origin, "rev-parse", f"{head}^") == landed
    assert git(scratch.origin, "log", "-1", "--format=%ae|%ce", head) == f"{BOT}|{BOT}"
    assert git(scratch.origin, "show", f"{head}:{SCREENS}/a.webp") == "rev"
    assert git(scratch.origin, "show", f"{head}:docs/api/new.md") == "api"


def test_the_pushed_commit_is_the_bots_even_when_rev_was_not(scratch: Scratch) -> None:
    git(scratch.work, "reset", "-q", "--hard", scratch.base)
    human_rev = scratch.commit(scratch.work, {f"{SCREENS}/a.webp": "rev"}, bot=False)
    scratch.land({"docs/api/new.md": "api"}, bot=True)

    done = scratch.push(rev=human_rev)

    head = scratch.origin_head()
    scratch.outcome(done, 0, head)
    assert git(scratch.origin, "log", "-1", "--format=%ae|%ce", head) == f"{BOT}|{BOT}"


def test_master_moved_by_a_human_commit_touching_code_is_not_pushed_over(scratch: Scratch) -> None:
    moved = scratch.land({"app/x.py": "x = 2\n"}, bot=False)

    done = scratch.push()

    line = scratch.outcome(done, 0, moved)
    assert line == skipped(scratch.base, moved)


def test_master_moved_by_a_human_commit_touching_only_ignored_paths_pushes(
    scratch: Scratch,
) -> None:
    landed = scratch.land({f"{SCREENS}/c.webp": "human"}, bot=False)

    done = scratch.push()

    head = scratch.origin_head()
    scratch.outcome(done, 0, head)
    assert git(scratch.origin, "rev-parse", f"{head}^") == landed
    assert git(scratch.origin, "show", f"{head}:{SCREENS}/c.webp") == "human"


def test_master_moved_by_a_bot_commit_with_a_stray_path_is_not_pushed_over(
    scratch: Scratch,
) -> None:
    moved = scratch.land({f"{SCREENS}/c.webp": "bot", "app/x.py": "x = 3\n"}, bot=True)

    done = scratch.push()

    line = scratch.outcome(done, 0, moved)
    assert line.startswith(f"{LABEL}: not pushed, master moved from {scratch.base} to {moved}")


@pytest.mark.parametrize(
    ("side", "side_bot", "merge_bot"),
    [
        ({"app/x.py": "x = 4\n"}, False, False),
        ({"docs/api/side.md": "side"}, True, False),
    ],
)
def test_a_human_merge_counts_as_touching_what_it_brings_in(
    scratch: Scratch, side: dict[str, str | None], side_bot: bool, merge_bot: bool
) -> None:
    moved = scratch.land_merge(side, side_bot=side_bot, merge_bot=merge_bot)

    done = scratch.push()

    line = scratch.outcome(done, 0, moved)
    assert line.startswith(f"{LABEL}: not pushed, master moved from {scratch.base} to {moved}")


@pytest.mark.parametrize(
    "files",
    [
        {"docs/assets/screens-old/x": "lookalike"},
        {f"{SCREENS}/a.webp": None, SCREENS: "a file, not the folder"},
    ],
    ids=["sibling-folder", "file-named-like-the-folder"],
)
def test_a_human_commit_on_a_lookalike_of_the_images_path_is_not_pushed_over(
    scratch: Scratch, files: dict[str, str | None]
) -> None:
    moved = scratch.land(files, bot=False)

    done = scratch.push()

    line = scratch.outcome(done, 0, moved)
    assert line.startswith(f"{LABEL}: not pushed, master moved from {scratch.base} to {moved}")


def test_a_human_rename_into_the_images_still_counts_its_old_path(scratch: Scratch) -> None:
    git(scratch.other, "mv", "app/x.py", f"{SCREENS}/x.webp")
    git(scratch.other, "commit", "-q", "-m", "move")
    git(scratch.other, "push", "-q", "origin", "master")
    moved = scratch.origin_head()

    done = scratch.push()

    line = scratch.outcome(done, 0, moved)
    assert line.startswith(f"{LABEL}: not pushed, master moved from {scratch.base} to {moved}")


def test_a_bot_commit_on_a_path_with_a_non_ascii_name_is_owned(scratch: Scratch) -> None:
    scratch.land({f"{SCREENS}/ñ.webp": "n"}, bot=True)

    done = scratch.push()

    scratch.outcome(done, 0, scratch.origin_head())
    head = scratch.origin_head()
    assert git(scratch.origin, "show", f"{head}:{SCREENS}/a.webp") == "rev"


def test_a_conflict_between_two_bot_commits_fails_and_leaves_nothing_in_progress(
    scratch: Scratch,
) -> None:
    moved = scratch.land({f"{SCREENS}/a.webp": "theirs"}, bot=True)

    done = scratch.push()

    line = scratch.outcome(done, 1, moved)
    assert line.startswith(f"{LABEL}: failed, the commit to push conflicts with master at {moved}")
    assert git(scratch.work, "status", "--porcelain") == ""
    assert not (scratch.work / ".git" / "CHERRY_PICK_HEAD").exists()
    assert git(scratch.work, "rev-parse", "HEAD") == moved


def test_master_already_having_the_same_change_pushes_nothing(scratch: Scratch) -> None:
    moved = scratch.land({f"{SCREENS}/a.webp": "rev", f"{SCREENS}/b.webp": "new"}, bot=True)

    done = scratch.push()

    line = scratch.outcome(done, 0, moved)
    assert (
        line == f"{LABEL}: nothing to push, master at {moved} already has {scratch.rev}'s changes."
    )
    assert git(scratch.work, "status", "--porcelain") == ""
    assert not (scratch.work / ".git" / "CHERRY_PICK_HEAD").exists()


def test_a_shallow_clone_fails(scratch: Scratch, tmp_path: Path) -> None:
    shallow = tmp_path / "shallow"
    subprocess.run(
        ["git", "clone", "-q", "--depth", "1", f"file://{scratch.origin}", str(shallow)], check=True
    )
    rev = scratch.commit(shallow, {f"{SCREENS}/a.webp": "rev"}, bot=True)

    done = scratch.push(rev=rev, cwd=shallow)

    line = scratch.outcome(done, 1, scratch.base)
    assert line.startswith(f"{LABEL}: failed, the clone is shallow")


def test_a_hook_that_always_refuses_fails_after_four_attempts_with_retries_on_stderr(
    scratch: Scratch,
) -> None:
    scratch.install_hook(refuse=99)

    done = scratch.push()

    line = scratch.outcome(done, 1, scratch.base)
    assert line == f"{LABEL}: failed, the push to master was rejected 4 times."
    assert scratch.hook_count() == 4
    assert done.stderr.count("retrying") == 3


def test_a_hook_that_always_refuses_after_master_moved_fails_too(scratch: Scratch) -> None:
    moved = scratch.land({"docs/api/new.md": "api"}, bot=True)
    scratch.install_hook(refuse=99)

    done = scratch.push()

    scratch.outcome(done, 1, moved)
    assert scratch.hook_count() == 4


def test_a_refusal_while_a_bot_commit_lands_recovers_on_top_of_it(scratch: Scratch) -> None:
    landing = scratch.commit(scratch.other, {"docs/api/late.md": "late"}, bot=True)
    scratch.install_hook(refuse=1, land=landing)

    done = scratch.push()

    head = scratch.origin_head()
    line = scratch.outcome(done, 0, head)
    assert line == f"{LABEL}: pushed {head} to master."
    assert head not in (landing, scratch.rev)
    assert git(scratch.origin, "rev-parse", f"{head}^") == landing
    assert git(scratch.origin, "show", f"{head}:{SCREENS}/a.webp") == "rev"
    assert scratch.hook_count() == 2
    assert "retrying" in done.stderr


def test_a_refusal_while_a_human_code_commit_lands_skips(scratch: Scratch) -> None:
    landing = scratch.commit(scratch.other, {"app/x.py": "x = 5\n"}, bot=False)
    scratch.install_hook(refuse=1, land=landing)

    done = scratch.push()

    line = scratch.outcome(done, 0, landing)
    assert line == skipped(scratch.base, landing)
    assert scratch.hook_count() == 1


def test_a_refusal_when_master_did_not_move_retries_the_commit_itself(scratch: Scratch) -> None:
    scratch.install_hook(refuse=1)

    done = scratch.push()

    line = scratch.outcome(done, 0, scratch.rev)
    assert line == f"{LABEL}: pushed {scratch.rev} to master."
    assert scratch.hook_count() == 2


def test_the_commit_is_resolved_before_the_work_tree_moves(scratch: Scratch) -> None:
    scratch.land({"docs/api/new.md": "api"}, bot=True)

    done = scratch.push(rev="HEAD")

    head = scratch.origin_head()
    scratch.outcome(done, 0, head)
    assert git(scratch.origin, "show", f"{head}:{SCREENS}/a.webp") == "rev"
    assert git(scratch.origin, "show", f"{head}:{SCREENS}/b.webp") == "new"


def test_a_commit_without_a_first_parent_in_the_range_fails(scratch: Scratch) -> None:
    git(scratch.other, "checkout", "-q", "--orphan", "unrelated")
    git(scratch.other, "rm", "-rf", "-q", ".")
    scratch.commit(scratch.other, {"docs/api/root.md": "root"}, bot=True)
    git(scratch.other, "checkout", "-q", "master")
    git(
        scratch.other, "merge", "-q", "--allow-unrelated-histories", "-m", "join", "unrelated",
        who="bot",
    )  # fmt: skip
    git(scratch.other, "push", "-q", "origin", "master")
    moved = scratch.origin_head()

    done = scratch.push()

    line = scratch.outcome(done, 1, moved)
    assert (
        line == f"{LABEL}: failed, a commit between {scratch.base} and {moved} has no first parent."
    )


def test_a_commit_to_push_without_a_first_parent_fails(scratch: Scratch) -> None:
    git(scratch.work, "checkout", "-q", "--orphan", "unrelated")
    git(scratch.work, "rm", "-rf", "-q", ".")
    root = scratch.commit(scratch.work, {"docs/api/root.md": "root"}, bot=True)

    done = scratch.push(rev=root)

    line = scratch.outcome(done, 1, scratch.base)
    assert line == f"{LABEL}: failed, the commit to push has no first parent."


def test_a_commit_to_push_with_a_stray_path_fails(scratch: Scratch) -> None:
    git(scratch.work, "reset", "-q", "--hard", scratch.base)
    stray = scratch.commit(
        scratch.work, {f"{SCREENS}/a.webp": "rev", "app/x.py": "x = 6\n"}, bot=True
    )

    done = scratch.push(rev=stray)

    line = scratch.outcome(done, 1, scratch.base)
    assert (
        line == f"{LABEL}: failed, the commit to push touches a path outside the bot-owned paths."
    )


def test_a_commit_to_push_that_does_not_exist_fails(scratch: Scratch) -> None:
    done = scratch.push(rev="no-such-commit")

    line = scratch.outcome(done, 1, scratch.base)
    assert line == f"{LABEL}: failed, --commit does not name a commit."


def test_an_empty_summary_path_writes_the_one_line_to_stdout(scratch: Scratch) -> None:
    done = scratch.push(summary="")

    assert done.returncode == 0, done.stderr
    assert scratch.origin_head() == scratch.rev
    assert done.stdout == f"{LABEL}: pushed {scratch.rev} to master.\n"
    assert scratch.summary_lines() == []


def test_a_missing_summary_flag_is_bad_usage(scratch: Scratch) -> None:
    done = scratch.run(
        "--sha", scratch.base, "--commit", scratch.rev, "--label", LABEL, "--skip-note", NOTE
    )  # fmt: skip

    assert done.returncode == 2
    assert done.stdout == ""
    assert done.stderr.startswith("usage: bot-push.sh")
    assert scratch.origin_head() == scratch.base


@pytest.mark.parametrize(
    "args",
    [
        [],
        ["--bogus", "x"],
        ["--sha"],
        ["--sha", "a", "--commit", "b", "--summary", "s", "--label", "l"],
        ["--sha", "a", "--commit", "b", "--summary", "s", "--skip-note", "n"],
        ["--sha", "a", "--summary", "s", "--label", "l", "--skip-note", "n"],
        ["--commit", "b", "--summary", "s", "--label", "l", "--skip-note", "n"],
    ],
)
def test_other_bad_usage_exits_two_with_a_usage_line_only(
    scratch: Scratch, args: list[str]
) -> None:
    done = scratch.run(*args)

    assert done.returncode == 2
    assert done.stdout == ""
    assert done.stderr.startswith("usage: bot-push.sh")
    assert scratch.summary_lines() == []


def test_the_script_is_executable_and_bash_is_available() -> None:
    assert os.access(SCRIPT, os.X_OK)
    assert shutil.which("bash") is not None
