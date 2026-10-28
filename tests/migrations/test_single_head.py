"""The migrations are one linear chain: "0001", "0002", ... with no gap, no repeat, no
branch and exactly one head. Two parts of an epic that both take the next number, or a
revision that names an older parent, would otherwise surface only when the app starts
(Alembic's "multiple heads" error) or, worse, upgrade silently to one of them.

The rules are checked by `_violations` over an Alembic `ScriptDirectory`. The test over
the real migrations says the chain is sound today; the others build small directories
that break one rule each and say the check refuses them.
"""

from pathlib import Path

from alembic.config import Config
from alembic.script import Script, ScriptDirectory

from app.migrations.runner import MIGRATIONS_ROOT


def _script_directory(location: Path) -> ScriptDirectory:
    config = Config()
    config.set_main_option("script_location", str(location))
    return ScriptDirectory.from_config(config)


def _file_prefix(revision: Script) -> str:
    return Path(revision.path).name.split("_", 1)[0]


def _violations(script: ScriptDirectory) -> list[str]:
    found: list[str] = []
    heads = sorted(script.get_heads())
    bases = sorted(script.get_bases())
    if len(heads) != 1:
        found.append(f"exactly one head is required, found {len(heads)}: {heads}")
    if len(bases) != 1:
        found.append(f"exactly one base is required, found {len(bases)}: {bases}")

    revisions = list(script.walk_revisions())
    for revision in revisions:
        if not isinstance(revision.down_revision, str | None):
            found.append(
                f"revision {revision.revision} has down_revision {revision.down_revision!r}: "
                "a merge is not allowed, the chain is linear"
            )
        if revision.branch_labels:
            found.append(
                f"revision {revision.revision} has branch_labels {revision.branch_labels!r}: "
                "the chain has no named branches"
            )
        if _file_prefix(revision) != revision.revision:
            found.append(
                f"revision {revision.revision} is in file {Path(revision.path).name}: "
                "the id must equal the file's four-digit prefix"
            )

    if len(heads) == 1:
        walked = [revision.revision for revision in script.walk_revisions("base", heads[0])]
        missing = sorted(
            revision.revision for revision in revisions if revision.revision not in walked
        )
        if missing:
            found.append(
                f"walking from the head never reaches {missing}: every revision is on the chain"
            )
        ordered = list(reversed(walked))
        expected = [f"{number:04d}" for number in range(1, len(ordered) + 1)]
        if ordered != expected:
            found.append(
                f"the chain from base to head reads {ordered}, expected {expected}: "
                "numbers run 0001, 0002, ... with no gap and no repeat"
            )
    return found


def _write_revision(
    versions: Path, revision: str, down_revision: str | None, extra: str = ""
) -> None:
    (versions / f"{revision}_change.py").write_text(
        f'"""change"""\n\nrevision = "{revision}"\ndown_revision = {down_revision!r}\n{extra}'
    )


def _directory(
    tmp_path: Path, revisions: list[tuple[str, str | None]], extra: str = ""
) -> ScriptDirectory:
    versions = tmp_path / "versions"
    versions.mkdir()
    for revision, down_revision in revisions:
        _write_revision(versions, revision, down_revision, extra)
    return _script_directory(tmp_path)


def test_the_real_migrations_are_one_linear_chain_with_one_head() -> None:
    assert _violations(_script_directory(MIGRATIONS_ROOT)) == []


def test_a_linear_chain_numbered_from_0001_is_accepted(tmp_path: Path) -> None:
    script = _directory(tmp_path, [("0001", None), ("0002", "0001"), ("0003", "0002")])

    assert _violations(script) == []


def test_two_heads_are_refused_and_named(tmp_path: Path) -> None:
    script = _directory(tmp_path, [("0001", None), ("0002", "0001"), ("0003", "0001")])

    found = _violations(script)

    assert any("exactly one head" in line and "0002" in line and "0003" in line for line in found)


def test_a_merge_revision_is_refused(tmp_path: Path) -> None:
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions, "0001", None)
    _write_revision(versions, "0002", "0001")
    _write_revision(versions, "0003", "0001")
    (versions / "0004_merge.py").write_text(
        '"""merge"""\n\nrevision = "0004"\ndown_revision = ("0002", "0003")\n'
    )

    found = _violations(_script_directory(tmp_path))

    assert any("0004" in line and "merge is not allowed" in line for line in found)


def test_a_branch_label_is_refused(tmp_path: Path) -> None:
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions, "0001", None)
    _write_revision(versions, "0002", "0001", extra='branch_labels = ("extra",)\n')
    script = _script_directory(tmp_path)

    found = _violations(script)

    assert any("0002" in line and "branch_labels" in line for line in found)


def test_a_gap_in_the_numbers_is_refused(tmp_path: Path) -> None:
    script = _directory(tmp_path, [("0001", None), ("0002", "0001"), ("0004", "0002")])

    found = _violations(script)

    assert any("no gap and no repeat" in line and "0004" in line for line in found)


def test_a_revision_id_that_differs_from_its_file_prefix_is_refused(tmp_path: Path) -> None:
    versions = tmp_path / "versions"
    versions.mkdir()
    _write_revision(versions, "0001", None)
    (versions / "0003_wrong_prefix.py").write_text(
        '"""wrong"""\n\nrevision = "0002"\ndown_revision = "0001"\n'
    )

    found = _violations(_script_directory(tmp_path))

    assert any(
        "0002" in line and "0003_wrong_prefix.py" in line and "four-digit prefix" in line
        for line in found
    )
