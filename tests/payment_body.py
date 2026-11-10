"""The sale body's `payment` for the words tests use: "cash", "transfer" or "owing". A
business opens with Cash and Transfer, ids 1 and 2 for the first business of a test."""

from typing import Any


def payment_body(word: str | None) -> dict[str, Any] | None:
    if word is None:
        return None
    if word == "owing":
        return {"kind": "owing"}
    return {"kind": "paid", "payment_method_id": {"cash": 1, "transfer": 2}[word]}
