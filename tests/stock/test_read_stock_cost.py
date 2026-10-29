"""What `GET /stock` costs, in statements (docs/adr/0038: counts, never elapsed time):
`stock_entry` is read once, and the number of statements does not grow with the data."""

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from tests.fakes.archive import archive_by_hand
from tests.statement_log import captured_statements


def _variety(client: TestClient, name: str) -> int:
    variety = client.post("/api/products", json={"name": name}).json()
    priced = client.post(
        f"/api/products/{variety['id']}/prices",
        json={"effective_from": "2020-01-01", "list_price": 10_000},
    )
    assert priced.status_code == 201, priced.text
    return int(variety["id"])


def _post(client: TestClient, path: str, body: dict[str, Any]) -> None:
    response = client.post(path, json=body)
    assert response.status_code == 201, response.text


def _entry(client: TestClient, variety_id: int, quantity: str) -> None:
    _post(
        client,
        "/stock/entries",
        {"variety_id": variety_id, "origin": "opening_stock", "quantity": quantity},
    )


def _sale_and_withdrawal(client: TestClient, variety_id: int) -> None:
    _post(
        client,
        "/sales",
        {"payment": "cash", "lines": [{"variety_id": variety_id, "quantity": "1"}]},
    )
    _post(
        client,
        "/stock/withdrawals",
        {"reason": "own_use", "lines": [{"variety_id": variety_id, "quantity": "1"}]},
    )


def _seed_small(client: TestClient) -> None:
    variety_id = _variety(client, "Only")
    _entry(client, variety_id, "50")
    _sale_and_withdrawal(client, variety_id)


def _seed_bigger(client: TestClient, engine: Engine) -> None:
    variety_ids = [_variety(client, f"Variety {i}") for i in range(4)]
    for variety_id in variety_ids:
        for _ in range(3):
            _entry(client, variety_id, "20")
        _sale_and_withdrawal(client, variety_id)
    archived = _variety(client, "Archived")
    _entry(client, archived, "15")
    archive_by_hand(engine, archived)


def _get_stock(engine: Engine, client: TestClient) -> list[tuple[str, object]]:
    with captured_statements(engine) as statements:
        response = client.get("/stock")
        assert response.status_code == 200, response.text
    return statements


def test_get_stock_reads_stock_entry_once(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _seed_bigger(client, engine)
    _seed_small(other_client)

    for who in (client, other_client):
        statements = _get_stock(engine, who)

        stock_entry_reads = [sql for sql, _ in statements if "from stock_entry" in sql.lower()]
        assert len(stock_entry_reads) == 1, stock_entry_reads


def test_get_stock_issues_the_same_number_of_statements_small_or_seeded(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _seed_small(client)
    _seed_bigger(other_client, engine)

    small_count = len(_get_stock(engine, client))
    big_count = len(_get_stock(engine, other_client))

    assert small_count == big_count, (small_count, big_count)
