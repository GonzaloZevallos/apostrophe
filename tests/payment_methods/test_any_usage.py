"""`AnyUsage` is the one rule: a method is in use when any source says so."""

from collections.abc import Sequence

from app.payment_methods.adapters.any_usage import AnyUsage


class _Answers:
    def __init__(self, in_use: set[int]) -> None:
        self._in_use = in_use
        self.asked: list[Sequence[int]] = []

    def in_use_among(self, method_ids: Sequence[int]) -> frozenset[int]:
        self.asked.append(method_ids)
        return frozenset(self._in_use & set(method_ids))


def test_it_answers_the_union_of_every_source() -> None:
    payments, expenses = _Answers({1, 2}), _Answers({2, 3})

    assert AnyUsage((payments, expenses)).in_use_among([1, 2, 3, 4]) == {1, 2, 3}


def test_a_method_only_the_second_source_counts_is_in_use() -> None:
    assert AnyUsage((_Answers(set()), _Answers({7}))).in_use_among([7]) == {7}


def test_empty_input_answers_empty_without_asking_a_source() -> None:
    source = _Answers({1})

    assert AnyUsage((source,)).in_use_among([]) == frozenset()
    assert source.asked == []


def test_no_sources_answers_empty() -> None:
    assert AnyUsage(()).in_use_among([1]) == frozenset()
