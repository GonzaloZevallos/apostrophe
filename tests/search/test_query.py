"""`SearchQuery`: when a query is too short or too long to search, and which ones read
as a Sale number."""

import pytest

from app.search.domain.query import GROUP_LIMIT, SearchQuery


def test_the_group_limit_is_five() -> None:
    assert GROUP_LIMIT == 5


def test_200_characters_are_searched_and_201_are_short() -> None:
    assert not SearchQuery.of("a" * 200).is_short
    assert SearchQuery.of("a" * 201).is_short


@pytest.mark.parametrize("raw", ["", "a", "#", "# ", "   ", "́̂", "ß"])
def test_these_queries_are_short(raw: str) -> None:
    assert SearchQuery.of(raw).is_short


@pytest.mark.parametrize("raw", ["ab", "#5", "00", "012"])
def test_these_queries_are_not_short(raw: str) -> None:
    assert not SearchQuery.of(raw).is_short


def test_the_query_is_trimmed_and_folded() -> None:
    query = SearchQuery.of("  Ángel  Pérez ")
    assert query.q == "Ángel  Pérez"
    assert query.folded == "angel perez"


def test_200_ligatures_are_not_short() -> None:
    # NFKD turns each ﬁ into two letters, but the length that counts is the typed one.
    assert not SearchQuery.of("ﬁ" * 200).is_short


@pytest.mark.parametrize(
    ("raw", "number"),
    [("#5", 5), ("5", 5), ("#0", 0), ("00", 0), ("012", 12), ("#012", 12)],
)
def test_a_sale_number_is_digits_with_an_optional_hash(raw: str, number: int) -> None:
    assert SearchQuery.of(raw).sale_number == number


def test_a_single_digit_is_short_and_still_has_a_sale_number() -> None:
    query = SearchQuery.of("5")
    assert query.is_short
    assert query.sale_number == 5


def test_nine_digits_are_a_sale_number_and_ten_are_not() -> None:
    assert SearchQuery.of("123456789").sale_number == 123456789
    assert SearchQuery.of("1234567890").sale_number is None


@pytest.mark.parametrize("raw", ["a5", "5a", "##5", "#", "", "1 2", "#-5"])
def test_other_text_is_not_a_sale_number(raw: str) -> None:
    assert SearchQuery.of(raw).sale_number is None
