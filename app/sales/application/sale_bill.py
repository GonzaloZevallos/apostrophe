"""The sale bill of one sale (CONTEXT.md: Sale bill): its facts from the one settlement
read the detail already made, or `None` when they cannot be reconciled. Nothing is
logged and nothing is stored."""

from app.sales.application.ports import BusinessNames, CustomerSettlement, SaleView
from app.sales.domain.sale import SaleLine
from app.sales.domain.sale_bill import (
    SaleBill,
    SaleBillInconsistent,
    SaleBillLine,
    bill_balance,
    bill_payment,
    bill_rule,
)


def sale_bill(
    view: SaleView, settlement: CustomerSettlement, business_names: BusinessNames
) -> SaleBill | None:
    sale = view.sale
    has_customer = view.customer is not None
    still_owed = None if sale.id is None else settlement.still_owed.get(sale.id)
    method = None if sale.payment is None else sale.payment.method
    try:
        payment = bill_payment(sale.total, method, has_customer, still_owed)
        balance = bill_balance(has_customer, settlement.balance)
    except SaleBillInconsistent:
        return None
    # The name is read only once the payment facts pass.
    business_name = business_names.current()
    if business_name is None:
        return None
    return SaleBill(
        business_name=business_name,
        date=sale.date,
        shipping_charged=sale.shipping_charged,
        total=sale.total,
        lines=tuple(_bill_line(line.line, line.variety_name) for line in view.lines),
        payment=payment,
        balance=balance,
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
