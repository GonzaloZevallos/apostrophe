"""`CustomerFacts` over `SqlCustomers` (docs/adr/0004): built for one business, so a
customer of another business reads back as none."""

from sqlalchemy.orm import Session

from app.customers.adapters.sql_customers import SqlCustomers
from app.sales.domain.sale import CustomerFact


class SqlCustomerFacts:
    def __init__(self, session: Session, business_id: int) -> None:
        self._customers = SqlCustomers(session, business_id)

    def get(self, customer_id: int) -> CustomerFact | None:
        customer = self._customers.get(customer_id)
        if customer is None or customer.id is None:
            return None
        return CustomerFact(id=customer.id, vip=customer.vip)
