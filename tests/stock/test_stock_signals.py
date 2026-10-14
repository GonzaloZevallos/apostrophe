"""`stock_signals`: stock's code-less internal signal becomes varieties' own refusal."""

import pytest

from app.stock.adapters.router import stock_signals
from app.stock.application.errors import VarietyArchived as StockVarietyArchived
from app.varieties.application.errors import VarietyArchived


def test_stock_variety_archived_becomes_the_varieties_one_with_no_cause() -> None:
    with pytest.raises(VarietyArchived) as raised:
        with stock_signals:
            raise StockVarietyArchived()

    assert raised.value.variety_id is None
    assert raised.value.__cause__ is None
    assert raised.value.__suppress_context__ is True


def test_any_other_exception_passes_through_unchanged() -> None:
    error = ValueError("boom")

    with pytest.raises(ValueError) as raised:
        with stock_signals:
            raise error

    assert raised.value is error


def test_no_exception_passes_silently() -> None:
    with stock_signals:
        pass
