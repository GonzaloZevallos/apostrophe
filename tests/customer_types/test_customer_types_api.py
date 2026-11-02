"""Customer types through the HTTP API, over a real database (CODING_STANDARDS 5).

Membership is set straight on the row: the Customer API does not carry a type yet in
this subtask, and what is under test here is how the type's own routes see members."""

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypeRow
from app.customers.adapters.tables import CustomerRow
from tests.pricing_switches import set_switches


def _create(client: TestClient, name: str = "Regulars", **rest: Any) -> dict[str, Any]:
    response = client.post("/api/customer-types", json={"name": name, **rest})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def _put_customers_in(engine: Engine, type_id: int, how_many: int) -> None:
    with Session(engine) as session:
        ids = []
        for n in range(how_many):
            row = CustomerRow(business_id=_business_of_type(session, type_id), name=f"C{n}")
            session.add(row)
            session.flush()
            ids.append(row.id)
        session.execute(
            update(CustomerRow).where(CustomerRow.id.in_(ids)).values(customer_type_id=type_id)
        )
        session.commit()


def _business_of_type(session: Session, type_id: int) -> int:
    row = session.get(CustomerTypeRow, type_id)
    assert row is not None
    return row.business_id


def test_a_created_type_comes_back_with_its_icon_and_is_not_the_vip_type(
    client: TestClient,
) -> None:
    created = _create(client, "  Regulars ", icon="heart")

    assert created["name"] == "Regulars"
    assert created["icon"] == "heart"
    assert created["is_vip"] is False
    assert client.get("/api/customer-types").json() == [created]


def test_a_type_with_no_icon_gets_the_neutral_default(client: TestClient) -> None:
    assert _create(client)["icon"] == "circle"


def test_posting_is_vip_true_still_yields_a_type_that_is_not_vip(client: TestClient) -> None:
    created = _create(client, "Sneaky", is_vip=True)

    assert created["is_vip"] is False


def test_a_type_is_renamed_and_its_icon_changed(client: TestClient) -> None:
    created = _create(client)

    renamed = client.patch(f"/api/customer-types/{created['id']}", json={"name": "Friends"})
    iconed = client.patch(f"/api/customer-types/{created['id']}", json={"icon": "crown"})

    assert renamed.json() == {**created, "name": "Friends"}
    assert iconed.json() == {**created, "name": "Friends", "icon": "crown"}
    assert client.get("/api/customer-types").json() == [iconed.json()]


def test_a_duplicate_name_is_refused_folding_case_and_spaces_on_create(
    client: TestClient,
) -> None:
    _create(client, "Regular Folks")

    again = client.post("/api/customer-types", json={"name": " regular   FOLKS "})

    assert again.status_code == 409
    assert again.json()["code"] == "customer_type.name_taken"


def test_a_duplicate_name_is_refused_on_rename_but_keeping_the_own_name_is_not(
    client: TestClient,
) -> None:
    _create(client, "Regulars")
    second = _create(client, "Friends")

    clash = client.patch(f"/api/customer-types/{second['id']}", json={"name": "REGULARS"})
    same = client.patch(f"/api/customer-types/{second['id']}", json={"name": "friends"})

    assert clash.status_code == 409
    assert clash.json()["code"] == "customer_type.name_taken"
    assert same.status_code == 200
    assert same.json()["name"] == "friends"


def test_a_blank_name_is_refused(client: TestClient) -> None:
    response = client.post("/api/customer-types", json={"name": "   "})

    assert response.status_code == 422
    assert response.json()["code"] == "customer_type.name_blank"


def test_a_name_of_41_characters_is_refused_and_40_is_not(client: TestClient) -> None:
    too_long = client.post("/api/customer-types", json={"name": "x" * 41})
    fits = client.post("/api/customer-types", json={"name": "x" * 40})

    assert too_long.status_code == 422
    assert too_long.json()["code"] == "customer_type.name_too_long"
    assert fits.status_code == 201


def test_an_unknown_icon_is_refused_on_create_and_on_change(client: TestClient) -> None:
    created = _create(client)

    on_create = client.post("/api/customer-types", json={"name": "Other", "icon": "rose"})
    on_change = client.patch(f"/api/customer-types/{created['id']}", json={"icon": "rose"})

    for response in (on_create, on_change):
        assert response.status_code == 422
        assert response.json()["code"] == "customer_type.icon_unknown"


def test_a_type_with_members_cannot_be_deleted_and_the_refusal_counts_them(
    client: TestClient, engine: Engine
) -> None:
    created = _create(client)
    _put_customers_in(engine, created["id"], 3)

    response = client.delete(f"/api/customer-types/{created['id']}")

    assert response.status_code == 409
    assert response.json()["code"] == "customer_type.in_use"
    assert response.json()["count"] == 3
    assert client.get("/api/customer-types").json() == [created]


def test_an_empty_type_is_deleted(client: TestClient) -> None:
    created = _create(client)

    assert client.delete(f"/api/customer-types/{created['id']}").status_code == 204
    assert client.get("/api/customer-types").json() == []
    assert client.delete(f"/api/customer-types/{created['id']}").status_code == 404


def test_the_vip_type_is_deleted_when_it_has_no_members(client: TestClient, engine: Engine) -> None:
    created = _create(client, "Gold")
    with Session(engine) as session:
        row = session.get(CustomerTypeRow, created["id"])
        assert row is not None
        row.is_vip = True
        session.commit()
    assert client.get("/api/customer-types").json()[0]["is_vip"] is True

    assert client.delete(f"/api/customer-types/{created['id']}").status_code == 204


def test_a_type_of_another_business_answers_404_on_every_route(
    client: TestClient, other_client: TestClient
) -> None:
    mine = _create(client)
    path = f"/api/customer-types/{mine['id']}"

    assert other_client.patch(path, json={"name": "Stolen"}).status_code == 404
    assert other_client.patch(path, json={"icon": "star"}).status_code == 404
    assert other_client.delete(path).status_code == 404
    assert other_client.get("/api/customer-types").json() == []
    assert client.get("/api/customer-types").json() == [mine]


def test_the_same_name_in_two_businesses_is_not_a_clash(
    client: TestClient, other_client: TestClient
) -> None:
    _create(client, "Regulars")

    assert other_client.post("/api/customer-types", json={"name": "Regulars"}).status_code == 201


def test_the_routes_answer_the_same_with_the_switch_on_and_off(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=False)
    off = _create(client, "Off")
    listed_off = client.get("/api/customer-types").json()
    set_switches(engine, bulk=False, vip=True)
    on = _create(client, "On")
    listed_on = client.get("/api/customer-types").json()

    assert listed_off == [off]
    assert listed_on == [off, on]
    set_switches(engine, bulk=False, vip=False)
    assert client.get("/api/customer-types").json() == [off, on]
    assert client.delete(f"/api/customer-types/{off['id']}").status_code == 204


def test_a_patch_with_a_good_name_and_a_bad_icon_changes_nothing(client: TestClient) -> None:
    created = _create(client, "Regulars", icon="heart")

    response = client.patch(
        f"/api/customer-types/{created['id']}", json={"name": "Friends", "icon": "rose"}
    )

    assert response.status_code == 422
    assert response.json()["code"] == "customer_type.icon_unknown"
    assert client.get("/api/customer-types").json() == [created]


def test_a_patch_with_a_taken_name_and_a_new_icon_changes_nothing(client: TestClient) -> None:
    _create(client, "Regulars")
    second = _create(client, "Friends")

    response = client.patch(
        f"/api/customer-types/{second['id']}", json={"name": "regulars", "icon": "crown"}
    )

    assert response.status_code == 409
    assert [t["icon"] for t in client.get("/api/customer-types").json()] == ["circle", "circle"]
