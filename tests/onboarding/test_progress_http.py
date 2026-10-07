"""`/onboarding-progress` over HTTP (docs/adr/0032): the Onboarding's one answer, read and
written through the session's own business, over the real owners' adapters."""

from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import MovableClock

STEP_NAMES = ["variety", "stock", "header_footer", "bot", "partner", "categories"]


def _states(answer: dict[str, Any]) -> dict[str, str]:
    return {item["step"]: item["state"] for item in answer["steps"]}


def test_a_new_business_is_offered_the_onboarding_at_its_first_step(client: TestClient) -> None:
    response = client.get("/onboarding-progress")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "offered": True,
        "over": False,
        "count": 0,
        "resume": "variety",
        "steps": [{"step": name, "state": "pending"} for name in STEP_NAMES],
        "can_skip_rest": False,
        "varieties_count": 0,
        "stock_entries_count": 0,
        "price_target": None,
        "stock_target": None,
    }


def test_clock_fixture_is_used(clock: MovableClock) -> None:
    assert clock() is not None
