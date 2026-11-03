"""`SqlCustomerTypes` over a real database: the guarded delete is one statement that
deletes nothing when a customer is in the type, so a customer that joins between the
count and the delete is never left without a type.

Businesses come from the `client`/`other_client` fixtures over HTTP; only the repository
call under test goes straight to `SqlCustomerTypes`."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customer_types.adapters.sql_customer_types import SqlCustomerTypes
from app.customer_types.adapters.tables import CustomerTypeRow
from app.customer_types.adapters.vip_type import SqlVipType
from app.customer_types.application import manage_customer_types
from app.customer_types.domain.customer_type import CustomerTypeInUse
from app.customers.adapters.customers_in_type import SqlCustomersInType
from app.customers.adapters.tables import CustomerRow


def _business_of(engine: Engine, type_id: int) -> int:
    with Session(engine) as session:
        row = session.get(CustomerTypeRow, type_id)
        assert row is not None
        return row.business_id


def _join(engine: Engine, type_id: int) -> None:
    with Session(engine) as session:
        session.add(
            CustomerRow(
                business_id=_business_of(engine, type_id), name="Joiner", customer_type_id=type_id
            )
        )
        session.commit()


def test_the_guarded_delete_removes_an_empty_type_and_keeps_one_with_a_customer(
    client: TestClient, engine: Engine
) -> None:
    empty = client.post("/api/customer-types", json={"name": "Empty"}).json()["id"]
    used = client.post("/api/customer-types", json={"name": "Used"}).json()["id"]
    _join(engine, used)

    with Session(engine) as session:
        types = SqlCustomerTypes(session, _business_of(engine, used))
        kept = types.delete_unused(used)
        removed = types.delete_unused(empty)
        session.commit()

    assert (kept, removed) == (False, True)
    assert [t["name"] for t in client.get("/api/customer-types").json()] == ["Used"]


def test_the_guarded_delete_never_reaches_a_type_of_another_business(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    mine = client.post("/api/customer-types", json={"name": "Mine"}).json()["id"]
    other_type = other_client.post("/api/customer-types", json={"name": "Theirs"}).json()["id"]

    with Session(engine) as session:
        deleted = SqlCustomerTypes(session, _business_of(engine, other_type)).delete_unused(mine)
        session.commit()

    assert deleted is False
    assert [t["name"] for t in client.get("/api/customer-types").json()] == ["Mine"]


def test_a_customer_joining_after_the_count_makes_the_delete_refuse_with_a_fresh_count(
    client: TestClient, engine: Engine
) -> None:
    type_id = client.post("/api/customer-types", json={"name": "Racy"}).json()["id"]
    business_id = _business_of(engine, type_id)

    with Session(engine) as session:
        real = SqlCustomersInType(session, business_id)

        class StaleThenReal:
            """Counts 0 the first time, as if read before the customer joined."""

            def __init__(self) -> None:
                self.calls = 0

            def count(self, type_id: int) -> int:
                self.calls += 1
                if self.calls == 1:
                    _join(engine, type_id)
                    return 0
                return real.count(type_id)

        with pytest.raises(CustomerTypeInUse) as refused:
            manage_customer_types.delete_customer_type(
                SqlCustomerTypes(session, business_id),
                StaleThenReal(),
                session,
                type_id,
            )

    assert refused.value.count == 1
    assert [t["name"] for t in client.get("/api/customer-types").json()] == ["Racy"]


def test_the_vip_type_is_read_by_its_mark_for_its_own_business_only(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    gold = client.post("/api/customer-types", json={"name": "VIP"}).json()["id"]
    other_type = other_client.post("/api/customer-types", json={"name": "Other"}).json()["id"]
    mine, theirs = _business_of(engine, gold), _business_of(engine, other_type)

    with Session(engine) as session:
        before = SqlVipType(session, mine).id()
        row = session.get(CustomerTypeRow, gold)
        assert row is not None
        row.is_vip = True
        session.commit()
        after = SqlVipType(session, mine).id()
        others = SqlVipType(session, theirs).id()

    # The seller's type named "VIP" is not the VIP type until the mark says so.
    assert (before, after, others) == (None, gold, None)
