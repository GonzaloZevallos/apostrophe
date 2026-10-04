"""`ClientAddress` (app/accounts/adapters/deps.py): the only reader of `request.client`
and `X-Forwarded-For` in the codebase. Exercised over a throwaway route, through
`TestClient(app, client=(host, port))`, since the dependency is not wired into any
production route in this subtask (the login brake wires it in a later one).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.accounts.adapters.deps import ClientAddressDep
from app.settings import Settings

TRUSTED = Settings(secret_key="k", trusted_proxies=("10.0.0.0/8",))


def _app(settings: Settings) -> FastAPI:
    app = FastAPI()
    app.state.settings = settings

    @app.get("/whoami")
    def whoami(address: ClientAddressDep) -> dict[str, str]:
        return {"address": address}

    return app


def _address(settings: Settings, peer: str, headers: dict[str, str] | None = None) -> str:
    with TestClient(_app(settings), client=(peer, 12345)) as client:
        response = client.get("/whoami", headers=headers or {})
    result: str = response.json()["address"]
    return result


def test_one_trusted_hop_is_read_from_the_header() -> None:
    direct = _address(TRUSTED, "10.0.0.1")
    forwarded = _address(TRUSTED, "10.0.0.1", {"X-Forwarded-For": "203.0.113.9"})

    assert forwarded != direct


def test_two_trusted_hops_plus_a_spoofed_leftmost_entry_take_the_real_client() -> None:
    header = "198.51.100.7, 10.0.0.2, 10.0.0.1"
    spoofed_leftmost = "6.6.6.6, 10.0.0.2, 10.0.0.1"

    real_client = _address(TRUSTED, "10.0.0.1", {"X-Forwarded-For": header})
    with_spoofed_leftmost = _address(TRUSTED, "10.0.0.1", {"X-Forwarded-For": spoofed_leftmost})

    # The leftmost entry is attacker-controlled and never trusted; only the first
    # untrusted entry counted from the right (198.51.100.7) decides the address.
    assert real_client != with_spoofed_leftmost


def test_an_untrusted_peer_with_the_header_present_is_ignored() -> None:
    from_peer = _address(TRUSTED, "203.0.113.9")
    with_header = _address(TRUSTED, "203.0.113.9", {"X-Forwarded-For": "198.51.100.7"})

    assert from_peer == with_header


def test_an_unparsable_entry_falls_back_to_the_peer() -> None:
    from_peer = _address(TRUSTED, "10.0.0.1")
    with_bad_header = _address(TRUSTED, "10.0.0.1", {"X-Forwarded-For": "not-an-ip"})

    assert from_peer == with_bad_header


def test_a_missing_header_falls_back_to_the_peer() -> None:
    from_peer = _address(TRUSTED, "10.0.0.1")
    without_header = _address(TRUSTED, "10.0.0.1")

    assert from_peer == without_header
