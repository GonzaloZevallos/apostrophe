"""`Threshold.of` (CODING_STANDARDS section 5: domain unit test, no infrastructure)."""

import pytest

from app.shared.quantity import Quantity
from app.stock.domain.threshold import Threshold, ThresholdInvalid


def test_a_positive_threshold_is_recorded() -> None:
    threshold = Threshold.of(Quantity.of("15"))

    assert threshold.quantity == Quantity.of("15")


def test_a_zero_threshold_is_refused() -> None:
    """The enforcement artefact: a threshold of zero (or less) is rejected, never
    stored as "never low" — turning it off is what removes it instead."""
    with pytest.raises(ThresholdInvalid):
        Threshold.of(Quantity.of("0"))


def test_a_negative_threshold_is_refused() -> None:
    with pytest.raises(ThresholdInvalid):
        Threshold.of(Quantity.of("-5"))
