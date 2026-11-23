"""`GET /payments/debtors` cost and agreement (ADR-0012, ADR-0038): the read stays at a fixed number
of statements however many customers owe, and Inicio's Te deben block (`GET /panel`) is the same
read as Clientes' (`GET /payments/debtors`), credit customers left out of both.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.sales.adapters.tables import SaleRow
from tests.conftest import MovableClock
from tests.pricing_switches import set_switches
from tests.statement_log import captured_statements

SALE_DATE = "2026-09-14"
PRICE = 1_000


def _priced_variety(client: TestClient) -> int:
    variety: dict[str, int] = client.post("/api/products", json={"name": "Variety"}).json()
    client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": PRICE},
    )
    return variety["id"]


def _owing_sale(client: TestClient, customer_id: int, variety_id: int, quantity: int) -> int:
    sale = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": {"kind": "owing"},
            "date": SALE_DATE,
            "lines": [{"product_id": variety_id, "quantity": str(quantity)}],
        },
    )
    assert sale.status_code == 201, sale.text
    sale_id: int = sale.json()["id"]
    return sale_id


def _customer(client: TestClient, index: int) -> int:
    customer = client.post(
        "/customers",
        json={
            "name": f"Debtor {index:03d}",
            "phone": f"11 4{index:03d}-{index:04d}",
            "phone_country": "AR",
        },
    )
    assert customer.status_code == 201, customer.text
    customer_id: int = customer.json()["id"]
    return customer_id


def _sale_total(client: TestClient, sale_id: int) -> int:
    total: int = client.get(f"/sales/{sale_id}").json()["total"]
    return total


def _seed_debtors(client: TestClient, how_many: int) -> None:
    variety_id = _priced_variety(client)
    for index in range(how_many):
        _owing_sale(client, _customer(client, index), variety_id, index + 1)


def _statement_count(engine: Engine, client: TestClient) -> int:
    with captured_statements(engine) as statements:
        response = client.get("/payments/debtors")
        assert response.status_code == 200, response.text
    return len(statements)


def test_debtors_issues_the_same_number_of_statements_with_ten_and_with_fifty(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _seed_debtors(client, 10)
    _seed_debtors(other_client, 50)

    assert len(client.get("/payments/debtors").json()["debtors"]) == 10
    assert len(other_client.get("/payments/debtors").json()["debtors"]) == 50
    ten = _statement_count(engine, client)
    fifty = _statement_count(engine, other_client)

    assert ten == fifty, (ten, fifty)


def test_the_lines_flag_does_not_change_the_number_of_statements(
    client: TestClient, engine: Engine
) -> None:
    _seed_debtors(client, 10)

    def count(query: str) -> int:
        with captured_statements(engine) as statements:
            response = client.get(f"/payments/debtors{query}")
            assert response.status_code == 200, response.text
        return len(statements)

    assert count("?with_lines=true") == count("?with_lines=false")


def test_panel_and_debtors_agree_with_a_direct_computation_and_a_credit_customer(
    client: TestClient,
) -> None:
    variety_id = _priced_variety(client)
    first, second, credit = (_customer(client, index) for index in (1, 2, 3))
    first_sale = _owing_sale(client, first, variety_id, 7)
    second_sale = _owing_sale(client, second, variety_id, 3)
    # The third customer settles two sales, then one is deleted: what they paid for it stays
    # with them as credit, so their balance is below $0.
    kept = _owing_sale(client, credit, variety_id, 2)
    removed = _owing_sale(client, credit, variety_id, 4)
    paid = client.post(
        f"/customers/{credit}/payments",
        json={
            "paid_on": "2026-10-01",
            "amount": _sale_total(client, kept) + _sale_total(client, removed),
            "payment_method_id": 1,
        },
    )
    assert paid.status_code == 201, paid.text
    assert client.delete(f"/sales/{removed}").status_code == 200
    assert client.get(f"/customers/{credit}/account").json()["standing"] == "credit"

    debtors = client.get("/payments/debtors").json()
    panel = client.get("/panel").json()["debts"]

    owed = [_sale_total(client, first_sale), _sale_total(client, second_sale)]
    assert [row["customer"]["id"] for row in debtors["debtors"]] == [first, second]
    assert [row["balance"] for row in debtors["debtors"]] == owed
    assert debtors["total_owed"] == sum(owed)
    assert debtors["sales_owing_count"] == 2
    assert panel["total_owed"] == debtors["total_owed"]
    assert panel["sales_owing_count"] == debtors["sales_owing_count"]
    assert panel["oldest"] == debtors["debtors"][0]["owing_since"]
    assert [row["customer_id"] for row in panel["teaser"]] == [first, second]
    assert [row["balance"] for row in panel["teaser"]] == owed


def _named_customer(client: TestClient, name: str, index: int) -> int:
    customer = client.post(
        "/customers",
        json={"name": name, "phone": f"11 5{index:03d}-{index:04d}", "phone_country": "AR"},
    )
    assert customer.status_code == 201, customer.text
    customer_id: int = customer.json()["id"]
    return customer_id


def _debtor_names(client: TestClient) -> list[str]:
    body = client.get("/payments/debtors").json()
    return [row["customer"]["name"] for row in body["debtors"]]


def test_the_larger_balance_comes_first_on_the_same_owing_since(client: TestClient) -> None:
    variety_id = _priced_variety(client)
    _owing_sale(client, _named_customer(client, "Ana", 1), variety_id, 1)
    _owing_sale(client, _named_customer(client, "Beto", 2), variety_id, 5)

    assert _debtor_names(client) == ["Beto", "Ana"]


def test_the_folded_name_breaks_a_tie_on_owing_since_and_balance(client: TestClient) -> None:
    variety_id = _priced_variety(client)
    _owing_sale(client, _named_customer(client, "Émile", 1), variety_id, 2)
    _owing_sale(client, _named_customer(client, "Ana", 2), variety_id, 2)

    assert _debtor_names(client) == ["Ana", "Émile"]


def test_the_same_folded_name_falls_to_recording_order(client: TestClient) -> None:
    variety_id = _priced_variety(client)
    first = _named_customer(client, "Ana", 1)
    second = _named_customer(client, "ANA", 2)
    _owing_sale(client, second, variety_id, 2)
    _owing_sale(client, first, variety_id, 2)

    body = client.get("/payments/debtors").json()

    assert [row["customer"]["id"] for row in body["debtors"]] == [first, second]


def test_panel_teaser_keeps_its_own_order_on_an_owing_since_tie(client: TestClient) -> None:
    variety_id = _priced_variety(client)
    small = _named_customer(client, "Ana", 1)
    large = _named_customer(client, "Zoe", 2)
    _owing_sale(client, small, variety_id, 1)
    _owing_sale(client, large, variety_id, 5)

    panel = client.get("/panel").json()["debts"]

    assert panel["oldest"] == SALE_DATE
    assert [row["customer_id"] for row in panel["teaser"]] == [large, small]


# -- debt age, counts and customer type on the wire (GH-842) -------------------------


def _sale_on(client: TestClient, customer_id: int, variety_id: int, quantity: int, day: str) -> int:
    sale = client.post(
        "/sales",
        json={
            "customer_id": customer_id,
            "payment": {"kind": "owing"},
            "date": day,
            "lines": [{"product_id": variety_id, "quantity": str(quantity)}],
        },
    )
    assert sale.status_code == 201, sale.text
    sale_id: int = sale.json()["id"]
    return sale_id


def _credit_customer(client: TestClient, variety_id: int, index: int) -> int:
    """A customer whose balance is below $0: they paid two sales, then one was deleted."""
    credit = _customer(client, index)
    kept = _owing_sale(client, credit, variety_id, 2)
    removed = _owing_sale(client, credit, variety_id, 4)
    paid = client.post(
        f"/customers/{credit}/payments",
        json={
            "paid_on": "2026-10-01",
            "amount": _sale_total(client, kept) + _sale_total(client, removed),
            "payment_method_id": 1,
        },
    )
    assert paid.status_code == 201, paid.text
    assert client.delete(f"/sales/{removed}").status_code == 200
    return credit


def test_nobody_owing_gives_zero_counts_and_all_three_buckets_present_at_zero(
    client: TestClient,
) -> None:
    body = client.get("/payments/debtors").json()

    assert body["debtors"] == []
    assert body["customer_count"] == 0
    assert body["debtor_count"] == 0
    assert body["buckets"] == {"this_week": 0, "days_8_30": 0, "over_30": 0}


def test_a_debtor_carries_its_age_bucket_and_no_customer_type_and_the_totals_are_counted(
    client: TestClient,
) -> None:
    variety_id = _priced_variety(client)
    debtor = _customer(client, 1)
    sale_id = _owing_sale(client, debtor, variety_id, 3)

    body = client.get("/payments/debtors").json()

    owed = _sale_total(client, sale_id)
    assert body["customer_count"] == 1
    assert body["debtor_count"] == 1
    assert body["buckets"] == {"this_week": 0, "days_8_30": owed, "over_30": 0}
    [row] = body["debtors"]
    assert row["customer"]["id"] == debtor
    assert row["balance"] == owed
    assert row["age_days"] == 18
    assert row["bucket"] == "days_8_30"
    assert row["customer_type_id"] is None


def test_customer_count_includes_a_customer_without_sales_and_a_credit_but_debtor_count_does_not(
    client: TestClient,
) -> None:
    variety_id = _priced_variety(client)
    owing = _customer(client, 1)
    _customer(client, 2)  # no sales at all
    _credit_customer(client, variety_id, 3)
    _owing_sale(client, owing, variety_id, 7)

    body = client.get("/payments/debtors").json()

    assert body["customer_count"] == 3
    assert body["debtor_count"] == 1
    assert [row["customer"]["id"] for row in body["debtors"]] == [owing]


def test_the_buckets_add_up_to_total_owed_with_a_credit_customer_present(
    client: TestClient,
) -> None:
    variety_id = _priced_variety(client)
    _credit_customer(client, variety_id, 1)
    _sale_on(client, _customer(client, 2), variety_id, 3, "2026-10-01")
    _sale_on(client, _customer(client, 3), variety_id, 5, "2026-09-20")
    _sale_on(client, _customer(client, 4), variety_id, 7, "2026-08-01")

    body = client.get("/payments/debtors").json()

    assert sum(body["buckets"].values()) == body["total_owed"]
    assert body["buckets"] == {"this_week": 3_000, "days_8_30": 5_000, "over_30": 7_000}


def test_a_debtor_spanning_two_age_groups_adds_to_both_and_carries_one_bucket(
    client: TestClient,
) -> None:
    variety_id = _priced_variety(client)
    debtor = _customer(client, 1)
    _sale_on(client, debtor, variety_id, 4, "2026-08-01")
    _sale_on(client, debtor, variety_id, 2, "2026-10-01")

    body = client.get("/payments/debtors").json()

    assert body["buckets"] == {"this_week": 2_000, "days_8_30": 0, "over_30": 4_000}
    [row] = body["debtors"]
    assert row["balance"] == 6_000
    assert row["owing_since"] == "2026-08-01"
    assert row["age_days"] == 62
    assert row["bucket"] == "over_30"


def test_customer_type_id_is_null_with_the_switch_off_and_the_stored_id_with_it_on(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _priced_variety(client)
    type_response = client.post("/api/customer-types", json={"name": "Regulars"})
    assert type_response.status_code == 201, type_response.text
    type_id: int = type_response.json()["id"]
    set_switches(engine, bulk=False, vip=True)
    customer = client.post(
        "/customers",
        json={
            "name": "Typed",
            "phone": "11 6000-0000",
            "phone_country": "AR",
            "customer_type_id": type_id,
        },
    )
    assert customer.status_code == 201, customer.text
    _owing_sale(client, customer.json()["id"], variety_id, 1)

    with_switch_on = client.get("/payments/debtors").json()["debtors"][0]["customer_type_id"]
    set_switches(engine, bulk=False, vip=False)
    with_switch_off = client.get("/payments/debtors").json()["debtors"][0]["customer_type_id"]
    set_switches(engine, bulk=False, vip=True)
    back_on = client.get("/payments/debtors").json()["debtors"][0]["customer_type_id"]

    assert with_switch_on == type_id
    assert with_switch_off is None
    assert back_on == type_id


def test_moving_the_clock_past_the_next_argentina_midnight_flips_30_days_to_31_and_over_30(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _priced_variety(client)
    _sale_on(client, _customer(client, 1), variety_id, 2, "2026-09-02")

    before = client.get("/payments/debtors").json()
    # 2026-10-03 02:59 UTC is still 2026-10-02 in Argentina; two minutes later it is the 3rd.
    clock.set(datetime(2026, 10, 3, 2, 59, tzinfo=UTC))
    just_before_midnight = client.get("/payments/debtors").json()
    clock.set(datetime(2026, 10, 3, 3, 1, tzinfo=UTC))
    after = client.get("/payments/debtors").json()

    for body in (before, just_before_midnight):
        assert body["debtors"][0]["age_days"] == 30
        assert body["debtors"][0]["bucket"] == "days_8_30"
        assert body["buckets"] == {"this_week": 0, "days_8_30": 2_000, "over_30": 0}
    assert after["debtors"][0]["age_days"] == 31
    assert after["debtors"][0]["bucket"] == "over_30"
    assert after["buckets"] == {"this_week": 0, "days_8_30": 0, "over_30": 2_000}


def test_a_sale_dated_after_today_has_age_zero_and_is_in_this_week(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _priced_variety(client)
    sale_id = _sale_on(client, _customer(client, 1), variety_id, 2, "2026-10-02")
    # The API refuses a sale dated in the future (and a session cannot outlive the clock
    # going back), so the stored date is moved ahead of today directly.
    with Session(engine) as session:
        sale = session.get(SaleRow, sale_id)
        assert sale is not None
        sale.sold_on = date(2026, 10, 9)
        session.commit()

    body = client.get("/payments/debtors").json()

    assert body["debtors"][0]["owing_since"] == "2026-10-09"
    assert body["debtors"][0]["age_days"] == 0
    assert body["debtors"][0]["bucket"] == "this_week"
    assert body["buckets"] == {"this_week": 2_000, "days_8_30": 0, "over_30": 0}


def test_debtors_and_the_panel_teaser_rows_carry_no_phone(client: TestClient) -> None:
    variety_id = _priced_variety(client)
    customer = _customer(client, 1)
    assert client.get(f"/customers/{customer}").json()["phone"] is not None
    _owing_sale(client, customer, variety_id, 2)

    [row] = client.get("/payments/debtors").json()["debtors"]
    [teaser] = client.get("/panel").json()["debts"]["teaser"]

    assert set(row) == {
        "customer",
        "balance",
        "owing_since",
        "standing",
        "age_days",
        "bucket",
        "customer_type_id",
        "still_owing",
    }
    assert set(row["customer"]) == {"id", "name"}
    assert set(teaser) == {"customer_id", "name", "balance", "owing_since"}
