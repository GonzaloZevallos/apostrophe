"""`header_footer_text` and `CatalogHeaderFooter.of` (CODING_STANDARDS section 5:
domain unit test, no infrastructure)."""

import pytest

from app.catalog.domain.errors import FooterTooLong, HeaderTooLong
from app.catalog.domain.header_footer import CatalogHeaderFooter, header_footer_text


def test_crlf_and_lone_cr_become_lf() -> None:
    assert header_footer_text("a\r\nb\rc") == "a\nb\nc"


def test_leading_and_trailing_blank_and_whitespace_only_lines_are_dropped() -> None:
    assert header_footer_text("\n   \nhello\nworld\n\t\n") == "hello\nworld"


def test_an_indented_first_line_keeps_its_indentation() -> None:
    assert header_footer_text("  hello\nworld") == "  hello\nworld"


def test_an_inner_blank_line_is_kept() -> None:
    assert header_footer_text("a\n\nb") == "a\n\nb"


def test_whitespace_only_input_becomes_empty() -> None:
    assert header_footer_text("  \n\t\n  ") == ""


def test_exactly_500_code_points_is_accepted() -> None:
    value = "\U0001f33f" * 500

    header_footer = CatalogHeaderFooter.of(value, "footer")

    assert len(header_footer.header) == 500


def test_501_code_points_is_refused_in_the_header() -> None:
    """The enforcement artefact: `CatalogHeaderFooter.of` rejects a header one code
    point over the limit, with the header's own code."""
    with pytest.raises(HeaderTooLong):
        CatalogHeaderFooter.of("\U0001f33f" * 501, "footer")


def test_501_code_points_is_refused_in_the_footer() -> None:
    with pytest.raises(FooterTooLong):
        CatalogHeaderFooter.of("header", "\U0001f33f" * 501)


def test_both_sides_are_normalised_before_the_length_check() -> None:
    header_footer = CatalogHeaderFooter.of("\n\nheader\n\n", "\r\nfooter\r\n")

    assert header_footer.header == "header"
    assert header_footer.footer == "footer"
