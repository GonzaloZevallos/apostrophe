"""`SalesImport` (`app/spreadsheet_import/application/ports.py`) over sales' own
tables and domain rules (CODING_STANDARDS section 1; the plan's invariant: an owner's
import adapter writes only its own hexagon's tables).

`check_sales` builds one `PlannedPriceBook` per call from the plain price-history rows,
maps each distinct variety key to a local ordinal that never leaves this call, and
replays `Sale.record` — the same aggregate constructor `write_sale` uses through
`record_sale` — so a row's refusal, when there is one, is always the rule `Sale.record`
itself would raise. `write_sale` is always given a vip fact built from the row's own
`vip` (the plan's invariant: never from the customer's stored VIP flag).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import Protocol, assert_never

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.sales.adapters.price_book import PlannedPriceBook, SqlPriceBook
from app.sales.adapters.sql_sales import SqlSales
from app.sales.adapters.tables import SaleRow
from app.sales.application.ports import MoneyFormatReader, OnTheSpotPayments
from app.sales.application.record_sale import LineInput, record_sale
from app.sales.domain.pricing import SaleRuleBroken
from app.sales.domain.sale import CustomerFact, LineRequest, Sale
from app.shared.money import MoneyFormat
from app.shared.pricing_settings import PricingSettings
from app.shared.transaction import Transaction
from app.spreadsheet_import.application.ports import Refusal, SaleCheck, SaleCheckInput
from app.spreadsheet_import.domain.plan import OnTheSpotMethod
from app.spreadsheet_import.domain.rows import PriceHistoryRow

# Never written and never compared: `Sale.record` needs a `recorded_at` to build the
# aggregate, but a checked-only sale is never stored, so the real sequence
# (`write_import.py`'s, one per run) only ever reaches `write_sale`.
_UNUSED_RECORDED_AT = datetime(1970, 1, 1)
# A customer's id, for the duration of one `Sale.record` call only: `check_sales` never
# resolves a real customer, so any id that is not `None` tells `Sale.record` a customer
# is present, and never leaves this module (the plan's invariant).
_CHECK_CUSTOMER_ID = 1


# The sheet's two words become the names the import looks the business's method up by
# (ignoring case and spaces); this adapter is the only place a method is found by name
# to write a payment (docs/adr/0082).
_SHEET_METHOD_NAMES = {"cash": "Cash", "transfer": "Transfer"}


class MethodsByName(Protocol):
    def ensure_by_name(self, raw_name: str) -> int: ...


# Only a "has a method" marker for the checked-only sale, which is never stored.
_CHECK_METHOD_ID = 1


def _sheet_method_name(method: OnTheSpotMethod | None) -> str | None:
    match method:
        case None:
            return None
        case "cash" | "transfer":
            return _SHEET_METHOD_NAMES[method]
        case _:
            assert_never(method)


class SalesImport:
    """`SalesImport` for one business."""

    def __init__(
        self,
        session: Session,
        business_id: int,
        on_the_spot: OnTheSpotPayments,
        methods: MethodsByName,
        money_format: MoneyFormatReader | None = None,
    ) -> None:
        self._session = session
        self._business_id = business_id
        self._on_the_spot = on_the_spot
        self._methods = methods
        # The command line hangs the business's own format here; a caller that has none
        # gets the whole-amount one, which accepts a sheet's whole amounts all the same.
        self._money_format: MoneyFormatReader = money_format or _SheetAmounts()

    def has_records(self) -> bool:
        statement = (
            select(func.count())
            .select_from(SaleRow)
            .where(SaleRow.business_id == self._business_id)
        )
        return bool(self._session.scalar(statement))

    def check_sales(
        self,
        price_history: Sequence[PriceHistoryRow],
        variety_keys: Mapping[str, str],
        sales: Sequence[SaleCheckInput],
        today: date,
        settings: PricingSettings,
    ) -> Sequence[SaleCheck]:
        ordinals = _assign_ordinals(price_history, variety_keys, sales)
        book = PlannedPriceBook(price_history, variety_keys, ordinals)
        results: list[SaleCheck] = []
        for sale in sales:
            ordinal = ordinals[sale.variety_key]
            pricing = book.for_variety(ordinal, sale.sale_date)
            quote = pricing.current if pricing is not None else None
            try:
                built = Sale.record(
                    sale_date=sale.sale_date,
                    today=today,
                    customer_id=_CHECK_CUSTOMER_ID if sale.has_customer else None,
                    settings=settings,
                    customer=(
                        CustomerFact(id=_CHECK_CUSTOMER_ID, vip=sale.vip)
                        if sale.has_customer
                        else None
                    ),
                    shipping_charged=sale.shipping,
                    note=sale.note,
                    lines=[
                        LineRequest(
                            variety_id=ordinal,
                            quantity=sale.quantity,
                            quote=quote,
                            gift=sale.gift,
                            special_price=sale.special_total,
                        )
                    ],
                    payment_method_id=(None if sale.method is None else _CHECK_METHOD_ID),
                    left_owing=sale.left_owing,
                    recorded_at=_UNUSED_RECORDED_AT,
                )
            except SaleRuleBroken as exc:
                results.append(SaleCheck(total=None, refusal=Refusal(code=exc.code)))
                continue
            results.append(SaleCheck(total=built.total, refusal=None))
        return results

    def write_sale(
        self,
        variety_id: int,
        customer_id: int | None,
        sale: SaleCheckInput,
        recorded_at: datetime,
        today: date,
        transaction: Transaction,
        settings: PricingSettings,
    ) -> int:
        method_name = _sheet_method_name(sale.method)
        stored = record_sale(
            SqlSales(self._session, self._business_id),
            self._on_the_spot,
            SqlPriceBook(self._session, self._business_id),
            _FixedVip(sale.vip),
            _FixedSettings(settings),
            self._money_format,
            transaction,
            sale_date=sale.sale_date,
            today=today,
            customer_id=customer_id,
            shipping_charged=Decimal(sale.shipping),
            note=sale.note,
            lines=[
                LineInput(
                    variety_id=variety_id,
                    quantity=sale.quantity,
                    gift=sale.gift,
                    special_price=(
                        None if sale.special_total is None else Decimal(sale.special_total)
                    ),
                )
            ],
            payment_method_id=(
                None if method_name is None else self._methods.ensure_by_name(method_name)
            ),
            left_owing=sale.left_owing,
            recorded_at=recorded_at,
        )
        return stored.total


class _FixedSettings:
    """A `PricingSettingsReader` of one fixed answer: the switches the import leaves,
    so the write prices exactly as the check did."""

    def __init__(self, settings: PricingSettings) -> None:
        self._settings = settings

    def current(self) -> PricingSettings:
        return self._settings


class _FixedVip:
    """A `CustomerFacts` of one fixed answer: `sale.vip`, decided by the sheet's row
    type ("Amigo") rather than any customer's stored flag (the plan's invariant: a
    sale is priced with vip = (row type is "Amigo"), never from the stored flag)."""

    def __init__(self, vip: bool) -> None:
        self._vip = vip

    def get(self, customer_id: int) -> CustomerFact | None:
        return CustomerFact(id=customer_id, vip=self._vip)


def _assign_ordinals(
    price_history: Sequence[PriceHistoryRow],
    variety_keys: Mapping[str, str],
    sales: Sequence[SaleCheckInput],
) -> dict[str, int]:
    """One local ordinal per distinct variety key seen in this call, in the order
    first seen; never persisted, never returned past `check_sales`."""
    ordinals: dict[str, int] = {}
    for row in price_history:
        key = variety_keys.get(row.variety)
        if key is not None and key not in ordinals:
            ordinals[key] = len(ordinals) + 1
    for sale in sales:
        if sale.variety_key not in ordinals:
            ordinals[sale.variety_key] = len(ordinals) + 1
    return ordinals


class _SheetAmounts:
    """A sheet's amounts are whole currency units already, so any format accepts them: the
    use case's check passes by value, and this hexagon never reads the money format table
    it does not own (docs/adr/0055)."""

    def current(self) -> MoneyFormat:
        return MoneyFormat(symbol="#", decimals=0)
