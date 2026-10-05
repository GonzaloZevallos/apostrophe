"""`CustomersImport` (`app.spreadsheet_import.application.ports`), so an imported
customer is registered through the same rule — `register_customer` — as one entered by
hand (CODING_STANDARDS section 1; the plan's invariant: an owner's import adapter
writes only its own hexagon's tables).

`check_customer` never lets a phone number or a customer name reach this module's
return value: on a broken rule (`CustomerRuleBroken`) it answers only the rule's own
`code`, never the exception, so a caller that mishandles the result still can't print
what was typed.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.customers.adapters.sql_customers import SqlCustomers
from app.customers.adapters.tables import CustomerRow
from app.customers.application.manage_customers import register_customer
from app.customers.domain.customer import CustomerName, CustomerRuleBroken, PhoneNumber
from app.shared.transaction import Transaction
from app.spreadsheet_import.application.ports import CustomerKey, CustomerRefusals


class CustomersImport:
    """The `CustomersImport` port, for one business."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def has_records(self) -> bool:
        statement = (
            select(func.count())
            .select_from(CustomerRow)
            .where(CustomerRow.business_id == self._business_id)
        )
        return self._session.scalar(statement) != 0

    def check_customer(self, name: str, phone: str | None) -> CustomerKey | CustomerRefusals:
        name_code = None
        try:
            CustomerName.of(name)
        except CustomerRuleBroken as broken:
            name_code = broken.code

        phone_code = None
        normalised: PhoneNumber | None = None
        try:
            normalised = PhoneNumber.optional(phone)
        except CustomerRuleBroken as broken:
            phone_code = broken.code

        if name_code is not None or phone_code is not None:
            return CustomerRefusals(name_code=name_code, phone_code=phone_code)
        return CustomerKey(phone_key=normalised.value if normalised is not None else None)

    def write_customer(
        self, name: str, phone_key: str | None, vip: bool, transaction: Transaction
    ) -> int:
        customers = SqlCustomers(self._session, self._business_id)
        customer = register_customer(
            customers,
            transaction,
            name=name,
            phone=phone_key,
            channel=None,
            vip=vip,
        )
        assert customer.id is not None, "register_customer stores the customer and its id"
        return customer.id
