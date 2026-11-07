"""`CustomerTypes` (`app.customers.application.ports`) over `customer_types.adapters`,
the one direction the dependency runs (`customers.adapters` -> `customer_types.adapters`).
Built for one business: a type of another business does not exist for it."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypeRow
from app.customer_types.adapters.vip_type import SqlVipType


class SqlCustomerTypeLookup:
    """Whether a type id is this business's, and which type is its VIP type. The VIP type
    id is read once per instance, and an instance lives for one request, so every reader
    of VIP membership in that request shares one read (`SqlVipType`)."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id
        self._vip = SqlVipType(session, business_id)
        self._vip_read = False
        self._vip_id: int | None = None

    def exists(self, type_id: int) -> bool:
        statement = (
            select(func.count())
            .select_from(CustomerTypeRow)
            .where(
                CustomerTypeRow.id == type_id,
                CustomerTypeRow.business_id == self._business_id,
            )
        )
        return self._session.scalar(statement) != 0

    def vip_type_id(self) -> int | None:
        if not self._vip_read:
            self._vip_id = self._vip.id()
            self._vip_read = True
        return self._vip_id
