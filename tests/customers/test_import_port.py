"""`CustomersImport` (app/customers/adapters/import_port.py): the
`app.spreadsheet_import.application.ports.CustomersImport` port, over a real database,
so an imported customer is written through the same rule as one entered by hand.

Businesses come from the `client` fixture over HTTP (CODING_STANDARDS 5); only the
port call under test goes straight to the adapter, the way `test_sql_customers.py`
goes straight to `SqlCustomers`.
"""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import UserRow
from app.customers.adapters.import_port import CustomersImport
from app.customers.adapters.sql_customers import SqlCustomers
from app.spreadsheet_import.application.no_commit import NoCommit
from app.spreadsheet_import.application.ports import CustomerKey, Refusal


def _business_id_of_email(engine: Engine, email: str) -> int:
    with Session(engine) as session:
        row = session.scalar(select(UserRow).where(UserRow.email == email))
        assert row is not None
        return row.business_id


# -- has_records ----------------------------------------------------------------------


def test_has_records_is_false_for_a_fresh_business(client: TestClient, engine: Engine) -> None:
    business_id = _business_id_of_email(engine, "uno@example.com")
    port = CustomersImport(Session(engine), business_id)

    assert port.has_records() is False


def test_has_records_is_true_once_the_business_has_a_customer(
    client: TestClient, engine: Engine
) -> None:
    client.post("/customers", json={"name": "Fran Araujo", "phone": "11 2345-6789"})
    business_id = _business_id_of_email(engine, "uno@example.com")
    port = CustomersImport(Session(engine), business_id)

    assert port.has_records() is True


# -- check_customer: the normalisation matrix ------------------------------------------


def test_the_normalisation_matrix_all_give_one_key(client: TestClient, engine: Engine) -> None:
    business_id = _business_id_of_email(engine, "uno@example.com")
    port = CustomersImport(Session(engine), business_id)

    raws = [
        "11 2345-6789",
        "011 15 2345-6789",
        "+54 9 11 2345 6789",
        "5491123456789",
        "541123456789",
    ]
    keys: set[str] = set()
    for raw in raws:
        result = port.check_customer("Fran Araujo", raw)
        assert isinstance(result, CustomerKey)
        keys.add(result.phone_key)

    assert keys == {"+5491123456789"}


# -- check_customer: an invalid number ------------------------------------------------


def test_an_invalid_number_is_refused_with_its_own_code(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id_of_email(engine, "uno@example.com")
    port = CustomersImport(Session(engine), business_id)

    result = port.check_customer("Fran Araujo", "abc")

    assert isinstance(result, Refusal)
    assert result.code == "customer.phone_invalid"


def test_a_phone_refusal_never_carries_a_digit_of_what_was_typed(
    client: TestClient, engine: Engine
) -> None:
    business_id = _business_id_of_email(engine, "uno@example.com")
    port = CustomersImport(Session(engine), business_id)

    result = port.check_customer("Fran Araujo", "11 2345 678")

    assert isinstance(result, Refusal)
    assert not any(c.isdigit() for c in result.code)


# -- write_customer ---------------------------------------------------------------------


def test_write_customer_stores_the_vip_flag(client: TestClient, engine: Engine) -> None:
    business_id = _business_id_of_email(engine, "uno@example.com")
    session = Session(engine)
    port = CustomersImport(session, business_id)

    customer_id = port.write_customer("Fran Araujo", "+5491123456789", True, NoCommit())

    stored = SqlCustomers(session, business_id).get(customer_id)
    assert stored is not None
    assert stored.vip is True
    assert stored.name.value == "Fran Araujo"
    assert stored.phone.value == "+5491123456789"


def test_write_customer_without_vip_stores_it_false(client: TestClient, engine: Engine) -> None:
    business_id = _business_id_of_email(engine, "uno@example.com")
    session = Session(engine)
    port = CustomersImport(session, business_id)

    customer_id = port.write_customer("Zoe", "+5491198765432", False, NoCommit())

    stored = SqlCustomers(session, business_id).get(customer_id)
    assert stored is not None
    assert stored.vip is False
