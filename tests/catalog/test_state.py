"""`catalog_state` (CODING_STANDARDS section 5): the state matrix, shown/hidden x
price/none x the four stock statuses, in priority order."""

import pytest

from app.catalog.domain.attributes import CatalogAttributes
from app.catalog.domain.product import CatalogPrice, StockStatus, catalog_state
from app.shared.quantity import Quantity

PRICE = CatalogPrice(list_price=11000, bulk_price=None, bulk_minimum=None)
STOCK_STATUSES: tuple[StockStatus, ...] = ("no_entries", "sold_out", "low", "ok")


@pytest.mark.parametrize("stock_status", STOCK_STATUSES)
def test_hidden_wins_over_price_and_stock(stock_status: StockStatus) -> None:
    hidden = CatalogAttributes.of(shown=False, emoji=None, indica_share=None, aroma=None)

    assert catalog_state(hidden, PRICE, stock_status) == "hidden"
    assert catalog_state(hidden, None, stock_status) == "hidden"


@pytest.mark.parametrize("stock_status", STOCK_STATUSES)
def test_no_price_wins_over_stock_when_shown(stock_status: StockStatus) -> None:
    shown = CatalogAttributes.default()

    assert catalog_state(shown, None, stock_status) == "no_price"


def test_sold_out_and_no_entries_pass_through_the_stock_status() -> None:
    shown = CatalogAttributes.default()

    assert catalog_state(shown, PRICE, "sold_out") == "sold_out"
    assert catalog_state(shown, PRICE, "no_entries") == "no_entries"


@pytest.mark.parametrize("stock_status", ["low", "ok"])
def test_shown_priced_and_in_stock_is_in(stock_status: StockStatus) -> None:
    shown = CatalogAttributes.default()

    assert catalog_state(shown, PRICE, stock_status) == "in"


def test_a_catalog_price_accepts_both_bulk_fields_or_neither() -> None:
    CatalogPrice(list_price=11000, bulk_price=10000, bulk_minimum=Quantity.of("10"))
    CatalogPrice(list_price=11000, bulk_price=None, bulk_minimum=None)


def test_a_catalog_price_refuses_a_bulk_price_with_no_bulk_minimum() -> None:
    """The enforcement artefact: a bulk price with no bulk minimum is rejected."""
    with pytest.raises(ValueError):
        CatalogPrice(list_price=11000, bulk_price=10000, bulk_minimum=None)


def test_a_catalog_price_refuses_a_bulk_minimum_with_no_bulk_price() -> None:
    with pytest.raises(ValueError):
        CatalogPrice(list_price=11000, bulk_price=None, bulk_minimum=Quantity.of("10"))
