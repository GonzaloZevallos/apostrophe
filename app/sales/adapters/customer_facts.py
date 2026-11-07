"""`CustomerFacts` for one business (docs/adr/0004): a customer of another business reads
back as none. Whether a customer is VIP is membership in the business's VIP type
(docs/adr/0070), asked once through `SqlVipType`; the frozen `customer.vip` is not read."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.customer_types.adapters.vip_type import SqlVipType
from app.customers.adapters.tables import CustomerRow
from app.sales.domain.sale import CustomerFact


class SqlCustomerFacts:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id
        self._vip_type = SqlVipType(session, business_id)

    def get(self, customer_id: int) -> CustomerFact | None:
        type_id = self._session.execute(
            select(CustomerRow.id, CustomerRow.customer_type_id).where(
                CustomerRow.id == customer_id, CustomerRow.business_id == self._business_id
            )
        ).first()
        if type_id is None:
            return None
        _, customer_type_id = type_id
        vip_id = self._vip_type.id()
        return CustomerFact(
            id=customer_id, vip=customer_type_id is not None and customer_type_id == vip_id
        )
