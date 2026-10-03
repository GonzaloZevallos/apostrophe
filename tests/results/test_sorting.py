"""`app/results/domain/sorting.py` (CODING_STANDARDS section 5: domain unit test, no
infrastructure). PRD "Te deben block" (the teaser's order and its cut at 3) and "Lo
que te queda" (every variety by name); plan invariant: every ordering of customers or
varieties by name uses `fold`, in Python.
"""

from datetime import date

from app.results.application.ports import DebtorRow, StockRow
from app.results.domain.sorting import TEASER_SIZE, oldest, sorted_by_name, teaser


def _debtor(customer_id: int, name: str, balance: int, owing_since: str) -> DebtorRow:
    return DebtorRow(
        customer_id=customer_id,
        name=name,
        balance=balance,
        owing_since=date.fromisoformat(owing_since),
    )


def test_teaser_orders_by_balance_then_owing_since_then_name_then_id_and_cuts_at_3() -> None:
    debtors = [
        _debtor(1, "Bruno", 1_000, "2026-02-01"),
        _debtor(2, "ana", 1_000, "2026-01-01"),
        _debtor(3, "Ana", 1_000, "2026-01-01"),
        _debtor(4, "Carla", 500, "2026-03-01"),
        _debtor(5, "Dana", 100, "2026-04-01"),
    ]

    answer = teaser(debtors)

    assert [row.customer_id for row in answer] == [2, 3, 1]
    assert len(answer) == TEASER_SIZE


def test_teaser_folds_accents_and_case_before_comparing_names() -> None:
    tied = [
        _debtor(10, "úrsula", 1_000, "2026-01-01"),
        _debtor(9, "Ursula", 1_000, "2026-01-01"),
    ]

    answer = teaser(tied)

    # Same balance, same owing-since, and the names fold equal: the tie is broken by
    # `customer_id`, the lowest first.
    assert [row.customer_id for row in answer] == [9, 10]


def test_teaser_is_empty_with_nobody_owing() -> None:
    assert teaser([]) == ()


def test_oldest_is_the_first_debtor_s_owing_since_in_the_given_order() -> None:
    debtors = [_debtor(1, "Ana", 500, "2026-01-05"), _debtor(2, "Bruno", 200, "2026-02-01")]

    assert oldest(debtors) == date(2026, 1, 5)


def test_oldest_is_none_with_nobody_owing() -> None:
    assert oldest([]) is None


def _stock_row(variety_id: int, name: str) -> StockRow:
    from app.shared.grams import Grams

    return StockRow(
        variety_id=variety_id,
        name=name,
        grams=Grams(0),
        status="no_entries",
        sold_out_since=None,
        threshold=None,
        days_left=None,
    )


def test_stock_rows_sort_by_folded_name_then_variety_id() -> None:
    rows = [
        _stock_row(3, "Zafiro"),
        _stock_row(1, "ácida"),
        _stock_row(2, "Acida"),
    ]

    answer = sorted_by_name(rows)

    # "ácida" and "Acida" fold equal: the tie is broken by `variety_id`.
    assert [row.variety_id for row in answer] == [1, 2, 3]
