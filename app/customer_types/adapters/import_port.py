"""`VipTypeImport` (`app.spreadsheet_import.application.ports`): the business's VIP type
for the spreadsheet import (docs/adr/0070). The VIP type is the row marked `is_vip`; the
fixed name 'VIP' is only what a created one is called, and what a refusal looks for."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypeRow
from app.customer_types.adapters.vip_type import SqlVipType
from app.customer_types.domain.customer_type import CustomerTypeIcon, CustomerTypeName
from app.shared.transaction import Transaction

VIP_TYPE_NAME = CustomerTypeName("VIP")
VIP_TYPE_ICON = CustomerTypeIcon.STAR


class VipTypeImport:
    """The `VipTypeImport` port, for one business."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def has_vip_type(self) -> bool:
        return SqlVipType(self._session, self._business_id).id() is not None

    def vip_name_taken(self) -> bool:
        statement = (
            select(func.count())
            .select_from(CustomerTypeRow)
            .where(
                CustomerTypeRow.business_id == self._business_id,
                CustomerTypeRow.name_key == VIP_TYPE_NAME.key,
            )
        )
        return self._session.scalar(statement) != 0

    def ensure_vip_type(self, transaction: Transaction) -> int:
        existing = SqlVipType(self._session, self._business_id).id()
        if existing is not None:
            return existing
        row = CustomerTypeRow(
            business_id=self._business_id,
            name=VIP_TYPE_NAME.value,
            name_key=VIP_TYPE_NAME.key,
            icon=VIP_TYPE_ICON.value,
            is_vip=True,
        )
        self._session.add(row)
        self._session.flush()
        transaction.commit()
        return row.id
