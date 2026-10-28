"""The `Sale` aggregate: its factory, its total and assigning a customer later
(CONTEXT.md: Sale, Sale without a customer; ADR-0003), with no infrastructure.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, date, datetime

import pytest

from app.sales.domain.pricing import (
    BulkQuote,
    GiftWithSpecialPrice,
    InvalidSpecialPrice,
    NonPositiveQuantity,
    NoPriceThatDay,
    PriceQuote,
    PricingRule,
    SaleRuleBroken,
    special_rate,
)
from app.sales.domain.sale import (
    NOTE_MAX_LENGTH,
    CustomerAlreadyAssigned,
    CustomerFact,
    LineRequest,
    NegativeShipping,
    NoLines,
    NoteTooLong,
    OnTheSpotPayment,
    OwingWithoutCustomer,
    PaymentMethod,
    PaymentRequired,
    Sale,
    SaleDateInFuture,
    SaleLine,
)
from app.shared.quantity import Quantity
from app.shared.pricing_settings import PricingSettings

BOTH_ON = PricingSettings(is_bulk_pricing=True, is_vip_customers=True)
TODAY = date(2026, 6, 15)
RECORDED_AT = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)

LIST_ONLY = PriceQuote(list_price=1_000)
WITH_BULK = PriceQuote(list_price=1_000, bulk=BulkQuote(price=700, minimum=Quantity.of(10)))
VIP = CustomerFact(id=1, vip=True)
NOT_VIP = CustomerFact(id=1, vip=False)
ONE_GRAM = Quantity.of(1)


def _line(
    variety_id: int = 1,
    quantity: Quantity = ONE_GRAM,
    quote: PriceQuote | None = LIST_ONLY,
    gift: bool = False,
    special_price: int | None = None,
) -> LineRequest:
    return LineRequest(
        variety_id=variety_id, quantity=quantity, quote=quote, gift=gift, special_price=special_price
    )


def _record(
    *,
    sale_date: date = TODAY,
    customer_id: int | None = None,
    customer: CustomerFact | None = None,
    shipping_charged: int = 0,
    note: str | None = None,
    lines: list[LineRequest] | None = None,
    method: PaymentMethod | None = PaymentMethod.CASH,
    left_owing: bool = False,
) -> Sale:
    return Sale.record(
        sale_date=sale_date,
        today=TODAY,
        customer_id=customer_id,
        customer=customer,
        settings=BOTH_ON,
        shipping_charged=shipping_charged,
        note=note,
        lines=lines if lines is not None else [_line()],
        method=method,
        left_owing=left_owing,
        recorded_at=RECORDED_AT,
    )


# -- the aggregate's refusals -----------------------------------------------------------


def test_a_sale_needs_at_least_one_line() -> None:
    with pytest.raises(NoLines):
        _record(lines=[])


def test_a_sale_cannot_be_dated_after_today() -> None:
    with pytest.raises(SaleDateInFuture):
        _record(sale_date=date(2026, 6, 16))


def test_a_sale_dated_today_or_earlier_is_fine() -> None:
    assert _record(sale_date=TODAY).date == TODAY
    assert _record(sale_date=date(2020, 1, 1)).date == date(2020, 1, 1)


def test_shipping_charged_cannot_be_negative() -> None:
    with pytest.raises(NegativeShipping):
        _record(shipping_charged=-1)


def test_a_note_over_two_hundred_characters_after_trim_is_refused() -> None:
    with pytest.raises(NoteTooLong):
        _record(note="x" * 201)


def test_a_note_of_exactly_two_hundred_characters_is_kept() -> None:
    sale = _record(note="x" * 200)

    assert sale.note == "x" * 200


def test_a_note_blank_after_trim_becomes_none() -> None:
    sale = _record(note="   ")

    assert sale.note is None


def test_a_note_is_trimmed() -> None:
    sale = _record(note="  hello  ")

    assert sale.note == "hello"


def test_line_refusals_propagate_from_pricing() -> None:
    with pytest.raises(NonPositiveQuantity):
        _record(lines=[_line(quantity=Quantity.of(0))])
    with pytest.raises(GiftWithSpecialPrice):
        _record(lines=[_line(gift=True, special_price=5)])
    with pytest.raises(InvalidSpecialPrice):
        _record(lines=[_line(special_price=0)])
    with pytest.raises(NoPriceThatDay):
        _record(lines=[_line(quote=None)])


def test_a_total_above_zero_needs_a_method_or_to_be_left_owing() -> None:
    with pytest.raises(PaymentRequired):
        _record(method=None, left_owing=False)


def test_owing_without_a_customer_is_refused() -> None:
    with pytest.raises(OwingWithoutCustomer):
        _record(method=None, left_owing=True, customer_id=None)


def test_owing_with_a_customer_is_accepted_and_stores_no_payment() -> None:
    sale = _record(method=None, left_owing=True, customer_id=7)

    assert sale.payment is None
    assert sale.customer_id == 7


# -- total and payment --------------------------------------------------------------------


def test_a_zero_total_sale_has_no_payment_and_ignores_the_method() -> None:
    sale = _record(lines=[_line(gift=True)], method=PaymentMethod.CASH, shipping_charged=0)

    assert sale.total == 0
    assert sale.payment is None


def test_a_paid_sale_records_a_payment_of_the_full_total_on_the_sale_date() -> None:
    sale = _record(
        sale_date=date(2026, 6, 10),
        lines=[_line(quote=LIST_ONLY, quantity=Quantity.of(2))],
        shipping_charged=100,
        method=PaymentMethod.TRANSFER,
        customer_id=3,
    )

    assert sale.payment is not None
    assert sale.payment.amount == sale.total == 2_100
    assert sale.payment.paid_on == date(2026, 6, 10)
    assert sale.payment.method == PaymentMethod.TRANSFER
    assert sale.payment.customer_id == 3


def test_total_is_the_sum_of_the_rounded_lines_plus_shipping_once() -> None:
    sale = _record(
        lines=[
            _line(variety_id=1, quote=LIST_ONLY, quantity=Quantity.of(1)),  # 1000
            _line(variety_id=2, quote=WITH_BULK, quantity=Quantity.of(10)),  # 700 * 10 = 7000
        ],
        shipping_charged=500,
        method=PaymentMethod.CASH,
    )

    assert [line.line_total for line in sale.lines] == [1_000, 7_000]
    assert sale.total == 1_000 + 7_000 + 500


def test_total_grams_sums_every_line_gifts_included() -> None:
    sale = _record(
        lines=[
            _line(variety_id=1, quote=LIST_ONLY, quantity=Quantity.of(2)),
            _line(variety_id=2, quote=LIST_ONLY, quantity=Quantity.of("1.5"), gift=True),
        ],
        method=PaymentMethod.CASH,
    )

    assert sale.total_quantity == Quantity.of("3.5")


def test_bulk_minimum_is_measured_per_line_never_summed() -> None:
    # Two lines of the same variety, each below the minimum on its own, together above it.
    sale = _record(
        lines=[
            _line(variety_id=1, quote=WITH_BULK, quantity=Quantity.of(6)),
            _line(variety_id=1, quote=WITH_BULK, quantity=Quantity.of(6)),
        ],
        method=PaymentMethod.CASH,
    )

    assert [line.pricing_rule for line in sale.lines] == [PricingRule.LIST, PricingRule.LIST]


def test_vip_prices_every_line_at_its_vip_price_even_without_reaching_the_minimum() -> None:
    with_vip = PriceQuote(
        list_price=1_000,
        bulk=BulkQuote(price=700, minimum=Quantity.of(10)),
        vip_price=700,
    )
    sale = _record(
        customer=VIP,
        customer_id=1,
        lines=[_line(quote=with_vip, quantity=Quantity.of(1))],
        method=PaymentMethod.CASH,
    )

    assert sale.lines[0].pricing_rule == PricingRule.VIP


def test_special_line_total_never_feeds_back_into_the_total_via_its_rate() -> None:
    sale = _record(
        lines=[_line(special_price=7, quantity=Quantity.of(2))],
        method=PaymentMethod.CASH,
    )

    # The stored rate times the grams does not equal the line total; the stored
    # line_total (the typed amount) is what is authoritative.
    stored_rate = sale.lines[0].price_per_gram
    assert stored_rate == special_rate(7, Quantity.of(2))
    assert sale.lines[0].line_total == 7
    assert sale.total == 7


# -- assign_customer ------------------------------------------------------------------


def test_assign_customer_sets_it_on_the_sale_and_its_payment() -> None:
    sale = _record(method=PaymentMethod.CASH, customer_id=None)

    sale.assign_customer(9)

    assert sale.customer_id == 9
    assert sale.payment is not None
    assert sale.payment.customer_id == 9


def test_assign_customer_twice_is_refused_and_never_replaces_the_first() -> None:
    sale = _record(method=PaymentMethod.CASH, customer_id=None)
    sale.assign_customer(9)

    with pytest.raises(CustomerAlreadyAssigned):
        sale.assign_customer(10)

    assert sale.customer_id == 9


def test_assign_customer_on_a_sale_already_recorded_with_one_is_refused() -> None:
    sale = _record(method=PaymentMethod.CASH, customer_id=5)

    with pytest.raises(CustomerAlreadyAssigned):
        sale.assign_customer(9)


# -- immutability of stored lines -----------------------------------------------------


def test_customer_vip_status_is_captured_only_at_recording_time() -> None:
    priced_as_not_vip = _record(
        customer=NOT_VIP,
        customer_id=1,
        lines=[_line(quote=WITH_BULK, quantity=Quantity.of(1))],
        method=PaymentMethod.CASH,
    )

    assert priced_as_not_vip.lines[0].pricing_rule == PricingRule.LIST
    # A later VIP toggle never reaches this already-built aggregate: nothing here
    # recomputes a stored line, which is the point of this test.


def test_assigning_a_customer_never_touches_stored_line_prices() -> None:
    sale = _record(
        method=PaymentMethod.CASH,
        customer_id=None,
        lines=[_line(quote=WITH_BULK, quantity=Quantity.of(1))],
    )
    before = sale.lines[0]

    sale.assign_customer(9)

    assert sale.lines[0] == before


def test_every_aggregate_refusal_message_carries_no_input_value() -> None:
    # NoteTooLong is excluded here: like CustomerNameTooLong, it names the fixed
    # NOTE_MAX_LENGTH constant, never the submitted note or its length.
    cases: list[tuple[type[SaleRuleBroken], Callable[[], Sale]]] = [
        (NoLines, lambda: _record(lines=[])),
        (SaleDateInFuture, lambda: _record(sale_date=date(2026, 6, 16))),
        (NegativeShipping, lambda: _record(shipping_charged=-1)),
        (PaymentRequired, lambda: _record(method=None, left_owing=False)),
        (OwingWithoutCustomer, lambda: _record(method=None, left_owing=True)),
    ]
    for exc_type, action in cases:
        with pytest.raises(exc_type) as excinfo:
            action()
        assert issubclass(exc_type, SaleRuleBroken)
        assert not any(c.isdigit() for c in str(excinfo.value))


def test_sale_line_rejects_a_negative_line_total() -> None:
    # The persistence adapter rebuilds a `SaleLine` straight from a stored row, with
    # no pricing pass in between; `__post_init__` is what would catch a corrupt row.
    with pytest.raises(AssertionError):
        SaleLine(
            variety_id=1,
            quantity=ONE_GRAM,
            pricing_rule=PricingRule.LIST,
            price_per_gram=1_000,
            line_total=-1,
        )


def test_on_the_spot_payment_rejects_a_non_positive_amount() -> None:
    with pytest.raises(AssertionError):
        OnTheSpotPayment(paid_on=TODAY, amount=0, method=PaymentMethod.CASH, customer_id=None)


def test_note_too_long_names_the_fixed_limit_never_the_submitted_note() -> None:
    submitted = "x" * 201
    with pytest.raises(NoteTooLong) as excinfo:
        _record(note=submitted)

    assert issubclass(NoteTooLong, SaleRuleBroken)
    assert submitted not in str(excinfo.value)
    assert str(NOTE_MAX_LENGTH) in str(excinfo.value)
