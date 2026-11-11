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

from collections.abc import Collection, Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.payment_methods.adapters.import_port import Holder, PaymentMethodsForImport
from app.sales.adapters.price_book import PlannedPriceBook, SqlPriceBook
from app.sales.adapters.sql_sales import SqlSales
from app.sales.adapters.tables import SaleRow
from app.sales.application.ports import MoneyFormatReader
from app.sales.application.record_sale import LineInput, record_sale
from app.sales.domain.pricing import SaleRuleBroken
from app.sales.domain.sale import CustomerFact, LineRequest, Sale
from app.shared.money import MoneyFormat
from app.shared.payment_method import PaymentMethodId, PaymentMethodUnavailable
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


# The sheet's own words are the only place "cash" and "transfer" survive: each names the
# default method the business holds under its Stored-language default name (docs/adr/0082).
# A caller that knows the business's language passes those names; without them English's.
ENGLISH_DEFAULT_NAMES: Mapping[str, str] = {"cash": "Cash", "transfer": "Transfer"}
# Stands in for a method id while a plan is only checked: nothing is written then.
_CHECKED_METHOD = PaymentMethodId(1)


def _check_method(method: OnTheSpotMethod | None) -> PaymentMethodId | None:
    return None if method is None else _CHECKED_METHOD


class SalesImport:
    """`SalesImport` for one business."""

    def __init__(
        self,
        session: Session,
        business_id: int,
        money_format: MoneyFormatReader | None = None,
        default_names: Mapping[str, str] | None = None,
    ) -> None:
        self._default_names = default_names or ENGLISH_DEFAULT_NAMES
        self._session = session
        self._business_id = business_id
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

    def archived_method_words(self, words: Collection[str]) -> Collection[str]:
        methods = PaymentMethodsForImport(self._session, self._business_id)
        return sorted(
            word
            for word in set(words)
            if word in self._default_names
            and methods.holder_of(self._default_names[word]).holder is Holder.ARCHIVED
        )

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
                    method=_check_method(sale.method),
                    left_owing=sale.left_owing,
                    recorded_at=_UNUSED_RECORDED_AT,
                )
            except SaleRuleBroken as exc:
                results.append(SaleCheck(total=None, refusal=Refusal(code=exc.code)))
                continue
            results.append(SaleCheck(total=built.total, refusal=None))
        return results

    def _method_for(self, word: OnTheSpotMethod | None) -> PaymentMethodId | None:
        """The business's method for a sheet word: the offered one holding the default
        name, or one added last when nobody holds it. An archived holder refuses."""
        if word is None:
            return None
        methods = PaymentMethodsForImport(self._session, self._business_id)
        name = self._default_names[word]
        holding = methods.holder_of(name)
        if holding.holder is Holder.OFFERED and holding.method_id is not None:
            return PaymentMethodId(holding.method_id)
        if holding.holder is Holder.ARCHIVED:
            raise PaymentMethodUnavailable()
        return PaymentMethodId(methods.add(name))

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
        stored = record_sale(
            SqlSales(self._session, self._business_id),
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
            method=self._method_for(sale.method),
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
