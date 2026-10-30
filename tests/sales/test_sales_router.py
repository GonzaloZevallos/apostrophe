"""Behaviour tests at the sales HTTP seam (CODING_STANDARDS section 5): the real
adapters, a fresh in-memory SQLite per test, `client`/`other_client` for isolation.

Covers what `app/sales/adapters/router.py` adds on top of the already-tested domain
and persistence: status codes, the response shape, and the refusal order for
assigning a customer (404 sale, then 422 customer, then 409 already assigned)."""

from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.payments.adapters.tables import PaymentRow
from app.pricing_settings.adapters.tables import PricingSettingsRow
from app.products.adapters.tables import PriceEntryRow
from app.sales.adapters.tables import SaleLineRow, SaleRow
from tests.conftest import TODAY
from tests.contract_shapes import assert_matches_fixture
from tests.fakes.archive import archive_by_hand
from tests.pricing_switches import set_switches


def _variety(client: TestClient, list_price: int = 10_000) -> int:
    variety = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": list_price},
    )
    return int(variety["id"])


def _variety_with_bulk(
    client: TestClient, list_price: int = 10_000, bulk_price: int = 8_000, bulk_minimum: str = "50"
) -> int:
    variety = client.post("/api/products", json={"name": "Lavanda"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={
            "effective_from": "2026-01-01",
            "list_price": list_price,
            "bulk_price": bulk_price,
            "bulk_minimum": bulk_minimum,
        },
    )
    return int(variety["id"])


def _row_counts(engine: Engine) -> tuple[int, int, int]:
    with Session(engine) as session:
        sales = session.scalar(select(func.count()).select_from(SaleRow)) or 0
        lines = session.scalar(select(func.count()).select_from(SaleLineRow)) or 0
        payments = session.scalar(select(func.count()).select_from(PaymentRow)) or 0
        return sales, lines, payments


def _customer(client: TestClient) -> int:
    customer = client.post("/customers", json={"name": "Juana", "phone": "11 2345-6789"}).json()
    return int(customer["id"])


def test_a_sale_left_owing_is_marked_still_owing_everywhere_it_is_read(
    client: TestClient,
) -> None:
    customer_id = _customer(client)
    variety_id = _variety(client)

    created = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": "owing",
            "lines": [{"product_id": variety_id, "quantity": "1"}],
        },
    ).json()
    sale_id = created["id"]

    assert created["still_owing"] is True
    assert_matches_fixture(created, "sale")
    listed = next(s for s in client.get("/sales").json() if s["id"] == sale_id)
    assert listed["still_owing"] is True
    assert_matches_fixture(listed, "sale")


def test_a_sale_paid_on_the_spot_is_never_still_owing(client: TestClient) -> None:
    variety_id = _variety(client)

    created = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "1"}]},
    ).json()

    assert created["still_owing"] is False
    assert client.get("/sales").json()[0]["still_owing"] is False


def test_record_sale_without_a_customer_paid_cash(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["customer"] is None
    assert body["payment"] == "cash"
    assert body["total"] == 100_000
    assert body["lines"] == [
        {
            "product_id": variety_id,
            "product_name": "Lavanda",
            "quantity": 10.0,
            "pricing_rule": "list",
            "price_per_gram": 10_000,
            "line_total": 100_000,
        }
    ]


def test_record_sale_left_owing_without_a_customer_is_refused(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales",
        json={"payment": "owing", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    )

    assert response.status_code == 422, response.text


def test_record_sale_with_an_unknown_variety_is_refused(client: TestClient) -> None:
    # Missing and foreign stay indistinguishable: gone, not a refusal (docs/adr/0011).
    response = client.post(
        "/sales", json={"payment": "cash", "lines": [{"product_id": 999_999, "quantity": "10"}]}
    )

    assert response.status_code == 404, response.text
    assert response.json()["code"] == "sale.variety_not_found"


def test_record_sale_with_an_unknown_customer_is_refused(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales",
        json={
            "payment": "cash",
            "customer_id": 999_999,
            "lines": [{"product_id": variety_id, "quantity": "10"}],
        },
    )

    assert response.status_code == 404, response.text
    assert response.json()["code"] == "sale.customer_not_found"


def test_record_sale_with_no_payment_field_and_a_positive_total_needs_a_method(
    client: TestClient,
) -> None:
    # `payment` optional (docs/adr/0011): omitted means no method and not left owing,
    # so a sale above $0 reaches `sale.payment_required` instead of a 422 for a
    # missing required field.
    variety_id = _variety(client)

    response = client.post("/sales", json={"lines": [{"product_id": variety_id, "quantity": "10"}]})

    assert response.status_code == 422, response.text
    assert response.json()["code"] == "sale.payment_required"


def test_record_sale_with_no_payment_field_and_a_zero_total_is_accepted(
    client: TestClient,
) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales",
        json={"lines": [{"product_id": variety_id, "quantity": "10", "gift": True}]},
    )

    assert response.status_code == 201, response.text
    assert response.json()["payment"] == "none"


def test_get_and_list_a_recorded_sale(client: TestClient) -> None:
    variety_id = _variety(client)
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    ).json()["id"]

    got = client.get(f"/sales/{sale_id}")
    assert got.status_code == 200
    assert got.json()["id"] == sale_id

    listed = client.get("/sales")
    assert listed.status_code == 200
    assert [sale["id"] for sale in listed.json()] == [sale_id]


def test_delete_sale_removes_it(client: TestClient) -> None:
    variety_id = _variety(client)
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    ).json()["id"]

    deleted = client.delete(f"/sales/{sale_id}")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json() == {"returned": [{"product_id": variety_id, "quantity": 10.0}]}

    assert client.get(f"/sales/{sale_id}").status_code == 404


def test_deleting_a_sale_sums_returned_grams_per_variety_sorted_by_variety_id(
    client: TestClient,
) -> None:
    # Created in this order, so `first_variety < second_variety`; the line order below
    # (second variety first) proves the response is sorted by `variety_id`, not by the
    # order the lines were recorded in.
    first_variety = _variety(client)
    second_variety = client.post("/api/products", json={"name": "Sativa"}).json()["id"]
    client.post(
        f"/api/products/{second_variety}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    sale_id = client.post(
        "/sales",
        json={
            "payment": "cash",
            "lines": [
                {"product_id": second_variety, "quantity": "3"},
                {"product_id": first_variety, "quantity": "4"},
                {"product_id": second_variety, "quantity": "2", "gift": True},
            ],
        },
    ).json()["id"]

    deleted = client.delete(f"/sales/{sale_id}")

    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["returned"] == [
        {"product_id": first_variety, "quantity": 4.0},
        {"product_id": second_variety, "quantity": 5.0},
    ]


def test_assign_customer_to_a_sale_with_none(client: TestClient) -> None:
    variety_id = _variety(client)
    customer_id = _customer(client)
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    ).json()["id"]

    response = client.put(f"/sales/{sale_id}/customer", json={"customer_id": customer_id})

    assert response.status_code == 200, response.text
    assert response.json()["customer"]["id"] == customer_id


def test_assign_customer_refusal_order_missing_sale_answers_404_even_with_a_bad_customer(
    client: TestClient,
) -> None:
    response = client.put("/sales/999999/customer", json={"customer_id": 999_999})

    assert response.status_code == 404, response.text


def test_assign_customer_refusal_order_unknown_customer_answers_404(
    client: TestClient,
) -> None:
    variety_id = _variety(client)
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    ).json()["id"]

    response = client.put(f"/sales/{sale_id}/customer", json={"customer_id": 999_999})

    assert response.status_code == 404, response.text
    assert response.json()["code"] == "sale.customer_not_found"


def test_assign_customer_already_assigned_answers_409(client: TestClient) -> None:
    variety_id = _variety(client)
    first_customer = _customer(client)
    second_customer_response = client.post(
        "/customers", json={"name": "Otra", "phone": "11 9876-5432"}
    )
    second_customer = second_customer_response.json()["id"]
    sale_id = client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": first_customer,
            "lines": [{"product_id": variety_id, "quantity": "10"}],
        },
    ).json()["id"]

    response = client.put(f"/sales/{sale_id}/customer", json={"customer_id": second_customer})

    assert response.status_code == 409, response.text


def test_record_sale_defaults_its_date_to_today_from_the_clock(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    )

    assert response.json()["date"] == TODAY.isoformat()


def test_a_zero_total_sale_ignores_its_method_and_has_no_payment(client: TestClient) -> None:
    variety_id = _variety(client)

    response = client.post(
        "/sales",
        json={
            "payment": "cash",
            "lines": [{"product_id": variety_id, "quantity": "10", "gift": True}],
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["payment"] == "none"
    assert response.json()["total"] == 0


def test_a_sale_left_owing_answers_owing_as_its_payment(client: TestClient) -> None:
    variety_id = _variety(client)
    customer_id = _customer(client)

    response = client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": customer_id,
            "lines": [{"product_id": variety_id, "quantity": "10"}],
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["payment"] == "owing"


def test_list_sales_orders_newest_date_first_then_most_recently_recorded(
    client: TestClient,
) -> None:
    variety_id = _variety(client)

    def _record(sale_date: str) -> int:
        body = {
            "date": sale_date,
            "payment": "cash",
            "lines": [{"product_id": variety_id, "quantity": "10"}],
        }
        return int(client.post("/sales", json=body).json()["id"])

    middle_first = _record("2026-09-15")
    middle_second = _record("2026-09-15")
    newest = _record("2026-09-20")
    oldest = _record("2026-09-01")

    response = client.get("/sales")

    assert response.status_code == 200
    assert [sale["id"] for sale in response.json()] == [
        newest,
        middle_second,
        middle_first,
        oldest,
    ]


def test_list_sales_filters_by_an_inclusive_date_range(client: TestClient) -> None:
    variety_id = _variety(client)

    def _record(sale_date: str) -> int:
        body = {
            "date": sale_date,
            "payment": "cash",
            "lines": [{"product_id": variety_id, "quantity": "10"}],
        }
        return int(client.post("/sales", json=body).json()["id"])

    early = _record("2026-09-01")
    middle = _record("2026-09-15")
    late = _record("2026-09-30")

    both_ends = client.get("/sales", params={"date_from": "2026-09-01", "date_to": "2026-09-15"})
    assert [s["id"] for s in both_ends.json()] == [middle, early]

    only_from = client.get("/sales", params={"date_from": "2026-09-15"})
    assert [s["id"] for s in only_from.json()] == [late, middle]

    only_to = client.get("/sales", params={"date_to": "2026-09-15"})
    assert [s["id"] for s in only_to.json()] == [middle, early]


def test_list_sales_with_an_inverted_range_answers_an_empty_list(client: TestClient) -> None:
    variety_id = _variety(client)
    client.post(
        "/sales",
        json={
            "date": "2026-09-15",
            "payment": "cash",
            "lines": [{"product_id": variety_id, "quantity": "10"}],
        },
    )

    response = client.get("/sales", params={"date_from": "2026-09-20", "date_to": "2026-09-01"})

    assert response.status_code == 200
    assert response.json() == []


def test_get_and_list_label_the_sale_with_the_customer_s_current_name_and_vip_flag(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=False, vip=True)
    variety_id = _variety(client)
    customer_id = _customer(client)
    sale_id = client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": customer_id,
            "lines": [{"product_id": variety_id, "quantity": "10"}],
        },
    ).json()["id"]

    client.patch(f"/customers/{customer_id}", json={"vip": True})

    got = client.get(f"/sales/{sale_id}").json()
    assert got["customer"] == {"id": customer_id, "name": "Juana", "vip": True}

    listed = client.get("/sales").json()
    assert listed[0]["customer"] == {"id": customer_id, "name": "Juana", "vip": True}


def test_assigning_a_vip_customer_later_does_not_reprice_the_sale(client: TestClient) -> None:
    # The variety carries a bulk price, so a repricing bug would visibly change the
    # line's rule (list -> vip) and its price_per_gram; grams stay below the bulk
    # minimum so the sale is recorded at list.
    variety_id = _variety_with_bulk(client, list_price=10_000, bulk_price=8_000, bulk_minimum="50")
    customer_id = _customer(client)

    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "5"}]},
    ).json()["id"]
    before = client.get(f"/sales/{sale_id}").json()
    assert before["lines"][0]["pricing_rule"] == "list"
    assert before["lines"][0]["price_per_gram"] == 10_000

    client.patch(f"/customers/{customer_id}", json={"vip": True})
    response = client.put(f"/sales/{sale_id}/customer", json={"customer_id": customer_id})

    assert response.status_code == 200, response.text
    assert response.json()["lines"][0]["pricing_rule"] == "list"
    assert response.json()["lines"][0]["price_per_gram"] == before["lines"][0]["price_per_gram"]
    assert response.json()["total"] == before["total"]


def test_toggling_a_customers_vip_after_the_sale_changes_only_its_vip_badge(
    client: TestClient, engine: Engine
) -> None:
    set_switches(engine, bulk=True, vip=True)
    # The badge is the customer's current flag, not how the sale was priced
    # (docs/adr/0011): it is free to change on an unchanged sale, while every line
    # stays exactly as recorded.
    variety_id = _variety_with_bulk(client, list_price=10_000, bulk_price=8_000, bulk_minimum="50")
    customer_id = _customer(client)
    sale_id = client.post(
        "/sales",
        json={
            "payment": "cash",
            "customer_id": customer_id,
            "lines": [{"product_id": variety_id, "quantity": "5"}],
        },
    ).json()["id"]
    before = client.get(f"/sales/{sale_id}").json()
    assert before["lines"][0]["pricing_rule"] == "list"
    assert before["lines"][0]["price_per_gram"] == 10_000
    assert before["customer"]["vip"] is False

    client.patch(f"/customers/{customer_id}", json={"vip": True})

    after = client.get(f"/sales/{sale_id}").json()
    assert after["customer"]["vip"] is True
    assert after["lines"] == before["lines"]
    assert after["total"] == before["total"]


def test_adding_a_price_entry_after_the_sale_does_not_reprice_it(client: TestClient) -> None:
    variety_id = _variety_with_bulk(client, list_price=10_000, bulk_price=8_000, bulk_minimum="50")
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "5"}]},
    ).json()["id"]
    before = client.get(f"/sales/{sale_id}").json()

    # Effective on the sale's date, so it would become the sale's "current price"
    # if `SqlSales.get` ever repriced from the `PriceBook` instead of the stored row.
    added = client.post(
        f"/api/products/{variety_id}/prices",
        json={
            "effective_from": TODAY.isoformat(),
            "list_price": 99_000,
            "bulk_price": 88_000,
            "bulk_minimum": "1",
        },
    )
    assert added.status_code == 201, added.text

    after = client.get(f"/sales/{sale_id}").json()
    assert after == before


def test_deleting_a_price_entry_after_the_sale_does_not_reprice_it(client: TestClient) -> None:
    variety_id = _variety_with_bulk(client, list_price=10_000, bulk_price=8_000, bulk_minimum="50")
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "5"}]},
    ).json()["id"]
    before = client.get(f"/sales/{sale_id}").json()

    history = client.get(f"/api/products/{variety_id}/prices").json()
    entry_id = history[0]["id"]
    deleted = client.delete(f"/api/products/{variety_id}/prices/{entry_id}")
    assert deleted.status_code == 204

    after = client.get(f"/sales/{sale_id}").json()
    assert after == before


def test_a_refused_sale_leaves_no_rows_in_sale_line_or_payment(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety(client)
    before = _row_counts(engine)

    response = client.post(
        "/sales",
        json={"payment": "owing", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    )

    assert response.status_code == 422, response.text
    assert _row_counts(engine) == before


def _switches(engine: Engine, *, bulk: bool, vip: bool) -> None:
    """Moves the business's two switches, standing in for `PUT /pricing-settings`
    (the settings-routes subtask), which this branch does not carry yet."""
    with Session(engine) as session:
        session.execute(
            update(PricingSettingsRow).values(is_bulk_pricing=bulk, is_vip_customers=vip)
        )
        session.commit()


def _vip_price(engine: Engine, vip_price: int) -> None:
    with Session(engine) as session:
        session.execute(update(PriceEntryRow).values(vip_price=vip_price))
        session.commit()


def _line_of(client: TestClient, variety_id: int, customer_id: int | None) -> dict[str, object]:
    body: dict[str, object] = {
        "payment": "cash",
        "lines": [{"product_id": variety_id, "quantity": "50"}],
    }
    if customer_id is not None:
        body["customer_id"] = customer_id
    created = client.post("/sales", json=body)
    assert created.status_code == 201, created.text
    line: dict[str, object] = created.json()["lines"][0]
    return line


def test_a_line_at_the_bulk_minimum_is_stored_as_list_once_bulk_is_switched_off(
    client: TestClient, engine: Engine
) -> None:
    _switches(engine, bulk=True, vip=False)
    variety_id = _variety_with_bulk(client)
    assert _line_of(client, variety_id, None)["pricing_rule"] == "bulk"

    _switches(engine, bulk=False, vip=False)
    line = _line_of(client, variety_id, None)

    assert (line["pricing_rule"], line["price_per_gram"]) == ("list", 10_000)


def test_a_vip_customer_is_stored_as_vip_once_vip_is_switched_on(
    client: TestClient, engine: Engine
) -> None:
    _switches(engine, bulk=True, vip=True)
    variety_id = _variety_with_bulk(client)
    _vip_price(engine, 7_000)
    customer_id = _customer(client)
    client.patch(f"/customers/{customer_id}", json={"vip": True})
    _switches(engine, bulk=True, vip=False)
    assert _line_of(client, variety_id, customer_id)["pricing_rule"] == "bulk"

    _switches(engine, bulk=True, vip=True)
    line = _line_of(client, variety_id, customer_id)

    assert (line["pricing_rule"], line["price_per_gram"]) == ("vip", 7_000)


def test_switching_a_rule_off_leaves_a_recorded_sale_as_it_was(
    client: TestClient, engine: Engine
) -> None:
    _switches(engine, bulk=True, vip=False)
    variety_id = _variety_with_bulk(client)
    created = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "50"}]},
    ).json()

    _switches(engine, bulk=False, vip=False)
    after = client.get(f"/sales/{created['id']}").json()

    stored = ("pricing_rule", "price_per_gram", "line_total")
    assert [{k: line[k] for k in stored} for line in after["lines"]] == [
        {k: line[k] for k in stored} for line in created["lines"]
    ]
    assert after["total"] == created["total"]


def _archived_variety(client: TestClient, engine: Engine) -> int:
    variety_id = _variety(client)
    archive_by_hand(engine, variety_id)
    return variety_id


def test_a_sale_line_on_an_archived_variety_is_refused_as_gone_and_writes_nothing(
    client: TestClient, engine: Engine
) -> None:
    archived = _archived_variety(client, engine)

    response = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": archived, "quantity": "10"}]},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "sale.variety_not_found"
    assert _row_counts(engine) == (0, 0, 0)


def test_a_sale_of_a_variety_archived_afterwards_can_still_be_deleted_and_assigned(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety(client)
    customer_id = _customer(client)
    sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "10"}]},
    ).json()["id"]
    other_sale_id = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"product_id": variety_id, "quantity": "5"}]},
    ).json()["id"]
    archive_by_hand(engine, variety_id)

    assigned = client.put(f"/sales/{sale_id}/customer", json={"customer_id": customer_id})
    deleted = client.delete(f"/sales/{other_sale_id}")

    assert assigned.status_code == 200, assigned.text
    assert deleted.status_code == 200, deleted.text
    assert deleted.json() == {"returned": [{"product_id": variety_id, "quantity": 5.0}]}
    assert client.get(f"/sales/{sale_id}").json()["lines"][0]["product_id"] == variety_id
