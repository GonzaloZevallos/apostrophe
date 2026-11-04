"""The comparator refuses what a migration must never do (proven negatives,
CODING_STANDARDS §5), and accepts additions."""

import copy

import pytest

from tests.migrations.comparator import Snapshot, compare

BEFORE: Snapshot = {
    "thing": {(1,): {"id": 1, "name": "a"}, (2,): {"id": 2, "name": "b"}},
}


def test_a_new_table_and_a_new_column_are_accepted() -> None:
    after = copy.deepcopy(BEFORE)
    after["other"] = {(1,): {"id": 1}}
    after["thing"][(1,)]["extra"] = 7
    after["thing"][(2,)]["extra"] = 8

    compare(BEFORE, after)


def test_a_new_row_in_a_table_that_existed_is_refused() -> None:
    after = copy.deepcopy(BEFORE)
    after["thing"][(3,)] = {"id": 3, "name": "c"}

    with pytest.raises(AssertionError, match="had 2 rows, it has 3"):
        compare(BEFORE, after)


def test_a_changed_value_is_refused() -> None:
    after = copy.deepcopy(BEFORE)
    after["thing"][(2,)]["name"] = "B"

    with pytest.raises(AssertionError, match=r"column 'name' was 'b', it is 'B'"):
        compare(BEFORE, after)


def test_a_dropped_table_is_refused() -> None:
    with pytest.raises(AssertionError, match="table 'thing' is gone"):
        compare(BEFORE, {})


def test_a_replaced_row_is_refused() -> None:
    after = copy.deepcopy(BEFORE)
    after["thing"][(9,)] = after["thing"].pop((2,))

    with pytest.raises(AssertionError, match=r"lost the row \(2,\)"):
        compare(BEFORE, after)


def test_a_dropped_column_is_refused() -> None:
    after = copy.deepcopy(BEFORE)
    del after["thing"][(1,)]["name"]

    with pytest.raises(AssertionError, match="lost the column 'name'"):
        compare(BEFORE, after)
