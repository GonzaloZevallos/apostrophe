"""Getting in: invitations, login, the brake and the session, over HTTP."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.accounts.adapters.deps import SESSION_COOKIE
from tests.conftest import NOW, PASSWORD, MovableClock, invite

NEW_USER = {"email": "nueva@example.com", "password": PASSWORD, "business_name": "La Huerta"}


def test_a_new_business_invitation_opens_a_business_and_signs_its_user_in(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = invite(engine, clock())

    looked_up = anonymous_client.get(f"/invitations/{token}").json()
    accepted = anonymous_client.post(f"/invitations/{token}/accept", json=NEW_USER)

    assert looked_up["kind"] == "new_business" and looked_up["business_name"] is None
    assert accepted.status_code == 201
    assert SESSION_COOKIE in accepted.cookies
    me = anonymous_client.get("/auth/me").json()
    assert me == {
        "email": "nueva@example.com",
        "business_name": "La Huerta",
        "today": "2026-10-02",
    }


def test_today_on_me_follows_the_moved_clock(client: TestClient, clock: MovableClock) -> None:
    assert client.get("/auth/me").json()["today"] == "2026-10-02"

    clock.set(NOW + timedelta(days=1))

    assert client.get("/auth/me").json()["today"] == "2026-10-03"


def test_an_invitation_works_once(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = invite(engine, clock())
    anonymous_client.post(f"/invitations/{token}/accept", json=NEW_USER)

    again = {**NEW_USER, "email": "otra@example.com"}

    assert anonymous_client.post(f"/invitations/{token}/accept", json=again).status_code == 404
    assert anonymous_client.get(f"/invitations/{token}").status_code == 404


def test_an_invitation_expires_after_seven_days(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = invite(engine, clock())

    clock.set(NOW + timedelta(days=7))

    assert anonymous_client.post(f"/invitations/{token}/accept", json=NEW_USER).status_code == 404


def test_an_unknown_invitation_is_not_found(anonymous_client: TestClient) -> None:
    assert anonymous_client.get("/invitations/nope").status_code == 404
    accepted = anonymous_client.post("/invitations/nope/accept", json=NEW_USER)
    assert accepted.status_code == 404


def test_accepting_refuses_a_bad_email_a_weak_password_or_a_missing_business_name(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = invite(engine, clock())

    def status(**changes: object) -> int:
        body = {**NEW_USER, **changes}
        return anonymous_client.post(f"/invitations/{token}/accept", json=body).status_code

    assert status(email="not an email") == 422
    assert status(password="short") == 422
    assert status(business_name=None) == 422
    # None of the refusals spent the invitation.
    assert status() == 201


def test_an_email_has_one_user_across_every_business(
    client: TestClient, anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    token = invite(engine, clock())
    taken = {**NEW_USER, "email": "UNO@example.com"}

    assert anonymous_client.post(f"/invitations/{token}/accept", json=taken).status_code == 409


def test_a_partner_invitation_adds_a_user_to_the_inviting_business(
    client: TestClient, anonymous_client: TestClient
) -> None:
    issued = client.post("/invitations")
    token = issued.json()["url"].rsplit("/", 1)[-1]

    looked_up = anonymous_client.get(f"/invitations/{token}").json()
    partner = {**NEW_USER, "email": "socio@example.com", "business_name": "Ignored"}
    accepted = anonymous_client.post(f"/invitations/{token}/accept", json=partner)

    assert issued.status_code == 201
    assert issued.json()["url"].startswith("http://localhost:8000/invitation/")
    assert looked_up == {
        "kind": "join_business",
        "business_name": "Primer Negocio",
        "expires_at": looked_up["expires_at"],
    }
    assert accepted.status_code == 201
    assert anonymous_client.get("/auth/me").json()["business_name"] == "Primer Negocio"


def test_login_answers_a_session_for_the_right_email_and_password(
    client: TestClient, anonymous_client: TestClient
) -> None:
    login = anonymous_client.post(
        "/auth/login", json={"email": " Uno@Example.com", "password": PASSWORD}
    )

    assert login.status_code == 200
    anonymous_client.cookies.clear()
    me = anonymous_client.get(
        "/auth/me", headers={"Authorization": f"Bearer {login.json()['token']}"}
    )
    assert me.json()["email"] == "uno@example.com"


def test_a_wrong_password_and_an_unknown_email_are_refused_alike(
    client: TestClient, anonymous_client: TestClient
) -> None:
    wrong = anonymous_client.post(
        "/auth/login", json={"email": "uno@example.com", "password": "wrong password"}
    )
    unknown = anonymous_client.post(
        "/auth/login", json={"email": "nadie@example.com", "password": PASSWORD}
    )

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert SESSION_COOKIE not in wrong.cookies


def test_five_failures_brake_the_email_even_with_the_right_password_then_release_it(
    client: TestClient, anonymous_client: TestClient, clock: MovableClock
) -> None:
    def login(password: str) -> int:
        body = {"email": "uno@example.com", "password": password}
        return anonymous_client.post("/auth/login", json=body).status_code

    assert [login("wrong password") for _ in range(5)] == [401] * 5
    assert login(PASSWORD) == 429
    clock.set(NOW + timedelta(minutes=15))
    assert login(PASSWORD) == 200


def test_an_unknown_email_is_braked_too(anonymous_client: TestClient) -> None:
    body = {"email": "nadie@example.com", "password": "wrong password"}
    statuses = [anonymous_client.post("/auth/login", json=body).status_code for _ in range(6)]

    assert statuses == [401] * 5 + [429]


def test_no_session_a_tampered_one_or_an_expired_one_is_refused(
    client: TestClient, anonymous_client: TestClient, clock: MovableClock
) -> None:
    token = client.headers["Authorization"].removeprefix("Bearer ")
    tampered = token[:-1] + ("0" if token[-1] != "0" else "1")

    def me(token: str) -> int:
        headers = {"Authorization": f"Bearer {token}"}
        return anonymous_client.get("/auth/me", headers=headers).status_code

    assert anonymous_client.get("/auth/me").status_code == 401
    assert me(tampered) == 401
    assert me(token) == 200
    clock.set(NOW + timedelta(days=30, seconds=1))
    assert me(token) == 401


def test_logging_out_drops_the_cookie(
    anonymous_client: TestClient, engine: Engine, clock: MovableClock
) -> None:
    anonymous_client.post(f"/invitations/{invite(engine, clock())}/accept", json=NEW_USER)

    assert anonymous_client.post("/auth/logout").status_code == 204
    assert anonymous_client.get("/auth/me").status_code == 401


def test_health_answers_without_a_session(anonymous_client: TestClient) -> None:
    assert anonymous_client.get("/health").json() == {"status": "ok"}


def test_refusal_bodies_carry_the_rule_s_code(
    anonymous_client: TestClient,
    client: TestClient,
    engine: Engine,
    clock: MovableClock,
) -> None:
    """One behaviour test per code family of this capability (docs/adr/0007): the
    front dispatches on `code`, never on `detail`."""
    not_usable = anonymous_client.post("/invitations/nope/accept", json=NEW_USER)
    assert not_usable.status_code == 404
    assert not_usable.json()["code"] == "account.invitation_not_usable"

    token = invite(engine, clock())
    taken = {**NEW_USER, "email": "UNO@example.com"}
    email_taken = anonymous_client.post(f"/invitations/{token}/accept", json=taken)
    assert email_taken.status_code == 409
    assert email_taken.json()["code"] == "account.email_taken"

    for _ in range(5):
        anonymous_client.post(
            "/auth/login", json={"email": "uno@example.com", "password": "wrong password"}
        )
    locked = anonymous_client.post(
        "/auth/login", json={"email": "uno@example.com", "password": PASSWORD}
    )
    assert locked.status_code == 429
    assert locked.json()["code"] == "account.login_locked"


def test_get_business_shows_its_name_and_its_users_sorted_by_email(
    client: TestClient, other_client: TestClient
) -> None:
    client.post("/invitations")

    business = client.get("/business")

    assert business.status_code == 200
    assert business.json() == {"name": "Primer Negocio", "users": [{"email": "uno@example.com"}]}
    # The business comes only from the session: another business's own call answers
    # its own business, never business `client`'s (CODING_STANDARDS §9).
    assert other_client.get("/business").json()["name"] == "Otro Negocio"


def test_patch_business_renames_only_the_caller_s_own_business(
    client: TestClient, other_client: TestClient
) -> None:
    renamed = client.patch("/business", json={"name": "La Huerta Nueva"})

    assert renamed.status_code == 200
    assert renamed.json()["name"] == "La Huerta Nueva"
    assert client.get("/auth/me").json()["business_name"] == "La Huerta Nueva"
    # Unaffected: the business comes from the session, never the request.
    assert other_client.get("/business").json()["name"] == "Otro Negocio"


def test_patch_business_refuses_a_blank_name(client: TestClient) -> None:
    refused = client.patch("/business", json={"name": "   "})

    assert refused.status_code == 422
    assert refused.json()["code"] == "account.business_name_invalid"
