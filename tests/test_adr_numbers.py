"""Every ADR number is unique (the plan's invariant, GH-52): `docs/adr/` on master once
held two files numbered 0012 and two numbered 0013, from branches merged in parallel.
`adr_number_problems` is a pure function over file names -- the rule it checks is about
the repository, not the product, so it lives here rather than under `app/` -- and the
real-directory test below applies it to today's `docs/adr/`, reading the filesystem
directly so an ADR written but not yet `git add`-ed is still seen.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# `[0-9]` rather than `\d`: `\d` also matches non-ASCII decimal digits, which must not
# pass for a four-digit ADR number.
_NAME_PATTERN = re.compile(r"^[0-9]{4}-[a-z0-9-]+\.md$")


def adr_number_problems(
    names: Iterable[str],
) -> tuple[list[str], dict[str, list[str]]]:
    """Each name not matching `_NAME_PATTERN` is malformed. Among the well-formed
    names, each four-digit number held by two or more files is a duplicate, mapped to
    those files, sorted."""
    malformed: list[str] = []
    by_number: dict[str, list[str]] = {}
    for name in names:
        if not _NAME_PATTERN.match(name):
            malformed.append(name)
            continue
        number = name[:4]
        by_number.setdefault(number, []).append(name)

    duplicates = {number: sorted(files) for number, files in by_number.items() if len(files) > 1}
    return malformed, duplicates


def test_two_files_sharing_a_number_are_one_duplicate_group() -> None:
    malformed, duplicates = adr_number_problems(["0012-a.md", "0012-b.md"])

    assert malformed == []
    assert duplicates == {"0012": ["0012-a.md", "0012-b.md"]}


def test_each_malformed_name_is_reported() -> None:
    names = ["0012_a.md", "12-a.md", "0012-A.md", "README.md", "0012-a.txt"]

    malformed, duplicates = adr_number_problems(names)

    assert sorted(malformed) == sorted(names)
    assert duplicates == {}


def test_a_clean_set_has_no_problems() -> None:
    malformed, duplicates = adr_number_problems(["0001-a.md", "0002-b.md"])

    assert malformed == []
    assert duplicates == {}


def test_every_real_adr_has_a_unique_well_formed_number() -> None:
    adr_dir = REPO_ROOT / "docs" / "adr"
    names = [path.name for path in sorted(adr_dir.glob("*.md"))]

    # Proof the scan actually found the real directory, not an empty or wrong one --
    # otherwise the assertion below would pass vacuously.
    assert len(names) >= 20, f"expected at least 20 ADRs under {adr_dir}, found {len(names)}"

    malformed, duplicates = adr_number_problems(names)

    offenders = sorted({*malformed, *(f for files in duplicates.values() for f in files)})
    assert not offenders, (
        "docs/adr/ has malformed names or duplicate numbers: "
        f"malformed={malformed}, duplicates={duplicates}, offenders={offenders}"
    )
