from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.customers.adapters.customer_type_lookup import SqlCustomerTypeLookup
from app.customers.adapters.tables import CustomerRow
from app.customers.application.errors import PhoneTaken
from app.customers.application.ports import CustomerTypes
from app.customers.domain.customer import Customer, CustomerName, PhoneNumber


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

    def __init__(
        self, session: Session, business_id: int, types: CustomerTypes | None = None
    ) -> None:
        self._session = session
        self._business_id = business_id
        # Where the VIP type id comes from, read at most once per instance: a customer is
        # VIP when its type is that one (docs/adr/0070). The request hands its own lookup
        # in so the other readers of the request share the read.
        self._types = types if types is not None else SqlCustomerTypeLookup(session, business_id)

    def add(self, customer: Customer) -> Customer:
        row = self._row_from(customer)
        self._session.add(row)
        self._flush_or_mark_taken()
        return _customer(row, self._types.vip_type_id())

    def get(self, customer_id: int) -> Customer | None:
        row = self._row(customer_id)
        return None if row is None else _customer(row, self._types.vip_type_id())

    def all(self) -> list[Customer]:
        statement = select(CustomerRow).where(CustomerRow.business_id == self._business_id)
        vip_type_id = self._types.vip_type_id()
        return [_customer(row, vip_type_id) for row in self._session.scalars(statement)]

    def save(self, customer: Customer) -> Customer:
        assert customer.id is not None, "save takes a customer that was added"
        row = self._row(customer.id)
        assert row is not None, "save takes a customer of this business"
        row.name = customer.name.value
        row.phone = customer.phone.value if customer.phone is not None else None
        row.customer_type_id = customer.customer_type_id
        self._flush_or_mark_taken()
        return _customer(row, self._types.vip_type_id())

    def phone_taken(self, phone: PhoneNumber, *, other_than: int | None = None) -> bool:
        """Called only for a non-`None` phone (the use cases' own rule): a customer
        with no phone never collides, and SQLite's unique constraint already treats
        every `NULL` as distinct from every other, so this never has to special-case
        it."""
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
            phone=customer.phone.value if customer.phone is not None else None,
            customer_type_id=customer.customer_type_id,
        )

    def _flush_or_mark_taken(self) -> None:
        taken = False
        try:
            self._session.flush()
        except IntegrityError:
            taken = True
        if taken:
            raise PhoneTaken()


def _customer(row: CustomerRow, vip_type_id: int | None) -> Customer:
    """`vip` is membership in the business's VIP type; the frozen `customer.vip` column
    is never read (docs/adr/0070)."""
    return Customer(
        name=CustomerName(row.name),
        phone=PhoneNumber(row.phone) if row.phone is not None else None,
        vip=vip_type_id is not None and row.customer_type_id == vip_type_id,
        id=row.id,
        customer_type_id=row.customer_type_id,
    )
