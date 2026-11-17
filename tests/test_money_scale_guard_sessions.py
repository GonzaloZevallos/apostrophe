"""The commit-time money scale guard through the HTTP API (docs/adr/0058): the failure is
FastAPI's default 500 carrying nothing, and requests that touch no amount pay nothing.

Seam: `TestClient` over the real app. The business opens at scale 0: the guard only has
something to catch where a rescale to 2 is still possible.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from httpx2 import Response
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import _refuse_a_stale_money_scale, get_session, money_scale_factor
from tests.statement_log import captured_statements


@pytest.fixture
def money_scale() -> int:
    return 0


def _business_id(engine: Engine) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text("SELECT business_id FROM money_format")).scalar_one())


def _stored_scale(engine: Engine) -> int:
    with engine.connect() as connection:
        return int(connection.execute(text("SELECT scale FROM money_format")).scalar_one())


def test_a_write_over_a_moved_scale_answers_a_bare_500(
    app: FastAPI, client: TestClient, engine: Engine
) -> None:
    business_id = _business_id(engine)

    @app.post("/__probe/stale-write")
    def stale_write(session: Annotated[Session, Depends(get_session)]) -> None:
        money_scale_factor(session, business_id)
        session.execute(text("UPDATE money_format SET scale = 2"))
        session.commit()

    with TestClient(app, raise_server_exceptions=False) as http:
        response = http.post("/__probe/stale-write")

    assert response.status_code == 500
    assert response.text == "Internal Server Error"
    assert "scale" not in response.text
    assert _stored_scale(engine) == 0


def _money_format_reads(engine: Engine, request: Callable[[], Response]) -> int:
    with captured_statements(engine) as statements:
        response = request()
    assert response.status_code == 200, response.text
    return sum("money_format" in statement for statement, _ in statements)


def _without_the_guard(request: Callable[[], Response], engine: Engine) -> int:
    """The `money_format` reads `request` makes with the commit-time listener detached."""
    event.remove(Session, "before_commit", _refuse_a_stale_money_scale)
    try:
        return _money_format_reads(engine, request)
    finally:
        event.listen(Session, "before_commit", _refuse_a_stale_money_scale)


def test_a_read_only_request_gets_no_money_format_read_from_the_listener(
    client: TestClient, engine: Engine
) -> None:
    def listing() -> Response:
        return client.get("/api/products")

    assert _money_format_reads(engine, listing) == _without_the_guard(listing, engine)


def test_a_write_that_touches_no_amount_issues_no_money_format_statement(
    client: TestClient, engine: Engine
) -> None:
    """A withdrawal reason's rename caches no factor, so the commit listener has nothing to
    re-read. (A product rename does load prices, which caches one: not this case.)"""
    created = client.post("/api/withdrawal-reasons", json={"name": "Gift"})
    assert created.status_code == 201, created.text

    def rename() -> Response:
        return client.patch(
            f"/api/withdrawal-reasons/{created.json()['id']}", json={"name": "Free"}
        )

    assert _money_format_reads(engine, rename) == 0
