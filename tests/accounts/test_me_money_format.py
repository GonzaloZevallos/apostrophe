"""`GET /auth/me` carries the signed-in business's money format (symbol and decimals), read
through accounts' own port, and never the scale it stores amounts at (docs/adr/0058)."""

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine


def test_me_answers_the_dollar_format_of_the_fixture_business(client: TestClient) -> None:
    assert client.get("/auth/me").json()["money"] == {"symbol": "$", "decimals": 0}


def test_me_answers_the_own_format_of_a_business_set_to_another(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE money_format SET symbol = 'US$', decimals = 2, scale = 2"
                " WHERE business_id = 2"
            )
        )

    assert other_client.get("/auth/me").json()["money"] == {"symbol": "US$", "decimals": 2}
    assert client.get("/auth/me").json()["money"] == {"symbol": "$", "decimals": 0}


def test_me_never_carries_the_scale(client: TestClient) -> None:
    money = client.get("/auth/me").json()["money"]

    assert set(money) == {"symbol", "decimals"}
