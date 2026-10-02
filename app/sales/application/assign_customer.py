"""Assign a customer to a sale that has none (CONTEXT.md: Sale without a customer).

Refusal order: the sale in the path first (404, `SaleNotFound`), then the customer in
the body (422, `UnknownCustomer`), then already-assigned (409,
`CustomerAlreadyAssigned`, raised in-memory by `Sale.assign_customer` and again, as
the authority, by `Sales.assign_customer`'s guarded update)."""

from app.sales.application.errors import SaleNotFound
from app.sales.application.ports import CustomerFacts, Sales
from app.sales.domain.sale import Sale, UnknownCustomer
from app.shared.transaction import Transaction


def assign_customer(
    sales: Sales,
    customer_facts: CustomerFacts,
    transaction: Transaction,
    sale_id: int,
    customer_id: int,
) -> Sale:
    sale = sales.get(sale_id)
    if sale is None:
        raise SaleNotFound()

    customer = customer_facts.get(customer_id)
    if customer is None:
        raise UnknownCustomer()

    sale.assign_customer(customer.id)
    sales.assign_customer(sale_id, customer.id)
    transaction.commit()

    updated = sales.get(sale_id)
    assert updated is not None, "the sale just updated still exists"
    return updated
