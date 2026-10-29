"""The migrations form one linear chain with exactly one head.

Two branches that each add a revision on top of the same parent leave Alembic with two
heads, and `upgrade head` then refuses to run. Nothing in the other migration tests
notices until the merge, so this one reads the chain itself.

The rules are pure functions over a versions directory: the file listing (read as syntax,
never imported) and Alembic's `ScriptDirectory`. No engine, no connection, no hard-coded
revision id or revision count -- the chain may grow; its shape may not change. Fixture
chains written under `tmp_path` show each rule failing by its own name.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

from app.migrations.runner import MIGRATIONS_ROOT


@dataclass(frozen=True)
class RevisionFile:
    name: str
    revision: str | None
    down_revision: str | tuple[str, ...] | None


def _literal(node: ast.expr) -> str | tuple[str, ...] | None:
    if isinstance(node, ast.Constant) and (node.value is None or isinstance(node.value, str)):
        return node.value
    if isinstance(node, ast.Tuple | ast.List):
        return tuple(
            element.value
            for element in node.elts
            if isinstance(element, ast.Constant) and isinstance(element.value, str)
        )
    return None


def read_revision_files(versions: Path) -> list[RevisionFile]:
    """Each `versions/*.py` but `__init__.py`, with the `revision` and `down_revision` it
    assigns at module level, read from its syntax tree."""
    files: list[RevisionFile] = []
    for path in sorted(versions.glob("*.py")):
        if path.name == "__init__.py":
            continue
        assigned: dict[str, str | tuple[str, ...] | None] = {}
        for node in ast.parse(path.read_text(encoding="utf-8")).body:
            if isinstance(node, ast.AnnAssign) and node.value is not None:
                targets: list[ast.expr] = [node.target]
                value = node.value
            elif isinstance(node, ast.Assign):
                targets, value = node.targets, node.value
            else:
                continue
            for target in targets:
                if isinstance(target, ast.Name) and target.id in ("revision", "down_revision"):
                    assigned[target.id] = _literal(value)
        revision = assigned.get("revision")
        down = assigned.get("down_revision")
        files.append(
            RevisionFile(
                name=path.name,
                revision=revision if isinstance(revision, str) else None,
                down_revision=down,
            )
        )
    return files


def file_problems(files: list[RevisionFile]) -> list[str]:
    """What the file listing alone shows wrong, each as a named rule."""
    problems: list[str] = []
    by_revision: dict[str, list[str]] = {}
    for file in files:
        if file.revision is None:
            problems.append(f"{file.name}: no string `revision`")
            continue
        by_revision.setdefault(file.revision, []).append(file.name)
        if file.name[:4] != file.revision:
            problems.append(
                f"{file.name}: revision {file.revision!r} differs from the filename prefix "
                f"{file.name[:4]!r}"
            )
    for revision, names in sorted(by_revision.items()):
        if len(names) > 1:
            problems.append(f"revision {revision!r} is declared by two files: {sorted(names)}")
    for file in files:
        if file.revision is None:
            continue
        if isinstance(file.down_revision, tuple):
            problems.append(f"{file.name}: down_revision is a tuple (a merge migration)")
        elif file.down_revision is not None and file.down_revision not in by_revision:
            problems.append(
                f"down_revision of {file.revision} names no revision: {file.down_revision!r}"
            )
    return problems


def graph_problems(versions: Path, file_count: int) -> list[str]:
    """What Alembic's own graph shows wrong. Only meaningful when `file_problems` is empty."""
    config = Config()
    config.set_main_option("script_location", str(versions.parent))
    script = ScriptDirectory.from_config(config)

    problems: list[str] = []
    heads = sorted(script.get_heads())
    bases = sorted(script.get_bases())
    if len(heads) != 1:
        problems.append(f"expected exactly one head, found {len(heads)}: {heads}")
    if len(bases) != 1:
        problems.append(f"expected exactly one base, found {len(bases)}: {bases}")
    if problems:
        return problems

    walked: list[str] = []
    current: str | None = heads[0]
    while current is not None and current not in walked:
        walked.append(current)
        revision = script.get_revision(current)
        parent = revision.down_revision if revision is not None else None
        current = parent if isinstance(parent, str) else None
    if walked[-1] != bases[0]:
        problems.append(f"the walk from head {heads[0]} stops at {walked[-1]}, not at the base")
    if len(walked) != file_count:
        problems.append(
            f"the walk from the head visits {len(walked)} revisions, "
            f"but the versions directory has {file_count} files"
        )
    return problems


def chain_problems(versions: Path) -> list[str]:
    files = read_revision_files(versions)
    problems = file_problems(files)
    if problems:
        return problems
    return graph_problems(versions, len(files))


# --- the real tree ------------------------------------------------------------------


def test_the_real_migrations_form_one_linear_chain_with_one_head() -> None:
    versions = MIGRATIONS_ROOT / "versions"

    # The scan found the real directory; otherwise every rule above would pass vacuously.
    assert read_revision_files(versions), f"no revision files under {versions}"
    assert chain_problems(versions) == []


# --- fixture chains -----------------------------------------------------------------


def _write(versions: Path, name: str, revision: str, down: str | None | tuple[str, ...]) -> None:
    versions.mkdir(parents=True, exist_ok=True)
    (versions / name).write_text(
        f'revision: str = "{revision}"\n'
        f"down_revision: object = {down!r}\n"
        "branch_labels = None\n"
        "depends_on = None\n\n\n"
        "def upgrade() -> None:\n    pass\n\n\n"
        "def downgrade() -> None:\n    pass\n",
        encoding="utf-8",
    )


def _two_revisions(tmp_path: Path) -> Path:
    versions = tmp_path / "versions"
    _write(versions, "0001_first.py", "0001", None)
    _write(versions, "0002_second.py", "0002", "0001")
    return versions


def test_a_clean_two_revision_chain_passes(tmp_path: Path) -> None:
    assert chain_problems(_two_revisions(tmp_path)) == []


def test_two_heads_fail(tmp_path: Path) -> None:
    versions = _two_revisions(tmp_path)
    _write(versions, "0003_third.py", "0003", "0001")

    problems = chain_problems(versions)

    assert len(problems) == 1
    assert "exactly one head, found 2" in problems[0]


def test_a_tuple_down_revision_fails(tmp_path: Path) -> None:
    versions = _two_revisions(tmp_path)
    _write(versions, "0003_third.py", "0003", ("0002", "0001"))

    problems = chain_problems(versions)

    assert any("0003_third.py: down_revision is a tuple" in p for p in problems)


def test_a_missing_parent_fails(tmp_path: Path) -> None:
    versions = _two_revisions(tmp_path)
    _write(versions, "0003_third.py", "0003", "0009")

    problems = chain_problems(versions)

    assert problems == ["down_revision of 0003 names no revision: '0009'"]


def test_two_files_with_the_same_revision_fail(tmp_path: Path) -> None:
    versions = _two_revisions(tmp_path)
    _write(versions, "0002_other.py", "0002", "0001")

    problems = chain_problems(versions)

    assert any("revision '0002' is declared by two files" in p for p in problems)


def test_a_filename_prefix_differing_from_the_revision_fails(tmp_path: Path) -> None:
    versions = _two_revisions(tmp_path)
    _write(versions, "0003_third.py", "0004", "0002")

    problems = chain_problems(versions)

    assert any(
        "0003_third.py: revision '0004' differs from the filename prefix" in p for p in problems
    )
