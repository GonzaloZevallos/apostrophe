"""`app/results/domain/arithmetic.py` (CODING_STANDARDS section 5: domain unit test,
no infrastructure). PRD criterion 3: Ganancia and Caja, including negatives; the
half-up average, and `None` with no sales.
"""

from app.results.domain.arithmetic import average_sale, cash, profit


def test_profit_is_sales_minus_cost_of_goods_minus_expenses() -> None:
    assert profit(sales=15_000, cost_of_goods=6_000, expenses=0) == 9_000


def test_profit_can_be_negative_and_is_never_floored() -> None:
    assert profit(sales=0, cost_of_goods=0, expenses=5_000) == -5_000


def test_cash_is_received_minus_expenses_minus_purchases() -> None:
    assert cash(received=15_000, expenses=0, purchases=0) == 15_000


def test_cash_can_be_negative_and_is_never_floored() -> None:
    assert cash(received=30_000, expenses=12_000, purchases=30_000) == -12_000


def test_average_sale_rounds_half_up_to_the_whole_peso() -> None:
    # 7 / 2 = 3.5, rounds up to 4, never down to 3 (banker's rounding would floor it).
    assert average_sale(total=7, count=2) == 4


def test_average_sale_divides_evenly_when_it_already_is_whole() -> None:
    assert average_sale(total=15_000, count=2) == 7_500


def test_average_sale_is_none_with_no_sales() -> None:
    """The enforcement this guards: a period with no sales must show nothing, never a
    computed `$0` average (PRD: "Average sale shows nothing when the period has no
    sales")."""
    assert average_sale(total=0, count=0) is None
