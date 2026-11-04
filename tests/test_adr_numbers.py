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


# --- citations ----------------------------------------------------------------------
#
# A citation names an ADR by number (`ADR-0027`) or by path (`docs/adr/0027` or the full
# `docs/adr/0027-<slug>.md`). `adr_citation_problems` checks each against the files that
# exist, so a renumbered or misspelled ADR cannot stay cited by its old name.

_CITATION_PATTERN = re.compile(r"(?:docs/adr/|ADR-)([0-9]{4})(-[a-z0-9-]+\.md)?")

# After whitespace collapses, a line break between a prefix and its number is one space.
_JOINED_PREFIX = re.compile(r"(docs/adr/|ADR-) (?=[0-9]{4})")

# The agentic development system has ADRs of its own, numbered separately; a citation
# preceded by one of these names that system's record, not this repository's.
FOREIGN_ADR_PREFIXES = (
    "agentic-system, ",
    "agentic-system ",
    "agentic system's ",
    "agentic system, ",
)

# Records of their day: they cite ADRs by the numbers those had then, and are never
# edited to satisfy this check.
HISTORICAL_DIRS = ("docs/evidence/", "docs/agents/")

_CITING_FILES = ("CONTEXT.md", "CODING_STANDARDS.md", "DESIGN_STANDARDS.md")


def adr_citation_problems(texts: dict[str, str], names: Iterable[str]) -> tuple[int, list[str]]:
    """The number of citations checked in `texts` (file label -> content), and each
    problem found: a number matching no ADR file in `names`, or a full path whose slug
    differs from that file's. Runs of whitespace collapse to one space first, so a
    citation wrapped across lines is still found (a break after `ADR-` or `docs/adr/`
    is closed up)."""
    slug_by_number = {name[:4]: name[4:] for name in names if _NAME_PATTERN.match(name)}
    checked = 0
    problems: list[str] = []
    for label, text in sorted(texts.items()):
        flat = _JOINED_PREFIX.sub(r"\1", " ".join(text.split()))
        for match in _CITATION_PATTERN.finditer(flat):
            before = flat[: match.start()]
            if before.endswith(FOREIGN_ADR_PREFIXES):
                continue
            checked += 1
            number, slug = match.group(1), match.group(2)
            if number not in slug_by_number:
                problems.append(f"{label}: {match.group(0)} names no ADR file")
            elif slug is not None and slug != slug_by_number[number]:
                problems.append(
                    f"{label}: {match.group(0)} has the wrong slug; "
                    f"the file is {number}{slug_by_number[number]}"
                )
    return checked, problems


_ADRS = ["0027-a.md", "0028-b.md", "0029-c.md", "0048-d.md"]


def test_a_slugless_path_closed_by_a_parenthesis_or_a_comma_resolves() -> None:
    texts = {"x.md": "(see docs/adr/0027) and docs/adr/0028, then more"}

    assert adr_citation_problems(texts, _ADRS) == (2, [])


def test_a_list_of_bare_numbers_is_each_checked() -> None:
    texts = {"x.md": "ADR-0027, ADR-0028, ADR-0029 or ADR-0048"}

    assert adr_citation_problems(texts, _ADRS) == (4, [])


def test_a_citation_split_across_a_newline_is_found() -> None:
    texts = {"x.md": "see docs/adr/\n0027 and ADR-\n0028"}

    assert adr_citation_problems(texts, _ADRS) == (2, [])


def test_a_wrapped_dangling_citation_is_reported() -> None:
    texts = {"x.md": "the decision in docs/adr/\n0099 holds"}

    assert adr_citation_problems(texts, _ADRS) == (1, ["x.md: docs/adr/0099 names no ADR file"])


def test_a_full_path_with_the_wrong_slug_fails() -> None:
    texts = {"x.md": "docs/adr/0027-wrong.md"}

    checked, problems = adr_citation_problems(texts, _ADRS)

    assert checked == 1
    assert len(problems) == 1
    assert "wrong slug" in problems[0]
    assert "0027-a.md" in problems[0]


def test_a_full_path_with_the_right_slug_resolves() -> None:
    assert adr_citation_problems({"x.md": "docs/adr/0027-a.md"}, _ADRS) == (1, [])


def test_a_dangling_bare_number_fails() -> None:
    checked, problems = adr_citation_problems({"x.md": "per ADR-0099"}, _ADRS)

    assert checked == 1
    assert problems == ["x.md: ADR-0099 names no ADR file"]


def test_a_dangling_slugless_path_fails() -> None:
    checked, problems = adr_citation_problems({"x.md": "per docs/adr/0099."}, _ADRS)

    assert checked == 1
    assert problems == ["x.md: docs/adr/0099 names no ADR file"]


def test_the_foreign_prefix_is_skipped_even_when_wrapped_across_a_line() -> None:
    texts = {"x.md": "the agentic-system,\nADR-0099 and the agentic system's\nADR-0098"}

    assert adr_citation_problems(texts, _ADRS) == (0, [])


def test_a_clean_set_of_citations_has_no_problems() -> None:
    texts = {"a.md": "ADR-0027", "b.md": "docs/adr/0028-b.md"}

    assert adr_citation_problems(texts, _ADRS) == (2, [])


def test_every_citation_in_the_real_docs_resolves() -> None:
    names = [path.name for path in sorted((REPO_ROOT / "docs" / "adr").glob("*.md"))]
    paths = [REPO_ROOT / name for name in _CITING_FILES]
    paths += [
        path
        for path in sorted((REPO_ROOT / "docs").rglob("*.md"))
        if not path.relative_to(REPO_ROOT).as_posix().startswith(HISTORICAL_DIRS)
    ]
    texts = {
        path.relative_to(REPO_ROOT).as_posix(): path.read_text(encoding="utf-8") for path in paths
    }

    checked, problems = adr_citation_problems(texts, names)

    # Guard against a vacuous pass: the tree held about 400 citations when this was written.
    assert checked >= 40, f"only {checked} citations found; the scan is looking in the wrong place"
    assert not problems, "stale ADR citations:\n" + "\n".join(problems)
