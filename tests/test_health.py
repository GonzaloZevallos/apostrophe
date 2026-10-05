"""`/health` is outside the session gate (UptimeRobot pings it unauthenticated every 5
minutes) and must carry no business data at all: no name, id or count, not even that
one exists (CODING_STANDARDS section 9; PM's metrics for this task).
"""

from fastapi.testclient import TestClient


def test_health_answers_exactly_status_ok(anonymous_client: TestClient) -> None:
    response = anonymous_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
