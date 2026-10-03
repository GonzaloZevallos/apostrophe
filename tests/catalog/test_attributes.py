"""`Aroma.of`, `IndicaShare` and `CatalogAttributes.of` / `.default` (CODING_STANDARDS
section 5: domain unit test, no infrastructure)."""

import pytest

from app.catalog.domain.attributes import Aroma, CatalogAttributes, IndicaShare
from app.catalog.domain.errors import AromaTooLong, IndicaShareInvalid


def test_aroma_collapses_whitespace_runs_line_breaks_included_and_trims() -> None:
    aroma = Aroma.of("  cítrico,\nmandarina   dulce  \n")

    assert aroma is not None
    assert aroma.text == "cítrico, mandarina dulce"


def test_an_empty_aroma_is_none() -> None:
    assert Aroma.of("   \n\t  ") is None


def test_aroma_at_200_code_points_is_accepted() -> None:
    aroma = Aroma.of("a" * 200)

    assert aroma is not None
    assert len(aroma.text) == 200


def test_aroma_at_201_code_points_is_refused() -> None:
    """The enforcement artefact: one code point over the limit is rejected."""
    with pytest.raises(AromaTooLong):
        Aroma.of("a" * 201)


def test_indica_share_accepts_0_and_100() -> None:
    assert IndicaShare(0).percent == 0
    assert IndicaShare(100).percent == 100


def test_indica_share_refuses_below_0() -> None:
    with pytest.raises(IndicaShareInvalid):
        IndicaShare(-1)


def test_indica_share_refuses_above_100() -> None:
    with pytest.raises(IndicaShareInvalid):
        IndicaShare(101)


def test_default_attributes_are_shown_with_nothing_filled_in() -> None:
    """The only place `CatalogAttributes.default()` is written: shown, no emoji, no
    share, no aroma."""
    attributes = CatalogAttributes.default()

    assert attributes.shown is True
    assert attributes.emoji is None
    assert attributes.indica_share is None
    assert attributes.aroma is None


def test_of_builds_every_field_from_raw_input() -> None:
    attributes = CatalogAttributes.of(
        shown=False, emoji="\U0001f947", indica_share=60, aroma="cítrico"
    )

    assert attributes.shown is False
    assert attributes.emoji is not None
    assert attributes.emoji.value == "\U0001f947"
    assert attributes.indica_share is not None
    assert attributes.indica_share.percent == 60
    assert attributes.aroma is not None
    assert attributes.aroma.text == "cítrico"


def test_of_with_nothing_set_leaves_every_optional_field_none() -> None:
    attributes = CatalogAttributes.of(shown=True, emoji=None, indica_share=None, aroma=None)

    assert attributes.emoji is None
    assert attributes.indica_share is None
    assert attributes.aroma is None
