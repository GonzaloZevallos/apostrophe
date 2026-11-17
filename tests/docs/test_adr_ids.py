"""The ADR-id parser (GH-693), pure: file names, citations and supersede marks read through
`scripts/docs/adr_ids.py`, the only module that holds an ADR-id pattern."""

from __future__ import annotations

from scripts.docs.adr_ids import (
    CITATION_PATTERN,
    LEGACY_ADR_NAMES,
    AdrId,
    adr_id_from_file_name,
    adr_id_from_text,
    flatten_citation_text,
    superseded_by,
)
from scripts.docs.adr_ids import SUPERSEDED_MARK as MARK


def _cited(text: str) -> list[str | None]:
    """The id each citation of `text` names; None where the citation is malformed."""
    return [m["id"] for m in CITATION_PATTERN.finditer(flatten_citation_text(text))]


def test_a_legacy_and_a_dated_name_read_as_their_kind() -> None:
    assert adr_id_from_file_name("0027-a.md") == AdrId("legacy", "0027")
    assert adr_id_from_file_name("20261111-x.md") == AdrId("dated", "20261111-x")
    assert adr_id_from_file_name("20261111-a-b-2.md") == AdrId("dated", "20261111-a-b-2")


def test_the_slug_after_the_date_is_what_collides() -> None:
    assert AdrId("dated", "20261111-foo").slug_after_date == "foo"
    assert AdrId("dated", "20261112-foo-bar").slug_after_date == "foo-bar"
    assert AdrId("legacy", "0027").slug_after_date is None


def test_every_other_name_is_none() -> None:
    names = [
        "README.md",
        "0027_a.md",
        "27-a.md",
        "0027-A.md",
        "0027-a.txt",
        "20261111.md",
        "20261111-.md",
        "20261111-X.md",
        "20261111--x.md",
        "2026111-x.md",
        "202611111-x.md",
    ]

    assert [adr_id_from_file_name(name) for name in names] == [None] * len(names)


def test_a_dated_name_with_an_impossible_date_is_malformed() -> None:
    assert adr_id_from_file_name("20261399-x.md") is None
    assert adr_id_from_file_name("20260230-x.md") is None
    assert adr_id_from_file_name("20240229-x.md") == AdrId("dated", "20240229-x")


def test_a_date_in_the_far_future_is_still_a_name() -> None:
    assert adr_id_from_file_name("29991231-x.md") is not None


def test_a_dated_id_is_read_whole_and_never_as_its_year() -> None:
    assert _cited("ADR-20261111-x") == ["20261111-x"]
    assert _cited("ADR-2026111") == []
    assert _cited("ADR-00271") == []


def test_the_issue_example_resolves_against_its_file_name() -> None:
    cited = _cited("see ADR-20261111-phone-country-per-number")
    file_id = adr_id_from_file_name("20261111-phone-country-per-number.md")

    assert file_id is not None
    assert [adr_id_from_text(text) for text in cited if text] == [file_id]


def test_a_dated_id_followed_by_punctuation_or_the_end_resolves() -> None:
    for tail in [".", ",", ";", ")", "`", ""]:
        assert _cited(f"(ADR-20261111-x{tail}") == ["20261111-x"], tail


def test_a_path_with_the_extension_resolves_and_one_with_a_longer_extension_does_not() -> None:
    (found,) = CITATION_PATTERN.finditer("docs/adr/20261111-x.md")
    assert (found["id"], found["ext"]) == ("20261111-x", ".md")

    (bare,) = CITATION_PATTERN.finditer("docs/adr/20261111-x")
    assert (bare["id"], bare["ext"]) == ("20261111-x", None)

    (longer,) = CITATION_PATTERN.finditer("docs/adr/20261111-x.mdx")
    assert longer["id"] is None
    assert longer["bad"] == "20261111-x"


def test_a_legacy_path_carries_its_slug() -> None:
    (found,) = CITATION_PATTERN.finditer("docs/adr/0027-a-sheet.md")

    assert (found["id"], found["slug"]) == ("0027", "-a-sheet")
    assert _cited("docs/adr/\n0027 and ADR-\n20261111-x") == ["0027", "20261111-x"]


def test_a_citation_names_the_full_stem_so_a_longer_one_is_another_id() -> None:
    assert _cited("ADR-20261111-x-style") == ["20261111-x-style"]


def test_a_trailing_hyphen_is_not_part_of_the_id() -> None:
    assert _cited("ADR-20261111-x- is it") == ["20261111-x"]


def test_an_uppercase_dated_id_is_a_non_id_and_is_reported() -> None:
    (found,) = CITATION_PATTERN.finditer("ADR-20261111-X")

    assert found["id"] is None
    assert found["bad"] == "20261111-X"
    (glued,) = CITATION_PATTERN.finditer("ADR-20261111-fooBar")
    assert glued["id"] is None
    assert glued["bad"] == "20261111-fooBar"


def test_a_date_with_no_slug_is_reported_not_skipped() -> None:
    (found,) = CITATION_PATTERN.finditer("ADR-20261111")

    assert found["bad"] == "20261111"


def test_text_that_only_describes_the_naming_is_no_citation() -> None:
    assert _cited("ADR-AAAAMMDD-slug, docs/adr/AAAAMMDD-slug.md and docs/adr/NNNN-slug.md") == []


def test_a_dated_id_in_a_supersede_mark_is_read_whole() -> None:
    found = MARK.search("| reemplazada por 20261111-x-y |")

    assert found is not None
    assert found.group(1) == "20261111-x-y"
    legacy = MARK.search("reemplazada por 0033")
    assert legacy is not None
    assert legacy.group(1) == "0033"
    assert MARK.search("reemplazada por 00331") is None


def test_the_status_line_gives_the_id_it_is_superseded_by() -> None:
    assert superseded_by("superseded by 0033") == "0033"
    assert superseded_by("superseded by 20261111-x") == "20261111-x"
    assert superseded_by("accepted") is None
    assert superseded_by(None) is None


def test_ids_from_text_keep_their_kind() -> None:
    assert adr_id_from_text("0027") == AdrId("legacy", "0027")
    assert adr_id_from_text("20261111-x") == AdrId("dated", "20261111-x")
    assert adr_id_from_text("2026") == AdrId("legacy", "2026")
    assert adr_id_from_text("20261111") is None


def test_the_legacy_set_is_closed_and_every_member_is_a_legacy_name() -> None:
    assert len(LEGACY_ADR_NAMES) == 83
    assert all(
        (adr_id_from_file_name(name) or AdrId("dated", "")).kind == "legacy"
        for name in LEGACY_ADR_NAMES
    )
