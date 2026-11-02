from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow


class SqlCustomersInType:
    """The `CustomersInType` port of `customer_types`, for one business: how many of
    its customers are in a type. Walks `ix_customer_customer_type_id`, never the whole
    customer table. The dependency runs this way (`customers.adapters` knows
    `customer_types`) and `customer_types` receives it from `app.main`."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def count(self, type_id: int) -> int:
        statement = (
            select(func.count())
            .select_from(CustomerRow)
            .where(
                CustomerRow.business_id == self._business_id,
                CustomerRow.customer_type_id == type_id,
            )
        )
        return self._session.scalar(statement) or 0
