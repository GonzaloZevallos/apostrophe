from typing import cast

from sqlalchemy import CursorResult, column, delete, exists, select, table
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypeRow
from app.customer_types.domain.customer_type import (
    CustomerType,
    CustomerTypeIcon,
    CustomerTypeName,
    NameTaken,
)

# The one column of `customer` this hexagon looks at, declared here as a bare table: the
# guarded delete must see customers without importing `app.customers`, which is the
# direction the plan forbids (`customers.adapters` -> `customer_types.adapters` only).
_CUSTOMER = table("customer", column("customer_type_id"))


class SqlCustomerTypes:
    """The `CustomerTypes` port over SQLAlchemy, for one business. Every statement
    filters on that business; a type of another business is, from here, a type that does
    not exist (docs/adr/0004). Writes flush; the use case commits.

    `IntegrityError` is never let through: it would carry SQL. The only unique rule a
    valid write can break is the folded name, so that is what it becomes."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def list(self) -> list[CustomerType]:
        statement = (
            select(CustomerTypeRow)
            .where(CustomerTypeRow.business_id == self._business_id)
            .order_by(CustomerTypeRow.name_key)
        )
        return [_customer_type(row) for row in self._session.scalars(statement)]

    def by_id(self, type_id: int) -> CustomerType | None:
        row = self._row(type_id)
        return None if row is None else _customer_type(row)

    def by_key(self, key: str) -> CustomerType | None:
        statement = select(CustomerTypeRow).where(
            CustomerTypeRow.business_id == self._business_id,
            CustomerTypeRow.name_key == key,
        )
        row = self._session.scalar(statement)
        return None if row is None else _customer_type(row)

    def add(self, customer_type: CustomerType) -> CustomerType:
        row = CustomerTypeRow(
            business_id=self._business_id,
            name=customer_type.name.value,
            name_key=customer_type.name.key,
            icon=customer_type.icon.value,
            is_vip=False,
        )
        self._session.add(row)
        self._flush_or_mark_taken()
        return _customer_type(row)

    def save(self, customer_type: CustomerType) -> CustomerType:
        assert customer_type.id is not None, "save takes a customer type that was added"
        row = self._row(customer_type.id)
        assert row is not None, "save takes a customer type of this business"
        row.name = customer_type.name.value
        row.name_key = customer_type.name.key
        row.icon = customer_type.icon.value
        self._flush_or_mark_taken()
        return _customer_type(row)

    def delete_unused(self, type_id: int) -> bool:
        """One `DELETE ... WHERE NOT EXISTS (customer in the type)`: a customer that
        joins between the count and this statement leaves the row where it is."""
        in_use = exists().where(_CUSTOMER.c.customer_type_id == CustomerTypeRow.id)
        statement = delete(CustomerTypeRow).where(
            CustomerTypeRow.id == type_id,
            CustomerTypeRow.business_id == self._business_id,
            ~in_use,
        )
        result = cast(CursorResult[tuple[object, ...]], self._session.execute(statement))
        return result.rowcount == 1

    def _flush_or_mark_taken(self) -> None:
        try:
            self._session.flush()
        except IntegrityError:
            raise NameTaken() from None

    def _row(self, type_id: int) -> CustomerTypeRow | None:
        statement = select(CustomerTypeRow).where(
            CustomerTypeRow.id == type_id,
            CustomerTypeRow.business_id == self._business_id,
        )
        return self._session.scalar(statement)


def _customer_type(row: CustomerTypeRow) -> CustomerType:
    return CustomerType(
        CustomerTypeName(row.name),
        CustomerTypeIcon(row.icon),
        is_vip=row.is_vip,
        id=row.id,
    )
