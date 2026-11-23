"""M32 (docs/product/expenses.md): choosing a Payment method for an expense changes no
total. The same expenses are recorded without a method, the Panel (Week and Month) and the
Analysis are read, every expense is edited to carry a method, and the figures are read
again: they are equal to the peso."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

TODAY = "2026-10-02"


def _figures(client: TestClient) -> dict[str, Any]:
    panel = client.get("/panel")
    analysis = client.get("/analysis")
    assert panel.status_code == 200, panel.text
    assert analysis.status_code == 200, analysis.text
    return {"panel": panel.json(), "analysis": analysis.json()}


def test_recording_a_method_on_expenses_changes_no_panel_or_analysis_figure(
    client: TestClient,
) -> None:
    categories = {c["name"]: c["id"] for c in client.get("/expense-categories").json()}
    empty = _figures(client)
    bodies = [
        {"spent_on": TODAY, "category_id": categories["Other"], "amount": 1_000, "detail": "a"},
        {"spent_on": "2026-10-01", "category_id": categories["Packaging"], "amount": 2_500},
        {
            "spent_on": "2026-09-30",
            "category_id": categories["Other"],
            "amount": 700,
            "detail": "c",
        },
    ]
    ids = []
    for body in bodies:
        recorded = client.post("/expenses", json=body)
        assert recorded.status_code == 201, recorded.text
        ids.append(recorded.json()["id"])
    without = _figures(client)
    assert without != empty, "the expenses must move the figures, or this proves nothing"

    transfer = next(
        m["id"] for m in client.get("/api/payment-methods").json() if m["name"] == "Transfer"
    )
    for expense_id, body in zip(ids, bodies, strict=True):
        edited = client.put(f"/expenses/{expense_id}", json={**body, "payment_method_id": transfer})
        assert edited.status_code == 200, edited.text
        assert edited.json()["payment_method"]["id"] == transfer

    assert _figures(client) == without
