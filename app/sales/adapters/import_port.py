"""`SalesImport` (`app/spreadsheet_import/application/ports.py`) over sales' own
tables and domain rules (CODING_STANDARDS section 1; the plan's invariant: an owner's
import adapter writes only its own hexagon's tables).

`check_sales` builds one `PlannedPriceBook` per call from the plain price-history rows,
maps each distinct variety key to a local ordinal that never leaves this call, and
replays `Sale.record` — the same aggregate constructor `write_sale` uses through
`record_sale` — so a row's refusal, when there is one, is always the rule `Sale.record`
itself would raise. `write_sale` is always given a type fact built from the row's own
`vip` and the business's VIP type (the plan's invariant: never from the customer's stored
VIP flag).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date, datetime
from decimal import Decimal
from typing import assert_never

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.customer_types.adapters.import_port import VIP_TYPE_NAME
from app.customer_types.adapters.tables import CustomerTypeRow
from app.sales.adapters.price_book import PlannedPriceBook, SqlPriceBook
from app.sales.adapters.sql_sales import SqlSales
from app.sales.adapters.tables import SaleRow
from app.sales.application.ports import MoneyFormatReader
from app.sales.application.record_sale import LineInput, record_sale
from app.sales.domain.pricing import CustomerTypeFact, SaleRuleBroken
from app.sales.domain.sale import CustomerFact, LineRequest, PaymentMethod, Sale
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
# The VIP type's id for the duration of one check only: no type exists yet in the plan phase.
_CHECK_VIP_TYPE = CustomerTypeFact(id=1, name=VIP_TYPE_NAME.value)


def _payment_method(method: OnTheSpotMethod | None) -> PaymentMethod | None:
    """`method` is already closed to `OnTheSpotMethod | None` by every hop before this
    one (the plan's invariant), so this is the only place `PaymentMethod` is ever built
    from an import value, and it can never raise: `assert_never` makes a third sheet
    word unreachable rather than a `ValueError` at runtime."""
    match method:
        case None:
            return None
        case "cash":
            return PaymentMethod.CASH
        case "transfer":
            return PaymentMethod.TRANSFER
        case _:
            assert_never(method)


class SalesImport:
    """`SalesImport` for one business."""

    def __init__(
        self, session: Session, business_id: int, money_format: MoneyFormatReader | None = None
    ) -> None:
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
                        CustomerFact(
                            id=_CHECK_CUSTOMER_ID,
                            customer_type=_CHECK_VIP_TYPE if sale.vip else None,
                        )
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
                    method=_payment_method(sale.method),
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
        stored = record_sale(
            SqlSales(self._session, self._business_id),
            SqlPriceBook(self._session, self._business_id),
            _FixedType(self._vip_type_fact() if sale.vip else None),
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
            method=_payment_method(sale.method),
            left_owing=sale.left_owing,
            recorded_at=recorded_at,
        )
        return stored.total

    def _vip_type_fact(self) -> CustomerTypeFact | None:
        """The business's VIP type with its current name, as a hand-entered sale to a VIP
        customer would read it."""
        found = self._session.execute(
            select(CustomerTypeRow.id, CustomerTypeRow.name).where(
                CustomerTypeRow.business_id == self._business_id,
                CustomerTypeRow.is_vip.is_(True),
            )
        ).first()
        return None if found is None else CustomerTypeFact(id=found[0], name=found[1])


class _FixedSettings:
    """A `PricingSettingsReader` of one fixed answer: the switches the import leaves,
    so the write prices exactly as the check did."""

    def __init__(self, settings: PricingSettings) -> None:
        self._settings = settings

    def current(self) -> PricingSettings:
        return self._settings


class _FixedType:
    """A `CustomerFacts` of one fixed answer: the customer type decided by the sheet's row
    type ("Amigo" is the VIP type) rather than any customer's stored flag (the plan's
    invariant: a sale is priced from the row's own type, never from the stored flag)."""

    def __init__(self, customer_type: CustomerTypeFact | None) -> None:
        self._customer_type = customer_type

    def get(self, customer_id: int) -> CustomerFact | None:
        return CustomerFact(id=customer_id, customer_type=self._customer_type)


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
