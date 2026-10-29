"""`sale_bill` over a `SaleView` built through the domain constructors, no rows, and an
in-test `BusinessNames` fake. Case 3 (no customer, total above $0, not paid on the spot)
has no HTTP test, because `record_sale` refuses to store such a sale; it is covered here.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from app.sales.application.ports import (
    CustomerSettlement,
    SaleView,
    SaleViewCustomer,
    SaleViewLine,
)
from app.sales.application.sale_bill import sale_bill
from app.sales.domain.pricing import PricingRule
from app.sales.domain.sale import OnTheSpotPayment, PaymentMethod, Sale, SaleLine
from app.sales.domain.sale_bill import BillPayment, SaleBill, SaleBillLine
from app.shared.quantity import Quantity

SALE_ID = 7
CUSTOMER = SaleViewCustomer(id=3, name="Juana", vip=True)


class FakeNames:
    def __init__(self, name: str | None) -> None:
        self._name = name
        self.reads = 0

    def current(self) -> str | None:
        self.reads += 1
        return self._name


def _view(
    *, customer: bool = True, method: PaymentMethod | None = None, shipping: int = 500
) -> SaleView:
    lines = (
        SaleLine(1, Quantity.of("2.5"), PricingRule.BULK, 3_000, 7_500, id=11),
        SaleLine(2, Quantity.of(1), PricingRule.GIFT, 0, 0, id=12),
        SaleLine(3, Quantity.of("0.5"), PricingRule.VIP, 4_000, 2_000, id=13),
    )
    total = 9_500 + shipping
    sale = Sale(
        date=date(2026, 6, 1),
        customer_id=CUSTOMER.id if customer else None,
        shipping_charged=shipping,
        note="a private note",
        lines=lines,
        payment=None
        if method is None
        else OnTheSpotPayment(date(2026, 6, 1), total, method, CUSTOMER.id if customer else None),
        recorded_at=datetime(2026, 6, 1, tzinfo=UTC),
        id=SALE_ID,
    )
    return SaleView(
        sale=sale,
        customer=CUSTOMER if customer else None,
        lines=tuple(
            SaleViewLine(line, name)
            for line, name in zip(lines, ("Lavanda", "Romero", "Menta"), strict=True)
        ),
    )


def test_a_consistent_owed_sale_gives_the_whole_bill() -> None:
    names = FakeNames("Mi Negocio")

    bill = sale_bill(_view(), CustomerSettlement(12_000, {SALE_ID: 10_000}), names)

    assert bill == SaleBill(
        business_name="Mi Negocio",
        date=date(2026, 6, 1),
        shipping_charged=500,
        total=10_000,
        lines=(
            SaleBillLine("Lavanda", Quantity.of("2.5"), 7_500, "bulk", 3_000),
            SaleBillLine("Romero", Quantity.of(1), 0, "gift", None),
            SaleBillLine("Menta", Quantity.of("0.5"), 2_000, None, None),
        ),
        payment=BillPayment("owed", 10_000),
        balance=12_000,
    )


def test_a_sale_without_a_customer_paid_on_the_spot_has_no_balance() -> None:
    bill = sale_bill(
        _view(customer=False, method=PaymentMethod.CASH),
        CustomerSettlement(0, {}),
        FakeNames("Mi Negocio"),
    )

    assert bill is not None
    assert bill.payment == BillPayment("cash", None)
    assert bill.balance is None


def test_case_2_paid_on_the_spot_yet_owed_gives_no_bill_and_reads_no_name() -> None:
    names = FakeNames("Mi Negocio")

    bill = sale_bill(_view(method=PaymentMethod.CASH), CustomerSettlement(50, {SALE_ID: 50}), names)

    assert bill is None
    assert names.reads == 0


def test_case_3_no_customer_and_not_paid_on_the_spot_gives_no_bill() -> None:
    names = FakeNames("Mi Negocio")

    assert sale_bill(_view(customer=False), CustomerSettlement(0, {}), names) is None
    assert names.reads == 0


def test_case_6_a_customers_sale_missing_from_settlement_gives_no_bill() -> None:
    names = FakeNames("Mi Negocio")

    assert sale_bill(_view(), CustomerSettlement(0, {SALE_ID + 1: 5}), names) is None
    assert names.reads == 0


def test_a_business_name_that_cannot_be_read_gives_no_bill() -> None:
    names = FakeNames(None)

    assert sale_bill(_view(), CustomerSettlement(0, {SALE_ID: 0}), names) is None
    assert names.reads == 1
