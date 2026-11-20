"""The sale bill of one sale (CONTEXT.md: Sale bill): its facts from the one settlement
read the detail already made, or `None` when they cannot be reconciled. Nothing is
logged and nothing is stored."""

from app.sales.application.ports import BusinessNames, CustomerSettlement, SaleView
from app.sales.domain.sale import SaleLine
from app.sales.domain.sale_bill import (
    BillPayment,
    SaleBill,
    SaleBillInconsistent,
    SaleBillLine,
    SalePayment,
    bill_balance,
    bill_payment_of,
    bill_rule,
    sale_payment,
)


def view_payment(view: SaleView, still_owed: int | None) -> SalePayment | None:
    """The Payment state of a labelled sale and the amount still owed on it, or `None`
    when its payment facts cannot be reconciled. `still_owed` is what settlement lists
    for it, `None` when it does not."""
    sale = view.sale
    method = None if sale.payment is None else sale.payment.method
    try:
        return sale_payment(sale.total, method, view.customer is not None, still_owed)
    except SaleBillInconsistent:
        return None


def sale_bill(
    view: SaleView, settlement: CustomerSettlement, business_names: BusinessNames
) -> SaleBill | None:
    """The bill from one settlement read, deciding the payment from it."""
    sale_id = view.sale.id
    still_owed = None if sale_id is None else settlement.still_owed.get(sale_id)
    return sale_bill_of(view, view_payment(view, still_owed), settlement.balance, business_names)


def sale_bill_of(
    view: SaleView, payment: SalePayment | None, balance: int, business_names: BusinessNames
) -> SaleBill | None:
    """The bill of a sale whose payment is already decided; `None` for a payment that
    could not be reconciled."""
    if payment is None:
        return None
    sale = view.sale
    bill_payment = BillPayment("none", None) if sale.total == 0 else bill_payment_of(payment)
    # The name is read only once the payment facts pass.
    business_name = business_names.current()
    if business_name is None:
        return None
    return SaleBill(
        business_name=business_name,
        number=view.number,
        date=sale.date,
        shipping_charged=sale.shipping_charged,
        total=sale.total,
        lines=tuple(_bill_line(line.line, line.variety_name) for line in view.lines),
        payment=bill_payment,
        balance=bill_balance(view.customer is not None, balance),
    )


def _bill_line(line: SaleLine, product: str) -> SaleBillLine:
    rule = bill_rule(line.pricing_rule)
    return SaleBillLine(
        product=product,
        quantity=line.quantity,
        amount=line.line_total,
        rule=rule,
        unit_price=line.price_per_gram if rule == "bulk" else None,
    )
