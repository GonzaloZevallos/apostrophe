"""`scripts/docs/regen_pack.py` and `scripts/docs/regen-publish.sh`: move the regenerated docs
from one job to another and commit them as the bot.

Every test is a round trip: pack from a scratch source tree that has its own `.agentic/stack.yaml`,
then publish into a scratch clone of a bare remote, through the real `scripts/ci/bot-push.sh`. The
asserts read the exit code, the remote and the one summary line.
"""

from __future__ import annotations

import io
import os
import subprocess
import sys
import tarfile
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

import pytest
import yaml

from scripts.docs import regen_pack
from scripts.docs.owned_paths import owned_paths
from scripts.docs.regen_pack import PackError, pack
from scripts.docs.tools import REPO_ROOT

PUBLISH = REPO_ROOT / "scripts" / "docs" / "regen-publish.sh"
BOT = "41898283+github-actions[bot]@users.noreply.github.com"
SUBJECT = "chore(docs): regenerate [skip ci]"
UNCHANGED = "Generated docs: no generated doc changed, nothing committed."
INVALID_LINE = "Generated docs: failed, the owned file has an invalid line."
OUTSIDE = "Generated docs: failed, a member is outside the owned paths."
USAGE = "usage: regen-publish.sh --sha SHA --tar FILE --owned FILE --summary FILE"

BASE_FILES: Mapping[str, str] = {
    "docs/api/a.md": "api a\n",
    "docs/api/b.md": "api b\n",
    "docs/architecture/generated/er.mmd": "er\n",
    "docs/architecture/decisiones.md": "decisions\n",
    "README.md": "readme\n",
    "app/x.py": "x = 1\n",
}


def git(cwd: Path, *args: str, who: str = "human") -> str:
    email = BOT if who == "bot" else "dev@example.com"
    name = "github-actions[bot]" if who == "bot" else "Dev"
    env = {
        **os.environ,
        "GIT_AUTHOR_NAME": name,
        "GIT_AUTHOR_EMAIL": email,
        "GIT_COMMITTER_NAME": name,
        "GIT_COMMITTER_EMAIL": email,
    }
    done = subprocess.run(["git", *args], cwd=cwd, env=env, capture_output=True, text=True)
    assert done.returncode == 0, done.stderr
    return done.stdout.strip()


def write_tree(root: Path, files: Mapping[str, str]) -> None:
    """The files under `root`, plus the `.agentic/stack.yaml` that lists the owned paths."""
    stack = {"docs": {"paths": owned_paths(REPO_ROOT)}}
    (root / ".agentic").mkdir(parents=True, exist_ok=True)
    (root / ".agentic" / "stack.yaml").write_text(yaml.safe_dump(stack), encoding="utf-8")
    for name, content in files.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(content, encoding="utf-8")


def tar_of(path: Path, members: Mapping[str, str | None]) -> Path:
    """A tar written by hand: a string is a file's content, None is a symlink to `x`."""
    with tarfile.open(path, "w") as archive:
        for name, content in members.items():
            info = tarfile.TarInfo(name)
            info.mode = 0o644
            if content is None:
                info.type = tarfile.SYMTYPE
                info.linkname = "x"
                archive.addfile(info)
            else:
                data = content.encode()
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
    return path


@dataclass(frozen=True)
class Scratch:
    origin: Path
    work: Path
    other: Path
    src: Path
    out: Path
    base: str
    summary: Path
    tmpdir: Path

    def pack(self) -> None:
        pack(self.src, self.out)

    def publish(
        self,
        *,
        tar: Path | None = None,
        owned: Path | None = None,
        sha: str | None = None,
    ) -> subprocess.CompletedProcess[str]:
        """The script at the work clone's root, with a human identity exported."""
        env = {
            **os.environ,
            "TMPDIR": str(self.tmpdir),
            "GIT_AUTHOR_NAME": "Dev",
            "GIT_AUTHOR_EMAIL": "dev@example.com",
            "GIT_COMMITTER_NAME": "Dev",
            "GIT_COMMITTER_EMAIL": "dev@example.com",
        }
        return self.run(
            "--sha", sha or self.base,
            "--tar", str(tar or self.out / "owned-docs.tar"),
            "--owned", str(owned or self.out / "owned-paths.txt"),
            "--summary", str(self.summary),
            env=env,
        )  # fmt: skip

    def run(
        self, *args: str, env: Mapping[str, str] | None = None
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(PUBLISH), *args],
            cwd=self.work,
            env=dict(env) if env is not None else None,
            capture_output=True,
            text=True,
            check=False,
        )

    def owned_file(self, *lines: str) -> Path:
        path = self.out.parent / "owned.txt"
        path.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
        return path

    def land(self, files: Mapping[str, str], *, bot: bool) -> str:
        """A commit another run pushed to master; returns its sha."""
        for name, content in files.items():
            (self.other / name).parent.mkdir(parents=True, exist_ok=True)
            (self.other / name).write_text(content, encoding="utf-8")
        who = "bot" if bot else "human"
        git(self.other, "add", "-A", who=who)
        git(self.other, "commit", "-q", "-m", "moved", who=who)
        git(self.other, "push", "-q", "origin", "master")
        return git(self.other, "rev-parse", "HEAD")

    def head(self) -> str:
        return git(self.origin, "rev-parse", "master")

    def refs(self) -> str:
        return git(self.origin, "for-each-ref")

    def lines(self) -> list[str]:
        return self.summary.read_text().splitlines() if self.summary.exists() else []

    def one_line(self) -> str:
        assert len(self.lines()) == 1, self.lines()
        return self.lines()[0]

    def tmpdir_left(self) -> list[str]:
        return sorted(p.name for p in self.tmpdir.iterdir())

    def changed(self, rev: str) -> list[str]:
        out = git(self.origin, "diff-tree", "--no-commit-id", "--name-only", "-r", rev)
        return out.splitlines()

    def tracked(self, rev: str) -> list[str]:
        return git(self.origin, "ls-tree", "-r", "--name-only", rev).splitlines()


def build(tmp_path: Path, base_files: Mapping[str, str]) -> Scratch:
    origin = tmp_path / "origin.git"
    subprocess.run(["git", "init", "-q", "--bare", "-b", "master", str(origin)], check=True)
    work = tmp_path / "work"
    subprocess.run(["git", "clone", "-q", str(origin), str(work)], check=True)
    git(work, "checkout", "-q", "-b", "master")
    write_tree(work, base_files)
    git(work, "add", "-A")
    git(work, "commit", "-q", "-m", "base")
    git(work, "push", "-q", "origin", "master")
    other = tmp_path / "other"
    subprocess.run(["git", "clone", "-q", str(origin), str(other)], check=True)
    src = tmp_path / "src"
    src.mkdir()
    write_tree(src, base_files)
    tmpdir = tmp_path / "tmpdir"
    tmpdir.mkdir()
    return Scratch(
        origin=origin,
        work=work,
        other=other,
        src=src,
        out=tmp_path / "out" / "pack",
        base=git(work, "rev-parse", "HEAD"),
        summary=tmp_path / "summary.md",
        tmpdir=tmpdir,
    )


@pytest.fixture
def scratch(tmp_path: Path) -> Scratch:
    return build(tmp_path, BASE_FILES)


def test_a_changed_file_lands_as_one_bot_commit_touching_only_owned_paths(
    scratch: Scratch,
) -> None:
    (scratch.src / "docs/api/a.md").write_text("api a, changed\n")
    (scratch.src / "docs/api/new.md").write_text("new\n")
    scratch.pack()

    done = scratch.publish()

    assert done.returncode == 0, done.stderr
    head = scratch.head()
    assert git(scratch.origin, "rev-parse", f"{head}^") == scratch.base
    assert git(scratch.origin, "log", "-1", "--format=%ae|%ce", head) == f"{BOT}|{BOT}"
    assert git(scratch.origin, "log", "-1", "--format=%s", head) == SUBJECT
    assert sorted(scratch.changed(head)) == ["docs/api/a.md", "docs/api/new.md"]
    assert git(scratch.origin, "show", f"{head}:docs/api/a.md") == "api a, changed"
    assert scratch.one_line().startswith("Generated docs: pushed")
    assert scratch.tmpdir_left() == []


def test_a_file_the_generator_no_longer_writes_is_deleted_on_the_remote(
    scratch: Scratch,
) -> None:
    (scratch.src / "docs/api/b.md").unlink()
    scratch.pack()

    done = scratch.publish()

    assert done.returncode == 0, done.stderr
    assert "docs/api/b.md" not in scratch.tracked(scratch.head())
    assert scratch.changed(scratch.head()) == ["docs/api/b.md"]
    assert scratch.one_line().startswith("Generated docs: pushed")


def test_nothing_changed_commits_nothing(scratch: Scratch) -> None:
    scratch.pack()

    done = scratch.publish()

    assert done.returncode == 0, done.stderr
    assert scratch.head() == scratch.base
    assert git(scratch.work, "rev-parse", "HEAD") == scratch.base
    assert scratch.one_line() == UNCHANGED
    assert scratch.tmpdir_left() == []


def test_a_stray_untracked_path_fails_and_pushes_nothing(scratch: Scratch) -> None:
    (scratch.src / "docs/api/a.md").write_text("api a, changed\n")
    scratch.pack()
    (scratch.work / "app" / "y.py").write_text("y = 1\n")
    refs = scratch.refs()

    done = scratch.publish()

    assert done.returncode == 1
    assert "app/y.py" in done.stderr
    assert scratch.refs() == refs
    assert scratch.one_line() == (
        "Generated docs: failed, paths outside the owned paths are changed."
    )
    assert scratch.tmpdir_left() == []


def test_a_modified_tracked_file_outside_the_owned_paths_is_a_stray_path(
    scratch: Scratch,
) -> None:
    scratch.pack()
    (scratch.work / "README.md").write_text("edited\n")

    done = scratch.publish()

    assert done.returncode == 1
    assert "README.md" in done.stderr
    assert scratch.head() == scratch.base


def test_a_sibling_directory_of_an_owned_one_is_a_stray_path(scratch: Scratch) -> None:
    scratch.pack()
    (scratch.work / "docs/api-old").mkdir()
    (scratch.work / "docs/api-old/x").write_text("old\n")

    done = scratch.publish()

    assert done.returncode == 1
    assert "docs/api-old/x" in done.stderr
    assert scratch.head() == scratch.base
    assert scratch.one_line().startswith("Generated docs: failed")


def test_the_pack_cli_writes_the_owned_paths_and_the_tar(tmp_path: Path) -> None:
    done = subprocess.run(
        [sys.executable, "-m", "scripts.docs.regen_pack", "--out", str(tmp_path / "pack")],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert done.returncode == 0, done.stderr
    lines = (tmp_path / "pack" / "owned-paths.txt").read_text().splitlines()
    assert lines == owned_paths(REPO_ROOT)
    assert (tmp_path / "pack" / "owned-docs.tar").is_file()


def test_the_pack_holds_every_owned_file_in_a_deterministic_tar(scratch: Scratch) -> None:
    scratch.pack()
    first = (scratch.out / "owned-docs.tar").read_bytes()
    os.utime(scratch.src / "docs/api/a.md", (12345, 12345))
    scratch.pack()

    assert (scratch.out / "owned-docs.tar").read_bytes() == first
    with tarfile.open(scratch.out / "owned-docs.tar") as archive:
        assert archive.getnames() == [
            "docs/api/a.md",
            "docs/api/b.md",
            "docs/architecture/decisiones.md",
            "docs/architecture/generated/er.mmd",
        ]
        assert {m.mode for m in archive.getmembers()} == {0o644}
        assert {m.mtime for m in archive.getmembers()} == {0}


def test_a_tar_member_outside_the_owned_paths_fails_and_changes_nothing(
    scratch: Scratch, tmp_path: Path
) -> None:
    scratch.pack()
    tar = tar_of(tmp_path / "bad.tar", {"docs/api/a.md": "changed\n", "app/z.py": "z = 1\n"})
    refs = scratch.refs()

    done = scratch.publish(tar=tar)

    assert done.returncode == 1
    assert "app/z.py" in done.stderr
    assert scratch.refs() == refs
    assert git(scratch.work, "rev-parse", "HEAD") == scratch.base
    assert git(scratch.work, "status", "--porcelain") == ""
    assert scratch.one_line() == OUTSIDE
    assert scratch.tmpdir_left() == []


def test_a_file_where_an_owned_directory_belongs_fails_and_changes_nothing(
    scratch: Scratch, tmp_path: Path
) -> None:
    tar = tar_of(tmp_path / "bad.tar", {"docs/api": "not a directory\n"})
    scratch.pack()

    done = scratch.publish(tar=tar)

    assert done.returncode == 1
    assert scratch.one_line() == OUTSIDE
    assert git(scratch.work, "status", "--porcelain") == ""
    assert scratch.head() == scratch.base


def test_a_symlink_member_fails_and_changes_nothing(scratch: Scratch, tmp_path: Path) -> None:
    scratch.pack()
    tar = tar_of(tmp_path / "link.tar", {"docs/api/a.md": None})

    done = scratch.publish(tar=tar)

    assert done.returncode == 1
    assert scratch.one_line() == "Generated docs: failed, a member is not a regular file."
    assert git(scratch.work, "status", "--porcelain") == ""
    assert scratch.head() == scratch.base


def test_an_empty_tar_while_docs_are_tracked_deletes_nothing(
    scratch: Scratch, tmp_path: Path
) -> None:
    scratch.pack()
    tar = tar_of(tmp_path / "empty.tar", {})

    done = scratch.publish(tar=tar)

    assert done.returncode == 1
    assert scratch.one_line() == "Generated docs: failed, the pack is empty."
    assert git(scratch.work, "status", "--porcelain") == ""
    assert scratch.head() == scratch.base
    assert (scratch.work / "docs/api/a.md").is_file()


def test_a_tar_that_is_not_a_tar_is_refused(scratch: Scratch, tmp_path: Path) -> None:
    scratch.pack()
    broken = tmp_path / "broken.tar"
    broken.write_text("this is not a tar\n")

    done = scratch.publish(tar=broken)

    assert done.returncode == 1
    assert scratch.one_line() == "Generated docs: failed, the pack cannot be read."
    assert git(scratch.work, "status", "--porcelain") == ""


@pytest.mark.parametrize(
    "line",
    [
        "/**",
        "../x",
        "",
        ".",
        "/abs/file",
        "docs/**/x",
        "docs/api/**/**",
        "docs/**x",
        "a/./b",
        "a/../b",
        ".git/**",
        "docs//x",
        "docs/",
    ],
)
def test_an_owned_file_with_an_invalid_line_is_refused_before_anything_changes(
    scratch: Scratch, line: str
) -> None:
    (scratch.src / "docs/api/a.md").write_text("api a, changed\n")
    scratch.pack()
    owned = scratch.owned_file("docs/api/**", line)
    refs = scratch.refs()

    done = scratch.publish(owned=owned)

    assert done.returncode == 1
    assert scratch.refs() == refs
    assert git(scratch.work, "status", "--porcelain") == ""
    assert (scratch.work / "docs/api/a.md").read_text() == "api a\n"
    assert scratch.one_line() == INVALID_LINE
    assert scratch.tmpdir_left() == []


def test_an_owned_file_with_no_line_is_refused(scratch: Scratch) -> None:
    scratch.pack()
    owned = scratch.out.parent / "owned.txt"
    owned.write_text("")

    done = scratch.publish(owned=owned)

    assert done.returncode == 1
    assert scratch.one_line() == "Generated docs: failed, the owned file is empty."
    assert git(scratch.work, "status", "--porcelain") == ""
    assert scratch.head() == scratch.base


def test_a_missing_owned_exact_file_packs_as_nothing_and_is_deleted_on_the_remote(
    scratch: Scratch,
) -> None:
    (scratch.src / "docs/architecture/decisiones.md").unlink()
    scratch.pack()

    done = scratch.publish()

    assert done.returncode == 0, done.stderr
    assert "docs/architecture/decisiones.md" not in scratch.tracked(scratch.head())
    assert scratch.changed(scratch.head()) == ["docs/architecture/decisiones.md"]


def test_the_pack_refuses_an_executable_file_and_names_it(scratch: Scratch) -> None:
    (scratch.src / "docs/api/a.md").chmod(0o755)

    with pytest.raises(PackError, match="docs/api/a.md: an executable file"):
        scratch.pack()


def test_the_pack_command_exits_1_naming_a_symlink(
    scratch: Scratch, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    (scratch.src / "docs/api/link.md").symlink_to("a.md")
    monkeypatch.setattr(regen_pack, "REPO_ROOT", scratch.src)

    code = regen_pack.main(["--out", str(scratch.out)])

    assert code == 1
    assert "docs/api/link.md: a symlink under an owned path" in capsys.readouterr().err


def test_master_moved_by_a_human_commit_is_not_pushed_over(scratch: Scratch) -> None:
    (scratch.src / "docs/api/a.md").write_text("api a, changed\n")
    scratch.pack()
    moved = scratch.land({"README.md": "human edit\n"}, bot=False)

    done = scratch.publish()

    assert done.returncode == 0, done.stderr
    assert scratch.head() == moved
    assert scratch.one_line() == (
        f"Generated docs: not pushed, master moved from {scratch.base} to {moved} during the run; "
        "that commit's own master run regenerates."
    )


def test_master_moved_by_a_bot_commit_gets_the_docs_on_top_of_it(scratch: Scratch) -> None:
    (scratch.src / "docs/api/a.md").write_text("api a, changed\n")
    scratch.pack()
    moved = scratch.land({"docs/architecture/generated/er.mmd": "er, by a bot\n"}, bot=True)

    done = scratch.publish()

    assert done.returncode == 0, done.stderr
    head = scratch.head()
    assert head != moved
    assert git(scratch.origin, "rev-parse", f"{head}^") == moved
    assert git(scratch.origin, "log", "-1", "--format=%ae|%ce", head) == f"{BOT}|{BOT}"
    assert scratch.changed(head) == ["docs/api/a.md"]
    assert scratch.one_line().startswith("Generated docs: pushed")


def test_a_clone_without_the_architecture_directory_receives_the_page(tmp_path: Path) -> None:
    scratch = build(tmp_path, {"docs/api/a.md": "api a\n", "README.md": "readme\n"})
    (scratch.src / "docs/architecture").mkdir()
    (scratch.src / "docs/architecture/decisiones.md").write_text("decisions\n")
    scratch.pack()
    assert not (scratch.work / "docs/architecture").exists()

    done = scratch.publish()

    assert done.returncode == 0, done.stderr
    assert scratch.changed(scratch.head()) == ["docs/architecture/decisiones.md"]


@pytest.mark.parametrize(
    "args",
    [
        [],
        ["--sha"],
        ["--sha", "x", "--tar", "t", "--owned", "o"],
        ["--sha", "x", "--tar", "t", "--owned", "o", "--summary"],
        ["--sha", "x", "--tar", "t", "--owned", "o", "--summary", "s", "--bogus", "1"],
        ["--sha", "", "--tar", "t", "--owned", "o", "--summary", "s"],
        ["positional"],
    ],
)
def test_bad_usage_exits_2_with_the_usage_line_and_no_summary(
    scratch: Scratch, args: Sequence[str]
) -> None:
    done = scratch.run(*args)

    assert done.returncode == 2
    assert done.stderr.strip() == USAGE
    assert scratch.lines() == []
