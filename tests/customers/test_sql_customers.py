"""`SqlCustomers` over a real database: the seam where an `IntegrityError` on the one
constraint the table carries becomes `PhoneTaken`, with no rollback, no savepoint and no
exception chain exposing the driver's message (CODING_STANDARDS 9, ADR-0005).

Businesses come from the `client`/`other_client` fixtures over HTTP, never from a
hand-built row (CODING_STANDARDS 5); only the repository call under test — the one the
HTTP layer cannot show the exception chain of — goes straight to `SqlCustomers`.
"""

from fastapi.testclient import TestClient
from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customers.adapters.sql_customers import SqlCustomers
from app.customers.adapters.tables import CustomerRow
from app.customers.application.errors import PhoneTaken
from app.customers.domain.customer import Customer, CustomerName, PhoneNumber
from app.migrations.runner import upgrade_to_head


def _customer(name: str, phone: str) -> Customer:
    return Customer(name=CustomerName.of(name), phone=PhoneNumber.of(phone))


def _business_id_of(engine: Engine, customer_id: int) -> int:
    with Session(engine) as session:
        row = session.get(CustomerRow, customer_id)
        assert row is not None
        return row.business_id


def test_the_customer_table_has_no_constraint_other_than_the_phone_uniqueness(
    engine: Engine,
) -> None:
    """Pins the table `SqlCustomers._flush_or_mark_taken` relies on: translating an
    `IntegrityError` straight into `PhoneTaken` is only correct because
    `uq_customer_business_phone` is the only unique or check constraint a valid write
    can break. A second constraint added to the table (and the migration) without
    changing the repository would make this test fail first."""
    upgrade_to_head(engine)

    inspector = inspect(engine)

    assert [c["name"] for c in inspector.get_unique_constraints("customer")] == [
        "uq_customer_business_phone"
    ]
    assert inspector.get_check_constraints("customer") == []


def test_a_second_customer_with_the_same_phone_is_refused_as_phone_taken(
    client: TestClient, engine: Engine
) -> None:
    registered = client.post(
        "/customers", json={"name": "Fran Araujo", "phone": "11 2345-6789"}
    ).json()
    business_id = _business_id_of(engine, registered["id"])
    customers = SqlCustomers(Session(engine), business_id)

    try:
        customers.add(_customer("Otro Fran", "+54 9 11 2345 6789"))
    except PhoneTaken as exc:
        # Raised outside the `except IntegrityError` block: no exception chain carries
        # the driver's message, which could otherwise leak the phone number.
        assert exc.__cause__ is None
        assert exc.__context__ is None
    else:
        raise AssertionError("expected PhoneTaken")


def test_the_same_phone_in_two_businesses_is_not_taken(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    client.post("/customers", json={"name": "Fran Araujo", "phone": "11 2345-6789"})
    other = other_client.post(
        "/customers", json={"name": "Otro Fran", "phone": "11 1111-1111"}
    ).json()
    other_business_id = _business_id_of(engine, other["id"])

    stored = SqlCustomers(Session(engine), other_business_id).add(
        _customer("Fran Araujo", "11 2345-6789")
    )

    assert stored.id is not None
