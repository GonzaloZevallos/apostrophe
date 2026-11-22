"""The cost-and-margins rule over a CostedPurchase, with no infrastructure."""

import pytest

from app.products.domain.cost_and_margins import (
    CostAndMargins,
    CostedPurchase,
    InvalidCostedPurchase,
    PriceMargin,
    PriceRule,
    cost_and_margins,
)
from app.shared.quantity import Quantity


def purchase(total_cost: int, units: int | str) -> CostedPurchase:
    return CostedPurchase(total_cost=total_cost, quantity=Quantity.of(units))


def percent_of(total_cost: int, units: int | str, price: int) -> int:
    result = cost_and_margins(purchase(total_cost, units), [(PriceRule.LIST, price)])
    return result.margins[0].percent


def test_without_a_purchase_there_is_no_cost_and_no_margin() -> None:
    assert cost_and_margins(None, [(PriceRule.LIST, 100)]) == CostAndMargins(None, ())


def test_the_cost_is_rounded_to_the_unit_of_the_decimals_and_the_percent_does_not_change() -> None:
    whole = cost_and_margins(purchase(10000, 30), [(PriceRule.LIST, 500)])
    hundredths = cost_and_margins(purchase(1000000, 30), [(PriceRule.LIST, 50000)])

    assert whole.cost == 333
    assert hundredths.cost == 33333
    assert whole.margins == hundredths.margins == (PriceMargin(PriceRule.LIST, 33),)


def test_the_margin_comes_from_the_exact_cost_never_the_rounded_one() -> None:
    result = cost_and_margins(purchase(1, 2), [(PriceRule.LIST, 3)])

    assert result.cost == 1
    assert result.margins == (PriceMargin(PriceRule.LIST, 83),)  # (3 - 1/2) * 100 / 3; 67 from 1


def test_a_tie_at_plus_x_point_five_rounds_up() -> None:
    assert percent_of(175, 1, 200) == 13  # exactly 12.5


def test_a_tie_at_minus_x_point_five_rounds_toward_plus_infinity() -> None:
    assert percent_of(205, 1, 200) == -2  # exactly -2.5
    assert percent_of(225, 1, 200) == -12  # exactly -12.5


def test_a_cost_above_the_price_is_a_negative_margin() -> None:
    assert percent_of(150, 1, 100) == -50


def test_a_free_purchase_is_a_margin_of_one_hundred() -> None:
    result = cost_and_margins(purchase(0, 5), [(PriceRule.LIST, 70)])

    assert result.cost == 0
    assert result.margins == (PriceMargin(PriceRule.LIST, 100),)


def test_the_margins_keep_the_order_of_the_prices() -> None:
    result = cost_and_margins(
        purchase(50, 1),
        [(PriceRule.LIST, 100), (PriceRule.BULK, 80), (PriceRule.VIP, 60)],
    )

    assert result.margins == (
        PriceMargin(PriceRule.LIST, 50),
        PriceMargin(PriceRule.BULK, 38),
        PriceMargin(PriceRule.VIP, 17),
    )


def test_no_prices_give_the_cost_alone() -> None:
    assert cost_and_margins(purchase(100, 4), []) == CostAndMargins(25, ())


@pytest.mark.parametrize("hundredths", [0, -100])
def test_a_purchase_refuses_a_quantity_that_is_not_positive(hundredths: int) -> None:
    with pytest.raises(InvalidCostedPurchase) as refused:
        CostedPurchase(total_cost=10, quantity=Quantity(hundredths))

    assert (
        str(refused.value) == "a costed purchase needs a positive quantity and a cost of 0 or more"
    )


def test_a_purchase_refuses_a_negative_cost() -> None:
    with pytest.raises(InvalidCostedPurchase) as refused:
        CostedPurchase(total_cost=-1, quantity=Quantity.of(1))

    assert (
        str(refused.value) == "a costed purchase needs a positive quantity and a cost of 0 or more"
    )
