from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.customers.adapters.tables import CustomerRow
from app.customers.application.errors import PhoneTaken
from app.customers.domain.customer import Channel, Customer, CustomerName, PhoneNumber


class SqlCustomers:
    """The `Customers` port over SQLAlchemy, for one business. Every statement filters
    on that business, `phone_taken` included. Writes flush; the use case commits.

    `add` and `save` flush inside `try`; the `except IntegrityError` clause only notes
    that the write was refused, and `PhoneTaken` is raised after the block, with no
    active exception being handled, so it carries no `__cause__` and no `__context__`
    of the driver's message. There is no `rollback`, `commit` or `begin_nested` here:
    the session is left to its owner (`app.db.get_session`), and this translation is
    correct only because `uq_customer_business_phone` is the only constraint valid code
    can break.
    """

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def add(self, customer: Customer) -> Customer:
        row = self._row_from(customer)
        self._session.add(row)
        self._flush_or_mark_taken()
        return _customer(row)

    def get(self, customer_id: int) -> Customer | None:
        row = self._row(customer_id)
        return None if row is None else _customer(row)

    def all(self) -> list[Customer]:
        statement = select(CustomerRow).where(CustomerRow.business_id == self._business_id)
        return [_customer(row) for row in self._session.scalars(statement)]

    def save(self, customer: Customer) -> Customer:
        assert customer.id is not None, "save takes a customer that was added"
        row = self._row(customer.id)
        assert row is not None, "save takes a customer of this business"
        row.name = customer.name.value
        row.phone = customer.phone.value
        row.channel = customer.channel.value if customer.channel else None
        row.vip = customer.vip
        self._flush_or_mark_taken()
        return _customer(row)

    def phone_taken(self, phone: PhoneNumber, *, other_than: int | None = None) -> bool:
        statement = (
            select(func.count())
            .select_from(CustomerRow)
            .where(
                CustomerRow.business_id == self._business_id,
                CustomerRow.phone == phone.value,
            )
        )
        if other_than is not None:
            statement = statement.where(CustomerRow.id != other_than)
        return self._session.scalar(statement) != 0

    def _row(self, customer_id: int) -> CustomerRow | None:
        statement = select(CustomerRow).where(
            CustomerRow.id == customer_id, CustomerRow.business_id == self._business_id
        )
        return self._session.scalar(statement)

    def _row_from(self, customer: Customer) -> CustomerRow:
        return CustomerRow(
            business_id=self._business_id,
            name=customer.name.value,
            phone=customer.phone.value,
            channel=customer.channel.value if customer.channel else None,
            vip=customer.vip,
        )

    def _flush_or_mark_taken(self) -> None:
        taken = False
        try:
            self._session.flush()
        except IntegrityError:
            taken = True
        if taken:
            raise PhoneTaken()


def _customer(row: CustomerRow) -> Customer:
    return Customer(
        name=CustomerName(row.name),
        phone=PhoneNumber(row.phone),
        channel=Channel(row.channel) if row.channel else None,
        vip=row.vip,
        id=row.id,
    )
