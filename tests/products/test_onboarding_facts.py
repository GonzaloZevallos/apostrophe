"""`SqlVarietyFacts`, the Onboarding's `VarietyFacts` port as Variedades implements it
(docs/adr/0036): the listed varieties in Variedades' name order, over real SQLite.

A business comes from the `client` fixture over HTTP (CODING_STANDARDS section 5); only
the adapter, the seam under test, is built and called directly."""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import UserRow
from app.onboarding.domain.progress import VarietyFact
from app.products.adapters.onboarding_facts import SqlProductFacts
from tests.conftest import TODAY


def _facts(engine: Engine) -> list[VarietyFact]:
    with Session(engine) as session:
        row = session.scalar(select(UserRow).where(UserRow.email == "uno@example.com"))
        assert row is not None
        return SqlProductFacts(session, row.business_id, TODAY).varieties()


def _variety(client: TestClient, name: str) -> int:
    created = client.post("/api/products", json={"name": name})
    assert created.status_code == 201, created.text
    return int(created.json()["id"])


def test_the_facts_come_in_variedades_name_order_not_in_id_or_byte_order(
    client: TestClient, engine: Engine
) -> None:
    zeta = _variety(client, "Zeta")
    alfa = _variety(client, "alfa")
    dust = _variety(client, "Blue   Dust")
    dream = _variety(client, "Blue Dream")

    facts = _facts(engine)

    assert [(fact.id, fact.name) for fact in facts] == [
        (alfa, "alfa"),
        (dream, "Blue Dream"),
        (dust, "Blue Dust"),
        (zeta, "Zeta"),
    ]
    assert [fact.id for fact in facts] != sorted(fact.id for fact in facts)
    assert [fact.name for fact in facts] != sorted(fact.name for fact in facts)


def test_an_archived_variety_is_not_a_fact_and_a_price_today_marks_the_priced_ones(
    client: TestClient, engine: Engine
) -> None:
    priced = _variety(client, "Nuez")
    unpriced = _variety(client, "Almendra")
    archived = _variety(client, "Zapallo")
    price = client.post(
        f"/api/products/{priced}/prices",
        json={"effective_from": TODAY.isoformat(), "list_price": 11_000},
    )
    assert price.status_code == 201, price.text
    assert client.post(f"/api/products/{archived}/archive").status_code == 200

    facts = _facts(engine)

    assert facts == [
        VarietyFact(id=unpriced, name="Almendra", is_priced_today=False),
        VarietyFact(id=priced, name="Nuez", is_priced_today=True),
    ]
