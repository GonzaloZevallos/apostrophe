"""`CustomerFacts` for one business (docs/adr/0004): a customer of another business reads
back as none. The customer's type is read with its current name in one joined statement
filtered on the business (docs/adr/0059); the frozen `customer.is_vip` is not read."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypeRow
from app.customers.adapters.tables import CustomerRow
from app.sales.domain.pricing import CustomerTypeFact
from app.sales.domain.sale import CustomerFact


class SqlCustomerFacts:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def get(self, customer_id: int) -> CustomerFact | None:
        statement = (
            select(CustomerRow.id, CustomerTypeRow.id, CustomerTypeRow.name)
            .outerjoin(
                CustomerTypeRow,
                (CustomerTypeRow.id == CustomerRow.customer_type_id)
                & (CustomerTypeRow.business_id == self._business_id),
            )
            .where(CustomerRow.id == customer_id, CustomerRow.business_id == self._business_id)
        )
        found = self._session.execute(statement).first()
        if found is None:
            return None
        _, type_id, type_name = found
        return CustomerFact(
            id=customer_id,
            customer_type=None if type_id is None else CustomerTypeFact(id=type_id, name=type_name),
        )
