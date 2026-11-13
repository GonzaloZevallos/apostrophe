"""The sale body's `payment` for the words tests use: "cash", "transfer" or "owing". A
business opens with Cash and Transfer, ids 1 and 2 for the first business of a test; a
second business of the same test passes its `client` and the ids are read from its list."""

from typing import Any

from fastapi.testclient import TestClient


def payment_body(word: str | None, client: TestClient | None = None) -> dict[str, Any] | None:
    if word is None:
        return None
    if word == "owing":
        return {"kind": "owing"}
    if client is None:
        return {"kind": "paid", "payment_method_id": {"cash": 1, "transfer": 2}[word]}
    offered = client.get("/api/payment-methods").json()
    method = next(entry for entry in offered if entry["name"].lower() == word)
    return {"kind": "paid", "payment_method_id": method["id"]}
