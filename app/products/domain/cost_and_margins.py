"""The cost of a variety's latest costed Purchase and its margin against each price
(GH-522). Pure: it imports only the standard library and `app.shared`.

A margin is worked out from the exact cost, never from the rounded one the screen shows
(ADR-0020): a cost of 1/2 against a price of 3 is a margin of 83, not 67."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import Enum
from fractions import Fraction

from app.shared.money import round_half_up_to_units
from app.shared.quantity import Quantity
from app.shared.ratio import round_ratio_half_up


class InvalidCostedPurchase(ValueError):
    """A costed Purchase was invalid. The message is a fixed literal, built from no
    constructor argument, so it never repeats what was submitted."""


@dataclass(frozen=True)
class CostedPurchase:
    """A Purchase with a cost: `total_cost` is the domain amount, in the unit of the
    business's decimals, paid for the whole `quantity`."""

    total_cost: int
    quantity: Quantity

    def __post_init__(self) -> None:
        if not self.quantity.is_positive or self.total_cost < 0:
            raise InvalidCostedPurchase(
                "a costed purchase needs a positive quantity and a cost of 0 or more"
            )


class PriceRule(Enum):
    LIST = "list"
    BULK = "bulk"
    VIP = "vip"


@dataclass(frozen=True)
class PriceMargin:
    rule: PriceRule
    percent: int


@dataclass(frozen=True)
class CostAndMargins:
    """`cost` is `None` when the variety has no costed Purchase yet."""

    cost: int | None
    margins: tuple[PriceMargin, ...]


def margin_percent(price: int, exact_cost: Fraction) -> int:
    return round_ratio_half_up((price - exact_cost) * 100 / price)


def cost_and_margins(
    purchase: CostedPurchase | None, prices: Sequence[tuple[PriceRule, int]]
) -> CostAndMargins:
    """The cost per unit and one margin per price, in the order the prices come. With no
    purchase there is no cost and no margin."""
    if purchase is None:
        return CostAndMargins(None, ())
    exact = Fraction(purchase.total_cost) / purchase.quantity.units
    return CostAndMargins(
        round_half_up_to_units(exact),
        tuple(PriceMargin(rule, margin_percent(price, exact)) for rule, price in prices),
    )
