"""`cost_per_gram` (CODING_STANDARDS section 5: domain unit tests, no infrastructure;
section 9's "no float, round() or Decimal.quantize in money or grams paths")."""

from app.shared.grams import Grams
from app.stock.domain.costing import cost_per_gram


def test_cost_per_gram_divides_evenly() -> None:
    assert cost_per_gram(10_000, Grams.of("10")) == 1_000


def test_cost_per_gram_rounds_half_up() -> None:
    # 1000 / 3 = 333.333..., the half-up rounding takes it to 333.
    assert cost_per_gram(1_000, Grams.of("3")) == 333
    # 85000 / 11.5 = 7391.30..., rounds to 7391.
    assert cost_per_gram(85_000, Grams.of("11.5")) == 7_391


def test_cost_per_gram_rounds_a_half_up_not_to_even() -> None:
    # 5 / 2 = 2.5 exactly: half up takes it to 3, never to the nearest even number.
    assert cost_per_gram(5, Grams.of("2")) == 3
