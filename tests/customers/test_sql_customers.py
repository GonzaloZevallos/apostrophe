"""`SqlCustomers` over a real database: the seam where an `IntegrityError` on the one
constraint the table carries becomes `PhoneTaken`, with no rollback, no savepoint and no
exception chain exposing the driver's message (CODING_STANDARDS 9, ADR-0005)."""

from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.customers.adapters.sql_customers import SqlCustomers
from app.customers.application.errors import PhoneTaken
from app.customers.domain.customer import Customer, CustomerName, PhoneNumber
from app.db import make_engine
from app.migrations.runner import upgrade_to_head


def _session() -> Session:
    engine = make_engine("sqlite://")
    upgrade_to_head(engine)
    return Session(engine)


def _customer(name: str, phone: str) -> Customer:
    return Customer(name=CustomerName.of(name), phone=PhoneNumber.of(phone))


def test_a_second_customer_with_the_same_phone_is_refused_as_phone_taken() -> None:
    session = _session()
    business = BusinessRow(name="Negocio")
    session.add(business)
    session.flush()
    customers = SqlCustomers(session, business.id)
    customers.add(_customer("Fran Araujo", "11 2345-6789"))

    try:
        customers.add(_customer("Otro Fran", "+54 9 11 2345 6789"))
    except PhoneTaken as exc:
        # Raised outside the `except IntegrityError` block: no exception chain carries
        # the driver's message, which could otherwise leak the phone number.
        assert exc.__cause__ is None
        assert exc.__context__ is None
    else:
        raise AssertionError("expected PhoneTaken")


def test_the_same_phone_in_two_businesses_is_not_taken() -> None:
    session = _session()
    one = BusinessRow(name="Uno")
    other = BusinessRow(name="Otro")
    session.add_all([one, other])
    session.flush()
    SqlCustomers(session, one.id).add(_customer("Fran Araujo", "11 2345-6789"))

    stored = SqlCustomers(session, other.id).add(_customer("Fran Araujo", "11 2345-6789"))

    assert stored.id is not None
