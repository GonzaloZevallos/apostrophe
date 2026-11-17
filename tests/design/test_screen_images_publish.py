"""The publish script of the master screen-images workflow (docs/product/screen-images.md): what it
commits, what it refuses and when it does not push, run as a command against a bare remote."""

import subprocess
from dataclasses import dataclass
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "design" / "screen-images-publish.sh"
MESSAGE = "chore(screens): update images [skip ci]"
SCREENS = "docs/assets/screens"


def git(cwd: Path, *args: str) -> str:
    done = subprocess.run(
        ["git", "-c", "user.name=Dev", "-c", "user.email=dev@example.com", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=True,
    )
    return done.stdout.strip()


@dataclass
class Repo:
    origin: Path
    work: Path
    sha: str
    summary: Path

    def run(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(SCRIPT), *args], cwd=self.work, capture_output=True, text=True, check=False
        )

    def publish(self) -> subprocess.CompletedProcess[str]:
        return self.run("--sha", self.sha, "--summary", str(self.summary))

    def origin_head(self) -> str:
        return git(self.origin, "rev-parse", "master")

    def summary_text(self) -> str:
        return self.summary.read_text() if self.summary.exists() else ""


@pytest.fixture
def repo(tmp_path: Path) -> Repo:
    origin = tmp_path / "origin.git"
    subprocess.run(["git", "init", "-q", "--bare", "-b", "master", str(origin)], check=True)
    work = tmp_path / "work"
    subprocess.run(["git", "clone", "-q", str(origin), str(work)], check=True)
    git(work, "checkout", "-q", "-b", "master")
    (work / SCREENS).mkdir(parents=True)
    (work / SCREENS / "a.webp").write_bytes(b"first")
    git(work, "add", "-A")
    git(work, "commit", "-q", "-m", "images")
    git(work, "push", "-q", "origin", "master")
    return Repo(origin, work, git(work, "rev-parse", "HEAD"), tmp_path / "summary.md")


def test_nothing_changed_commits_nothing_and_says_so(repo: Repo) -> None:
    done = repo.publish()
    assert done.returncode == 0, done.stderr
    assert git(repo.work, "rev-parse", "HEAD") == repo.sha
    assert repo.origin_head() == repo.sha
    assert "no image changed" in repo.summary_text()


def test_a_stray_file_outside_the_images_fails_and_is_named(repo: Repo) -> None:
    (repo.work / SCREENS / "a.webp").write_bytes(b"second")
    (repo.work / "stray.txt").write_text("x")
    done = repo.publish()
    assert done.returncode != 0
    assert "stray.txt" in done.stderr
    assert git(repo.work, "rev-parse", "HEAD") == repo.sha
    assert repo.origin_head() == repo.sha


def test_a_path_that_only_contains_the_images_folder_is_stray(repo: Repo) -> None:
    nested = repo.work / "web" / SCREENS
    nested.mkdir(parents=True)
    (nested / "x.webp").write_bytes(b"x")
    done = repo.publish()
    assert done.returncode != 0
    assert f"web/{SCREENS}/x.webp" in done.stderr


def test_a_modified_tracked_file_outside_the_images_fails(repo: Repo) -> None:
    (repo.work / "README.md").write_text("one")
    git(repo.work, "add", "README.md")
    git(repo.work, "commit", "-q", "-m", "readme")
    git(repo.work, "push", "-q", "origin", "master")
    sha = git(repo.work, "rev-parse", "HEAD")
    (repo.work / "README.md").write_text("two")
    done = repo.run("--sha", sha, "--summary", str(repo.summary))
    assert done.returncode != 0
    assert "README.md" in done.stderr
    assert git(repo.work, "rev-parse", "HEAD") == sha


def test_origin_moved_during_the_run_does_not_push_and_says_why(repo: Repo, tmp_path: Path) -> None:
    other = tmp_path / "other"
    subprocess.run(["git", "clone", "-q", str(repo.origin), str(other)], check=True)
    (other / "later.txt").write_text("later")
    git(other, "add", "-A")
    git(other, "commit", "-q", "-m", "later")
    git(other, "push", "-q", "origin", "master")
    moved = git(other, "rev-parse", "HEAD")
    (repo.work / SCREENS / "a.webp").write_bytes(b"second")
    done = repo.publish()
    assert done.returncode == 0, done.stderr
    assert repo.origin_head() == moved
    text = repo.summary_text()
    assert f"master moved from {repo.sha} to {moved} during the run" in text
    assert "the next master run updates the images" in text


def test_a_changed_image_lands_as_one_bot_commit_touching_only_the_images(repo: Repo) -> None:
    (repo.work / SCREENS / "a.webp").write_bytes(b"second")
    (repo.work / SCREENS / "b.webp").write_bytes(b"new")
    done = repo.publish()
    assert done.returncode == 0, done.stderr
    head = repo.origin_head()
    assert git(repo.origin, "rev-list", "--count", f"{repo.sha}..{head}") == "1"
    assert git(repo.origin, "log", "-1", "--format=%s", head) == MESSAGE
    assert git(repo.origin, "log", "-1", "--format=%an", head) == "github-actions[bot]"
    changed = git(repo.origin, "diff", "--name-only", repo.sha, head).splitlines()
    assert sorted(changed) == [f"{SCREENS}/a.webp", f"{SCREENS}/b.webp"]
    assert head in repo.summary_text()


@pytest.mark.parametrize(
    "args",
    [
        [],
        ["--sha", "abc"],
        ["--summary", "s.md"],
        ["--sha", "abc", "--summary", "s.md", "--bogus"],
    ],
)
def test_bad_usage_exits_two(repo: Repo, args: list[str]) -> None:
    done = repo.run(*args)
    assert done.returncode == 2
    assert "usage" in done.stderr
