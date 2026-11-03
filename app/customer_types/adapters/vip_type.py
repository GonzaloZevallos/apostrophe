from sqlalchemy import select
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypeRow


class SqlVipType:
    """The id of the business's VIP type, or `None` when it has none (docs/adr/0070).
    One indexed read through the partial unique index on `is_vip`; a reader of VIP
    membership asks once per request and compares each row's `customer_type_id` to it."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def id(self) -> int | None:
        statement = select(CustomerTypeRow.id).where(
            CustomerTypeRow.business_id == self._business_id,
            CustomerTypeRow.is_vip.is_(True),
        )
        return self._session.scalar(statement)
