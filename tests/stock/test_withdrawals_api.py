"""Recording, reading, editing and deleting stock withdrawals through the HTTP API,
over a real database (CODING_STANDARDS section 5)."""

from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import MovableClock
from tests.contract_shapes import assert_matches_fixture

TODAY = "2026-10-02"


def _variety(client: TestClient, name: str = "Zkittlez") -> int:
    return int(client.post("/varieties", json={"name": name}).json()["id"])


def _stock_in(client: TestClient, variety_id: int, grams: str = "50", **extra: Any) -> None:
    body: dict[str, Any] = {"variety_id": variety_id, "origin": "opening_stock", "grams": grams}
    response = client.post("/stock/entries", json=body | extra)
    assert response.status_code == 201, response.text


def _body(variety_id: int, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "reason": "promotion",
        "lines": [{"variety_id": variety_id, "grams": "5"}],
    }
    body.update(overrides)
    return body


def _record(client: TestClient, variety_id: int, **overrides: Any) -> dict[str, Any]:
    response = client.post("/stock/withdrawals", json=_body(variety_id, **overrides))
    assert response.status_code == 201, response.text
    answer: dict[str, Any] = response.json()
    return answer


def _grams_of(client: TestClient, variety_id: int) -> float:
    rows = client.get("/stock").json()["varieties"]
    return float(next(row["grams"] for row in rows if row["variety_id"] == variety_id))


def test_a_withdrawal_is_recorded_and_answers_with_its_lines(client: TestClient) -> None:
    zkittlez = _variety(client)
    gelato = _variety(client, "Gelato")

    withdrawal = _record(
        client,
        zkittlez,
        reason="own_use",
        note="  para mí  ",
        lines=[
            {"variety_id": zkittlez, "grams": "2.5"},
            {"variety_id": gelato, "grams": "1"},
        ],
    )

    assert_matches_fixture(withdrawal, "withdrawal")
    assert withdrawal["reason"] == "own_use"
    assert withdrawal["date"] == TODAY
    assert withdrawal["note"] == "para mí"
    assert withdrawal["total_grams"] == 3.5
    assert [line["variety_name"] for line in withdrawal["lines"]] == ["Zkittlez", "Gelato"]
    assert "recorded_at" not in withdrawal
    assert client.get(f"/stock/withdrawals/{withdrawal['id']}").json() == withdrawal


def test_an_earlier_date_is_allowed_and_the_same_variety_may_repeat(client: TestClient) -> None:
    variety_id = _variety(client)

    withdrawal = _record(
        client,
        variety_id,
        date="2026-09-20",
        lines=[
            {"variety_id": variety_id, "grams": "1"},
            {"variety_id": variety_id, "grams": "1"},
        ],
    )

    assert withdrawal["date"] == "2026-09-20"
    assert len(withdrawal["lines"]) == 2


def test_stock_moves_exactly_on_record_edit_and_delete(client: TestClient) -> None:
    variety_id = _variety(client)
    _stock_in(client, variety_id, "50")

    withdrawal = _record(client, variety_id, lines=[{"variety_id": variety_id, "grams": "5.25"}])
    assert _grams_of(client, variety_id) == 44.75

    edited = client.put(
        f"/stock/withdrawals/{withdrawal['id']}",
        json=_body(variety_id, reason="own_use", lines=[{"variety_id": variety_id, "grams": "7"}]),
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["id"] == withdrawal["id"]
    assert edited.json()["reason"] == "own_use"
    assert _grams_of(client, variety_id) == 43.0

    deleted = client.delete(f"/stock/withdrawals/{withdrawal['id']}")
    assert deleted.status_code == 204
    assert _grams_of(client, variety_id) == 50.0
    assert client.get(f"/stock/withdrawals/{withdrawal['id']}").status_code == 404


def test_a_withdrawal_past_stock_is_recorded_and_shows_sold_out(client: TestClient) -> None:
    variety_id = _variety(client)
    _stock_in(client, variety_id, "3")

    _record(client, variety_id, lines=[{"variety_id": variety_id, "grams": "5"}])

    row = client.get("/stock").json()["varieties"][0]
    assert row["status"] == "sold_out"
    assert row["grams"] == -2.0
    assert row["sold_out_since"] == TODAY


def test_a_variety_with_only_a_withdrawal_is_not_without_entries(client: TestClient) -> None:
    variety_id = _variety(client)
    assert client.get("/stock").json()["varieties"][0]["status"] == "no_entries"

    _record(client, variety_id)

    assert client.get("/stock").json()["varieties"][0]["status"] == "sold_out"


def test_days_left_counts_withdrawn_grams(client: TestClient) -> None:
    variety_id = _variety(client)
    _stock_in(client, variety_id, "100", date="2026-08-01")
    before = client.get("/stock").json()["varieties"][0]["days_left"]

    _record(
        client, variety_id, date="2026-09-20", lines=[{"variety_id": variety_id, "grams": "30"}]
    )

    after = client.get("/stock").json()["varieties"][0]["days_left"]
    assert before is None
    assert after is not None


def test_an_edit_with_the_same_line_count_and_with_reversed_lines_answers_200(
    client: TestClient,
) -> None:
    first = _variety(client)
    second = _variety(client, "Gelato")
    withdrawal = _record(
        client,
        first,
        lines=[{"variety_id": first, "grams": "1"}, {"variety_id": second, "grams": "2"}],
    )

    same = client.put(
        f"/stock/withdrawals/{withdrawal['id']}",
        json=_body(
            first,
            lines=[{"variety_id": first, "grams": "3"}, {"variety_id": second, "grams": "4"}],
        ),
    )
    reversed_ = client.put(
        f"/stock/withdrawals/{withdrawal['id']}",
        json=_body(
            first,
            lines=[{"variety_id": second, "grams": "4"}, {"variety_id": first, "grams": "3"}],
        ),
    )

    assert same.status_code == 200, same.text
    assert reversed_.status_code == 200, reversed_.text
    assert [line["variety_id"] for line in reversed_.json()["lines"]] == [second, first]


def test_an_edit_keeps_the_recording_order_of_the_withdrawal(
    client: TestClient, clock: MovableClock
) -> None:
    variety_id = _variety(client)
    _stock_in(client, variety_id, "50")
    first = _record(client, variety_id)
    clock.set(datetime(2026, 10, 2, 19, 0, tzinfo=UTC))
    second = _record(client, variety_id)

    client.put(f"/stock/withdrawals/{first['id']}", json=_body(variety_id))

    rows = client.get(f"/stock/varieties/{variety_id}/movements").json()
    assert [row["id"] for row in rows if row["kind"] == "withdrawal"] == [second["id"], first["id"]]


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"reason": None}, "stock.withdrawal_reason_required"),
        ({"reason": "gift"}, "stock.withdrawal_reason_required"),
        ({"lines": []}, "stock.withdrawal_no_lines"),
        ({"date": "2026-10-03"}, "stock.withdrawal_date_in_future"),
        ({"note": "x" * 201}, "stock.withdrawal_note_too_long"),
        ({"lines": [{"variety_id": 0, "grams": "0"}]}, "stock.withdrawal_grams_not_positive"),
        ({"lines": [{"variety_id": 0, "grams": "-1"}]}, "stock.withdrawal_grams_not_positive"),
        ({"lines": [{"variety_id": 0, "grams": "1.234"}]}, "stock.withdrawal_grams_too_precise"),
    ],
)
def test_each_refusal_has_its_own_code_and_never_repeats_the_input(
    client: TestClient, overrides: dict[str, Any], code: str
) -> None:
    variety_id = _variety(client)
    body = _body(variety_id, **({"note": "secreto 9876"} | overrides))
    for line in body["lines"]:
        line["variety_id"] = variety_id

    response = client.post("/stock/withdrawals", json=body)

    assert response.status_code == 422
    assert response.json()["code"] == code
    for echoed in ("secreto", "9876", "1.234", "xxxx"):
        assert echoed not in response.text


def test_another_business_variety_answers_404_and_writes_nothing(
    client: TestClient, other_client: TestClient
) -> None:
    foreign = _variety(other_client, "Ajena")

    response = client.post("/stock/withdrawals", json=_body(foreign))

    assert response.status_code == 404
    assert response.json()["code"] == "stock.withdrawal_variety_not_found"
    assert str(foreign) not in response.text


def test_another_business_withdrawal_answers_404(
    client: TestClient, other_client: TestClient
) -> None:
    withdrawal = _record(other_client, _variety(other_client, "Ajena"))
    mine = _variety(client)
    path = f"/stock/withdrawals/{withdrawal['id']}"

    assert client.get(path).status_code == 404
    assert client.put(path, json=_body(mine)).status_code == 404
    assert client.delete(path).status_code == 404
    assert client.get(path).json()["code"] == "stock.withdrawal_not_found"
    assert other_client.get(path).status_code == 200


def test_a_foreign_variety_on_an_edit_leaves_the_withdrawal_as_it_was(
    client: TestClient, other_client: TestClient
) -> None:
    foreign = _variety(other_client, "Ajena")
    mine = _variety(client)
    withdrawal = _record(client, mine)

    response = client.put(f"/stock/withdrawals/{withdrawal['id']}", json=_body(foreign))

    assert response.status_code == 404
    assert client.get(f"/stock/withdrawals/{withdrawal['id']}").json() == withdrawal


def test_the_future_check_uses_argentina_time(client: TestClient, clock: MovableClock) -> None:
    variety_id = _variety(client)
    clock.set(datetime(2026, 10, 6, 1, 0, tzinfo=UTC))  # 22:00 on 05/10 in Argentina

    refused = client.post("/stock/withdrawals", json=_body(variety_id, date="2026-10-06"))
    accepted = client.post("/stock/withdrawals", json=_body(variety_id, date="2026-10-05"))

    assert refused.status_code == 422
    assert accepted.status_code == 201


def test_movements_mix_entries_and_withdrawals_newest_first(
    client: TestClient, clock: MovableClock
) -> None:
    first = _variety(client)
    second = _variety(client, "Gelato")
    _stock_in(client, first, "50", date="2026-09-01", origin="purchase", total_cost=100_000)
    earlier = _record(client, first, date="2026-09-15")
    clock.set(datetime(2026, 10, 2, 19, 0, tzinfo=UTC))
    both = _record(
        client,
        first,
        reason="own_use",
        date="2026-09-15",
        lines=[
            {"variety_id": first, "grams": "1"},
            {"variety_id": second, "grams": "2"},
            {"variety_id": first, "grams": "0.5"},
        ],
    )
    _stock_in(client, first, "10", date="2026-09-30")

    rows = client.get(f"/stock/varieties/{first}/movements").json()
    other = client.get(f"/stock/varieties/{second}/movements").json()

    assert_matches_fixture(rows, "movements")
    assert [(row["kind"], row["date"]) for row in rows] == [
        ("entry", "2026-09-30"),
        ("withdrawal", "2026-09-15"),
        ("withdrawal", "2026-09-15"),
        ("entry", "2026-09-01"),
    ]
    assert [row["id"] for row in rows[1:3]] == [both["id"], earlier["id"]]
    assert rows[1]["reason"] == "own_use"
    assert rows[1]["grams"] == 1.5  # one row for the withdrawal, its repeated lines summed
    assert rows[3]["cost_per_gram"] == 2_000
    assert [(row["kind"], row["grams"]) for row in other] == [("withdrawal", 2.0)]


def test_movements_of_another_business_variety_answer_404(
    client: TestClient, other_client: TestClient
) -> None:
    foreign = _variety(other_client, "Ajena")
    _record(other_client, foreign)

    response = client.get(f"/stock/varieties/{foreign}/movements")

    assert response.status_code == 404
    assert response.json()["code"] == "variety.not_found"


def _priced_variety(client: TestClient, name: str) -> int:
    variety_id = _variety(client, name)
    client.post(
        f"/varieties/{variety_id}/prices",
        json={"effective_from": "2026-01-01", "list_price": 9_000},
    )
    return variety_id


def test_a_sale_line_cost_moves_with_an_earlier_withdrawal_and_every_reader_agrees(
    client: TestClient,
) -> None:
    variety_id = _priced_variety(client, "Flor")
    _stock_in(client, variety_id, "5", date="2026-08-01", origin="purchase", total_cost=500)
    _stock_in(client, variety_id, "5", date="2026-09-01", origin="purchase", total_cost=5_000)
    sale = client.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety_id, "grams": "5"}]},
    ).json()

    def line_cost() -> int:
        detail = client.get(f"/sales/{sale['id']}").json()
        cost = detail["lines"][0]["cost"]["costed"]
        [analysed] = client.get("/analysis", params={"month": "2026-10"}).json()["month"][
            "varieties"
        ]
        assert analysed["cost"]["costed"] == cost  # `GET /analysis` reads the same cost
        assert isinstance(cost, int)
        return cost

    assert line_cost() == 500

    withdrawal = _record(
        client, variety_id, date="2026-08-15", lines=[{"variety_id": variety_id, "grams": "3"}]
    )
    assert line_cost() == 3_200  # 2 g from the first lot, 3 g from the second

    client.put(
        f"/stock/withdrawals/{withdrawal['id']}",
        json=_body(variety_id, date="2026-08-15", lines=[{"variety_id": variety_id, "grams": "1"}]),
    )
    assert line_cost() == 1_400

    client.delete(f"/stock/withdrawals/{withdrawal['id']}")
    assert line_cost() == 500


def test_a_withdrawal_is_never_a_sale_a_debt_or_money(client: TestClient) -> None:
    variety_id = _priced_variety(client, "Flor")
    customer = client.post("/customers", json={"name": "Ana", "phone": "11 2222-3333"}).json()
    _stock_in(client, variety_id, "50", origin="purchase", total_cost=5_000)
    client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": customer["id"],
            "lines": [{"variety_id": variety_id, "grams": "2"}],
        },
    )
    unchanged = (
        "sales",
        "sales_count",
        "average_sale",
        "grams_sold",
        "grams_gifted",
        "cost_of_goods",
        "shortfall",
        "expenses",
        "purchases",
        "cash",
    )

    def snapshot() -> tuple[object, ...]:
        periods = client.get("/panel").json()["periods"]
        return (
            client.get("/sales").json(),
            client.get(f"/customers/{customer['id']}/account").json(),
            client.get("/payments/debtors").json(),
            [[periods[name][key] for key in unchanged] for name in ("today", "week", "month")],
        )

    before = snapshot()
    withdrawal = _record(client, variety_id, reason="own_use")
    assert snapshot() == before
    client.delete(f"/stock/withdrawals/{withdrawal['id']}")
    assert snapshot() == before


def test_the_business_wide_entries_list_holds_no_withdrawal(client: TestClient) -> None:
    variety_id = _variety(client)
    _stock_in(client, variety_id, "50")
    _record(client, variety_id)

    entries = client.get("/stock").json()["entries"]

    assert len(entries) == 1
    assert {entry["origin"] for entry in entries} == {"opening_stock"}
    assert all("reason" not in entry for entry in entries)


def _archive(client: TestClient, variety_id: int) -> None:
    response = client.post(f"/varieties/{variety_id}/archive")
    assert response.status_code == 200, response.text


def _put(client: TestClient, withdrawal_id: int, variety_id: int, **overrides: Any) -> Any:
    return client.put(f"/stock/withdrawals/{withdrawal_id}", json=_body(variety_id, **overrides))


def test_a_withdrawal_cannot_be_recorded_on_an_archived_variety(client: TestClient) -> None:
    archived = _variety(client, "Secreta")
    _stock_in(client, archived, "50")
    _archive(client, archived)
    movements_before = client.get(f"/stock/varieties/{archived}/movements").json()
    stock_before = client.get("/stock?archived=true").json()

    response = client.post(
        "/stock/withdrawals",
        json=_body(archived, lines=[{"variety_id": archived, "grams": "7.5"}]),
    )

    assert response.status_code == 404
    assert response.json()["code"] == "variety.archived"
    for echoed in ("Secreta", "7.5", str(archived)):
        assert echoed not in response.text
    assert client.get(f"/stock/varieties/{archived}/movements").json() == movements_before
    assert client.get("/stock?archived=true").json() == stock_before


def test_an_edit_cannot_add_a_line_on_an_archived_variety_the_withdrawal_never_had(
    client: TestClient,
) -> None:
    mine = _variety(client)
    archived = _variety(client, "Gone")
    withdrawal = _record(client, mine)
    _archive(client, archived)

    response = _put(
        client,
        withdrawal["id"],
        mine,
        lines=[{"variety_id": mine, "grams": "5"}, {"variety_id": archived, "grams": "1"}],
    )

    assert response.status_code == 404
    assert response.json()["code"] == "variety.archived"
    assert client.get(f"/stock/withdrawals/{withdrawal['id']}").json() == withdrawal


def test_an_edit_cannot_move_a_line_onto_a_different_archived_variety(
    client: TestClient,
) -> None:
    kept = _variety(client, "Kept")
    other = _variety(client, "Other")
    withdrawal = _record(client, kept)
    _archive(client, kept)
    _archive(client, other)

    response = _put(client, withdrawal["id"], kept, lines=[{"variety_id": other, "grams": "5"}])

    assert response.status_code == 404
    assert response.json()["code"] == "variety.archived"
    assert client.get(f"/stock/withdrawals/{withdrawal['id']}").json() == withdrawal


def test_an_edit_keeps_a_line_on_a_variety_archived_since_and_may_change_its_grams(
    client: TestClient,
) -> None:
    variety_id = _variety(client, "Kept")
    withdrawal = _record(client, variety_id)
    _archive(client, variety_id)

    edited = _put(
        client,
        withdrawal["id"],
        variety_id,
        date="2026-09-20",
        note="corregido",
        lines=[{"variety_id": variety_id, "grams": "9"}],
    )
    second_line = _put(
        client,
        withdrawal["id"],
        variety_id,
        lines=[
            {"variety_id": variety_id, "grams": "9"},
            {"variety_id": variety_id, "grams": "1"},
        ],
    )

    assert edited.status_code == 200, edited.text
    assert edited.json()["lines"][0]["grams"] == 9.0
    assert edited.json()["date"] == "2026-09-20"
    assert second_line.status_code == 200, second_line.text
    assert len(second_line.json()["lines"]) == 2


def test_a_withdrawal_on_a_variety_archived_since_is_still_read_and_deleted(
    client: TestClient,
) -> None:
    variety_id = _variety(client, "Kept")
    withdrawal = _record(client, variety_id)
    _archive(client, variety_id)

    read = client.get(f"/stock/withdrawals/{withdrawal['id']}")
    movements = client.get(f"/stock/varieties/{variety_id}/movements")
    deleted = client.delete(f"/stock/withdrawals/{withdrawal['id']}")

    assert read.status_code == 200
    assert read.json()["lines"][0]["variety_name"] == "Kept"
    assert movements.status_code == 200
    assert [row["id"] for row in movements.json()] == [withdrawal["id"]]
    assert deleted.status_code == 204


def test_an_unknown_or_foreign_variety_is_still_not_found_on_record_and_edit(
    client: TestClient, other_client: TestClient
) -> None:
    mine = _variety(client)
    foreign = _variety(other_client, "Ajena")
    withdrawal = _record(client, mine)

    for variety_id in (foreign, foreign + 1000):
        recorded = client.post("/stock/withdrawals", json=_body(variety_id))
        edited = _put(client, withdrawal["id"], variety_id)
        for response in (recorded, edited):
            assert response.status_code == 404
            assert response.json()["code"] == "stock.withdrawal_variety_not_found"


def test_an_unknown_line_wins_over_an_archived_line_in_the_same_request(
    client: TestClient,
) -> None:
    archived = _variety(client, "Gone")
    _archive(client, archived)

    response = client.post(
        "/stock/withdrawals",
        json=_body(
            archived,
            lines=[
                {"variety_id": archived, "grams": "1"},
                {"variety_id": archived + 1000, "grams": "1"},
            ],
        ),
    )

    assert response.status_code == 404
    assert response.json()["code"] == "stock.withdrawal_variety_not_found"
