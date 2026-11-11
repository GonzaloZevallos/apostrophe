"""Every ADR name is well formed and unique (the plan's invariant, GH-52, widened by GH-693).

`docs/adr/` on master once held two files numbered 0012 and two numbered 0013, from
branches merged in parallel. Since GH-693 a new ADR is named `YYYYMMDD-slug.md` and takes no
number, so two branches collide only on an equal slug after the date; the 83 `NNNN-` names
are a closed set (`LEGACY_ADR_NAMES`). `adr_number_problems` and the rules beside it are
pure functions over file names -- the rule they check is about the repository, not the
product, so it lives here rather than under `app/` -- and the real-directory test applies
them to today's `docs/adr/`, reading the filesystem directly so an ADR written but not yet
`git add`-ed is still seen. Every id, citation and supersede-mark pattern lives in
`scripts/docs/adr_ids.py`; this file compiles none.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from scripts.docs.adr_ids import (
    CITATION_PATTERN,
    LEGACY_ADR_NAMES,
    AdrId,
    adr_id_from_file_name,
    adr_id_from_text,
    flatten_citation_text,
)

REPO_ROOT = Path(__file__).resolve().parents[1]


def adr_number_problems(
    names: Iterable[str],
) -> tuple[list[str], dict[str, list[str]]]:
    """Each name that is neither `NNNN-slug.md` nor a dated `YYYYMMDD-slug.md` is malformed.
    Among the well-formed legacy names, each four-digit number held by two or more files is
    a duplicate, mapped to those files, sorted."""
    malformed: list[str] = []
    by_number: dict[str, list[str]] = {}
    for name in names:
        adr_id = adr_id_from_file_name(name)
        if adr_id is None:
            malformed.append(name)
        elif adr_id.kind == "legacy":
            by_number.setdefault(adr_id.key, []).append(name)

    duplicates = {number: sorted(files) for number, files in by_number.items() if len(files) > 1}
    return malformed, duplicates


def dated_slug_collisions(names: Iterable[str]) -> dict[str, list[str]]:
    """Two dated ADRs collide when the slug after the date is equal (`20261111-foo.md` and
    `20261112-foo.md`): each such slug mapped to its files, sorted. A legacy name never
    collides with a dated one. Pure over names; no git."""
    by_slug: dict[str, list[str]] = {}
    for name in names:
        adr_id = adr_id_from_file_name(name)
        if adr_id is not None and adr_id.slug_after_date is not None:
            by_slug.setdefault(adr_id.slug_after_date, []).append(name)
    return {slug: sorted(files) for slug, files in by_slug.items() if len(files) > 1}


def closed_legacy_problems(
    names: Iterable[str], legacy: frozenset[str] = LEGACY_ADR_NAMES
) -> list[str]:
    """One message per `NNNN-` name that is not in the frozen legacy set: a new ADR is dated,
    and a renamed legacy file is not in the set either."""
    problems: list[str] = []
    for name in sorted(names):
        adr_id = adr_id_from_file_name(name)
        if adr_id is not None and adr_id.kind == "legacy" and name not in legacy:
            problems.append(
                f"docs/adr/{name}: a new ADR is named YYYYMMDD-slug.md (ADR-<date>-<slug>); "
                "NNNN- names are closed to the legacy set"
            )
    return problems


def adr_name_problems(names: Iterable[str], legacy: frozenset[str] = LEGACY_ADR_NAMES) -> list[str]:
    """Every name rule at once: malformed names, duplicate legacy numbers, `NNNN-` names
    outside the legacy set, and dated slugs held by two files."""
    listed = list(names)
    malformed, duplicates = adr_number_problems(listed)
    problems = [f"docs/adr/{name}: malformed ADR file name" for name in sorted(malformed)]
    problems += [f"ADR number {n} is held by {files}" for n, files in sorted(duplicates.items())]
    problems += closed_legacy_problems(listed, legacy)
    problems += [
        f"the slug {slug!r} after the date is held by {files}"
        for slug, files in sorted(dated_slug_collisions(listed).items())
    ]
    return problems


def test_two_files_sharing_a_number_are_one_duplicate_group() -> None:
    malformed, duplicates = adr_number_problems(["0012-a.md", "0012-b.md"])

    assert malformed == []
    assert duplicates == {"0012": ["0012-a.md", "0012-b.md"]}


def test_each_malformed_name_is_reported() -> None:
    names = ["0012_a.md", "12-a.md", "0012-A.md", "README.md", "0012-a.txt", "20261399-x.md"]

    malformed, duplicates = adr_number_problems(names)

    assert sorted(malformed) == sorted(names)
    assert duplicates == {}


def test_a_clean_set_has_no_problems() -> None:
    malformed, duplicates = adr_number_problems(["0001-a.md", "0002-b.md"])

    assert malformed == []
    assert duplicates == {}


def test_a_dated_name_is_well_formed_and_never_a_duplicate_of_a_legacy_number() -> None:
    names = ["0012-a.md", "20261111-a.md", "20261111-b.md", "20261112-c.md"]

    assert adr_number_problems(names) == ([], {})


def test_two_dated_names_with_an_equal_slug_collide_on_any_two_dates() -> None:
    names = ["20261111-foo.md", "20261112-foo.md", "20261111-bar.md", "0001-foo.md"]

    assert dated_slug_collisions(names) == {"foo": ["20261111-foo.md", "20261112-foo.md"]}
    assert dated_slug_collisions(["20261111-foo.md", "20261111-foo-bar.md", "0001-foo.md"]) == {}


def test_a_dated_slug_taken_on_another_day_is_reported_with_both_files() -> None:
    problems = adr_name_problems(["20261111-foo.md", "20261112-foo.md"], frozenset())

    assert problems == [
        "the slug 'foo' after the date is held by ['20261111-foo.md', '20261112-foo.md']"
    ]


def test_a_new_legacy_shaped_name_is_refused_with_the_fix() -> None:
    problems = adr_name_problems(["0001-a.md", "0085-x.md"], frozenset({"0001-a.md"}))

    assert problems == [
        "docs/adr/0085-x.md: a new ADR is named YYYYMMDD-slug.md (ADR-<date>-<slug>); "
        "NNNN- names are closed to the legacy set"
    ]


def test_a_renamed_legacy_file_is_not_in_the_set_so_it_fails() -> None:
    problems = closed_legacy_problems(["0001-renamed.md"], frozenset({"0001-a.md"}))

    assert len(problems) == 1
    assert "0001-renamed.md" in problems[0]


def test_a_malformed_name_is_reported_as_malformed() -> None:
    assert adr_name_problems(["20261399-x.md"], frozenset()) == [
        "docs/adr/20261399-x.md: malformed ADR file name"
    ]


def test_a_duplicate_legacy_number_is_still_reported() -> None:
    legacy = frozenset({"0012-a.md", "0012-b.md"})

    assert adr_name_problems(["0012-a.md", "0012-b.md"], legacy) == [
        "ADR number 0012 is held by ['0012-a.md', '0012-b.md']"
    ]


def test_old_and_new_names_are_accepted_together() -> None:
    legacy = frozenset({"0001-a.md"})

    assert adr_name_problems(["0001-a.md", "20261111-b.md"], legacy) == []


def test_every_real_adr_has_a_unique_well_formed_name() -> None:
    adr_dir = REPO_ROOT / "docs" / "adr"
    names = [path.name for path in sorted(adr_dir.glob("*.md"))]

    # Proof the scan actually found the real directory, not an empty or wrong one --
    # otherwise the assertion below would pass vacuously.
    assert len(names) >= 20, f"expected at least 20 ADRs under {adr_dir}, found {len(names)}"

    problems = adr_name_problems(names)

    assert not problems, "docs/adr/ has name problems:\n" + "\n".join(problems)


def test_the_legacy_set_is_closed_and_every_member_still_exists() -> None:
    names = {path.name for path in (REPO_ROOT / "docs" / "adr").glob("*.md")}

    assert len(LEGACY_ADR_NAMES) == 83, (
        "LEGACY_ADR_NAMES is closed: name a new ADR YYYYMMDD-slug.md, never add to the set"
    )
    assert sorted(LEGACY_ADR_NAMES - names) == [], "a legacy ADR file is missing or renamed"


# --- citations ----------------------------------------------------------------------
#
# A citation names an ADR by id (`ADR-0027`, `ADR-20261111-slug`) or by path (`docs/adr/0027`,
# the full `docs/adr/0027-<slug>.md`, `docs/adr/20261111-slug.md`). `adr_citation_problems`
# checks each against the files that exist, so a renamed or misspelled ADR cannot stay cited
# by its old name.

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
    problem found: an id matching no ADR file in `names`, a legacy full path whose slug
    differs from that file's, or a dated-looking citation that is no id. A dated citation
    names the full stem of a file. Runs of whitespace collapse to one space first, so a
    citation wrapped across lines is still found."""
    file_by_id: dict[AdrId, str] = {}
    for name in names:
        adr_id = adr_id_from_file_name(name)
        if adr_id is not None:
            file_by_id[adr_id] = name
    checked = 0
    problems: list[str] = []
    for label, text in sorted(texts.items()):
        flat = flatten_citation_text(text)
        for match in CITATION_PATTERN.finditer(flat):
            before = flat[: match.start()]
            if before.endswith(FOREIGN_ADR_PREFIXES):
                continue
            checked += 1
            if match["bad"] is not None:
                problems.append(
                    f"{label}: {match.group(0)} is not an ADR id "
                    "(a dated id is YYYYMMDD-slug, in lower case)"
                )
                continue
            cited = adr_id_from_text(match["id"])
            if cited is None or cited not in file_by_id:
                problems.append(f"{label}: {match.group(0)} names no ADR file")
            elif cited.kind == "legacy" and match["slug"] is not None:
                file_name = file_by_id[cited]
                if f"{match['slug']}.md" != file_name[4:]:
                    problems.append(
                        f"{label}: {match.group(0)} has the wrong slug; the file is {file_name}"
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


def test_a_dated_citation_resolves_when_its_id_equals_a_file_stem() -> None:
    names = [*_ADRS, "20261111-x.md"]
    texts = {"x.md": "ADR-20261111-x, docs/adr/20261111-x.md and docs/adr/20261111-x."}

    assert adr_citation_problems(texts, names) == (3, [])


def test_a_dated_citation_that_is_only_a_prefix_is_dangling() -> None:
    names = [*_ADRS, "20261111-x.md"]

    assert adr_citation_problems({"x.md": "ADR-20261111-x-style"}, names) == (
        1,
        ["x.md: ADR-20261111-x-style names no ADR file"],
    )


def test_a_dated_path_with_a_longer_extension_is_reported() -> None:
    names = [*_ADRS, "20261111-x.md"]

    assert adr_citation_problems({"x.md": "docs/adr/20261111-x.mdx"}, names) == (
        1,
        ["x.md: docs/adr/20261111-x is not an ADR id (a dated id is YYYYMMDD-slug, in lower case)"],
    )


def test_a_dated_citation_with_another_date_is_dangling() -> None:
    names = [*_ADRS, "20261111-x.md"]

    assert adr_citation_problems({"x.md": "ADR-20261112-x"}, names) == (
        1,
        ["x.md: ADR-20261112-x names no ADR file"],
    )


def test_an_uppercase_dated_citation_is_reported() -> None:
    checked, problems = adr_citation_problems({"x.md": "ADR-20261111-X"}, ["20261111-x.md"])

    assert checked == 1
    assert problems == [
        "x.md: ADR-20261111-X is not an ADR id (a dated id is YYYYMMDD-slug, in lower case)"
    ]


def test_the_issue_example_is_checked_against_its_file() -> None:
    names = ["20261111-phone-country-per-number.md"]
    text = "ADR-20261111-phone-country-per-number"

    assert adr_citation_problems({"x.md": text}, names) == (1, [])
    assert adr_citation_problems({"x.md": text}, []) == (
        1,
        ["x.md: ADR-20261111-phone-country-per-number names no ADR file"],
    )


def test_a_legacy_number_with_a_digit_glued_on_is_no_citation() -> None:
    assert adr_citation_problems({"x.md": "ADR-00271"}, _ADRS) == (0, [])


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
    # And against a pass that never saw the new form: the ADR that introduced it cites itself.
    dated = [
        match.group(0)
        for text in texts.values()
        for match in CITATION_PATTERN.finditer(flatten_citation_text(text))
        if (cited := adr_id_from_text(match["id"] or "")) is not None and cited.kind == "dated"
    ]
    assert dated, "no dated citation was checked; the dated form is not being read"
    assert not problems, "stale ADR citations:\n" + "\n".join(problems)
