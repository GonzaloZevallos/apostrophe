"""A write that names a variety deleted a moment ago (docs/adr/0005, docs/adr/0032).

The repository's flush says so with the code-less `ReferenceRefused`; the use case rolls
back, asks its own lookup, and answers its gone code when the variety is gone or archived.
When the lookup says the variety is still there, the signal is re-raised as it came, so
any other foreign-key bug stays a 500. Fakes stand in for the repositories: only the
use cases' own decisions are under test."""

from collections.abc import Callable, Collection, Sequence
from datetime import UTC, date, datetime

import pytest
from sqlalchemy.orm import Session

from app.db import flush_or_refuse
from app.sales.application.record_sale import LineInput, record_sale
from app.sales.domain.pricing import PriceQuote, VarietyPricing
from app.sales.domain.sale import Sale, UnknownVariety
from app.shared.pricing_settings import PricingSettings
from app.shared.quantity import Quantity
from app.shared.reference import ReferenceRefused
from app.stock.application import manage_entries
from app.stock.application.errors import VarietyArchived as StockArchived
from app.stock.application.errors import VarietyNotFound as StockNotFound
from app.stock.domain.entry import Origin, StockEntry
from app.products.application import manage_prices
from app.products.application.errors import ProductArchived, ProductNotFound
from app.products.domain.product import NameHolder, Product, ProductName

DAY = date(2026, 10, 6)
NOW = datetime(2026, 10, 6, 12, tzinfo=UTC)


class BothRulesOn:
    """The pricing switches, both on: the rule the refusal under test never reads."""

    def current(self) -> PricingSettings:
        return PricingSettings(is_bulk_pricing=True, is_vip_customers=True)


class CountingTransaction:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class RefusingSales:
    def add(self, sale: Sale) -> Sale:
        raise ReferenceRefused

    def get(self, sale_id: int) -> Sale | None:
        return None

    def list(self, date_from: date | None, date_to: date | None) -> list[Sale]:
        return []

    def assign_customer(self, sale_id: int, customer_id: int) -> None:
        raise AssertionError("not used")

    def delete(self, sale_id: int) -> None:
        raise AssertionError("not used")


class AskedAgainPriceBook:
    """Prices the variety when the request first looks it up; `present` is what it answers
    when the use case asks again after the refusal."""

    def __init__(self, present: bool) -> None:
        self._present = present
        self._asked = 0

    def for_variety(self, variety_id: int, day: date) -> VarietyPricing | None:
        self._asked += 1
        if self._asked > 1 and not self._present:
            return None
        return VarietyPricing(variety_id=variety_id, current=PriceQuote(10_000, None))


class NoCustomers:
    def get(self, customer_id: int) -> None:
        return None


def _record_sale(present: bool, transaction: CountingTransaction) -> Sale:
    return record_sale(
        RefusingSales(),
        AskedAgainPriceBook(present),
        NoCustomers(),
        BothRulesOn(),
        transaction,
        sale_date=DAY,
        today=DAY,
        customer_id=None,
        shipping_charged=0,
        note=None,
        lines=[LineInput(variety_id=7, quantity=Quantity.of("1"), gift=True)],
        method=None,
        left_owing=False,
        recorded_at=NOW,
    )


def test_a_sale_refused_by_the_foreign_key_rolls_back_and_answers_the_variety_gone() -> None:
    transaction = CountingTransaction()

    with pytest.raises(UnknownVariety):
        _record_sale(present=False, transaction=transaction)

    assert (transaction.rollbacks, transaction.commits) == (1, 0)


def test_a_sale_refused_with_the_variety_still_there_re_raises_the_signal() -> None:
    transaction = CountingTransaction()

    with pytest.raises(ReferenceRefused):
        _record_sale(present=True, transaction=transaction)

    assert (transaction.rollbacks, transaction.commits) == (1, 0)


class RefusingEntries:
    def __init__(self, own_variety_id: int = 7) -> None:
        self._own = own_variety_id

    def by_id(self, entry_id: int) -> StockEntry | None:
        return StockEntry(
            DAY, self._own, Origin.HARVEST, Quantity.of("5"), None, None, NOW, entry_id
        )

    def add(self, entry: StockEntry) -> StockEntry:
        raise ReferenceRefused

    def save(self, entry: StockEntry) -> StockEntry:
        raise ReferenceRefused

    def remove(self, entry_id: int) -> None:
        raise AssertionError("not used")

    def for_varieties(self, variety_ids: Collection[int] | None) -> list[StockEntry]:
        return []


class AskedAgainCatalog:
    """`first` is what the request's own check sees; `then` is what the re-ask sees:
    `"gone"`, `"archived"` or `"usable"`."""

    def __init__(self, then: str) -> None:
        self._then = then
        self._asked = False

    def exists(self, variety_id: int) -> bool:
        return not self._asked or self._then != "gone"

    def usable(self, variety_id: int) -> bool:
        usable = not self._asked or self._then == "usable"
        self._asked = True
        return usable

    def archived_ids(self) -> list[int]:
        return []

    def listed_ids(self) -> list[int]:
        return []

    def names(self) -> dict[int, str]:
        return {}


def _record_entry(then: str, transaction: CountingTransaction) -> StockEntry:
    catalog = AskedAgainCatalog(then)
    return manage_entries.record_entry(
        RefusingEntries(),
        catalog,
        transaction,
        entry_date=DAY,
        variety_id=7,
        origin=Origin.HARVEST,
        quantity=Quantity.of("5"),
        total_cost=None,
        note=None,
        today=DAY,
        recorded_at=NOW,
    )


def _edit_entry(then: str, transaction: CountingTransaction) -> StockEntry:
    return manage_entries.edit_entry(
        RefusingEntries(own_variety_id=3),
        AskedAgainCatalog(then),
        transaction,
        1,
        entry_date=DAY,
        variety_id=7,
        origin=Origin.HARVEST,
        quantity=Quantity.of("5"),
        total_cost=None,
        note=None,
        today=DAY,
    )


@pytest.mark.parametrize("use_case", [_record_entry, _edit_entry])
@pytest.mark.parametrize(
    ("then", "answers"), [("gone", StockNotFound), ("archived", StockArchived)]
)
def test_an_entry_refused_by_the_foreign_key_answers_gone_or_archived(
    use_case: Callable[[str, CountingTransaction], StockEntry],
    then: str,
    answers: type[Exception],
) -> None:
    transaction = CountingTransaction()

    with pytest.raises(answers):
        use_case(then, transaction)

    assert (transaction.rollbacks, transaction.commits) == (1, 0)


@pytest.mark.parametrize("use_case", [_record_entry, _edit_entry])
def test_an_entry_refused_with_the_variety_still_usable_re_raises_the_signal(
    use_case: Callable[[str, CountingTransaction], StockEntry],
) -> None:
    transaction = CountingTransaction()

    with pytest.raises(ReferenceRefused):
        use_case("usable", transaction)

    assert (transaction.rollbacks, transaction.commits) == (1, 0)


class RefusingVarieties:
    """Reads the variety `then` says it is after the refusal: `None` when gone."""

    def __init__(self, then: Product | None) -> None:
        self._then = then
        self._reads = 0

    def add(self, variety: Product) -> Product:
        raise AssertionError("not used")

    def get(self, variety_id: int) -> Product | None:
        self._reads += 1
        return Product(ProductName.of("Gold"), id=7) if self._reads == 1 else self._then

    def listed(self) -> list[Product]:
        return []

    def archived(self) -> list[Product]:
        return []

    def save(self, variety: Product) -> Product:
        raise ReferenceRefused

    def name_holder(self, name: ProductName, *, other_than: int | None = None) -> NameHolder | None:
        return None

    def has_history(self, variety_id: int) -> bool:
        return False

    def remove_price_entries(self, variety_id: int) -> None:
        raise AssertionError("not used")

    def remove_unused(self, variety_id: int) -> bool:
        raise AssertionError("not used")


def _record_price(then: Product | None, transaction: CountingTransaction) -> object:
    return manage_prices.record_price_entry(
        RefusingVarieties(then),
        BothRulesOn(),
        transaction,
        7,
        effective_from=DAY,
        list_price=10_000,
    )


def test_a_price_refused_by_the_foreign_key_answers_the_variety_gone() -> None:
    transaction = CountingTransaction()

    with pytest.raises(ProductNotFound):
        _record_price(None, transaction)

    assert (transaction.rollbacks, transaction.commits) == (1, 0)


def test_a_price_refused_with_the_variety_archived_meanwhile_answers_archived() -> None:
    transaction = CountingTransaction()
    archived = Product(ProductName.of("Gold"), id=7, archived_at=NOW)

    with pytest.raises(ProductArchived):
        _record_price(archived, transaction)

    assert (transaction.rollbacks, transaction.commits) == (1, 0)


def test_a_price_refused_with_the_variety_still_live_re_raises_the_signal() -> None:
    transaction = CountingTransaction()

    with pytest.raises(ReferenceRefused):
        _record_price(Product(ProductName.of("Gold"), id=7), transaction)

    assert (transaction.rollbacks, transaction.commits) == (1, 0)


class _FlushRaises(Session):
    def __init__(self, error: Exception) -> None:
        super().__init__()
        self._error = error

    def flush(self, objects: Sequence[object] | None = None) -> None:
        raise self._error


def test_libsql_s_bare_foreign_key_error_becomes_the_signal() -> None:
    with pytest.raises(ReferenceRefused) as raised:
        flush_or_refuse(_FlushRaises(ValueError("FOREIGN KEY constraint failed")))

    assert raised.value.__cause__ is None
    assert "FOREIGN" not in str(raised.value)


def test_any_other_value_error_is_not_swallowed_as_a_refusal() -> None:
    with pytest.raises(ValueError, match="something else"):
        flush_or_refuse(_FlushRaises(ValueError("something else")))
