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
    # The rightmost entry (10.0.0.2) is a trusted hop, skipped; the walk then stops at
    # the first untrusted entry (198.51.100.7), before it ever reaches the leftmost
    # one. Two different spoofed leftmost entries must therefore give the same, real,
    # address -- a reader that instead looked at the leftmost entry would tell them
    # apart.
    header_a = "6.6.6.6, 198.51.100.7, 10.0.0.2"
    header_b = "7.7.7.7, 198.51.100.7, 10.0.0.2"

    with_spoofed_a = _address(TRUSTED, "10.0.0.1", {"X-Forwarded-For": header_a})
    with_spoofed_b = _address(TRUSTED, "10.0.0.1", {"X-Forwarded-For": header_b})
    direct_untrusted_peer = _address(TRUSTED, "198.51.100.7")

    assert with_spoofed_a == with_spoofed_b == direct_untrusted_peer


def test_an_untrusted_peer_with_the_header_present_is_ignored() -> None:
    from_peer = _address(TRUSTED, "203.0.113.9")
    with_header = _address(TRUSTED, "203.0.113.9", {"X-Forwarded-For": "198.51.100.7"})

    assert from_peer == with_header


def test_an_unparsable_entry_falls_back_to_the_peer() -> None:
    from_peer = _address(TRUSTED, "10.0.0.1")
    with_bad_header = _address(TRUSTED, "10.0.0.1", {"X-Forwarded-For": "not-an-ip"})

    assert from_peer == with_bad_header


def test_a_missing_header_falls_back_to_the_peer() -> None:
    # A header present but entirely trusted hops must fall back to the very same
    # address as no header at all -- and that fallback must be the peer's own
    # address, not some other constant: it differs from a real forwarded client.
    all_trusted_header = "10.0.0.3, 10.0.0.2"
    forwarded_header = "198.51.100.7, 10.0.0.2"

    without_header = _address(TRUSTED, "10.0.0.1")
    with_all_trusted_header = _address(TRUSTED, "10.0.0.1", {"X-Forwarded-For": all_trusted_header})
    forwarded = _address(TRUSTED, "10.0.0.1", {"X-Forwarded-For": forwarded_header})

    assert without_header == with_all_trusted_header
    assert without_header != forwarded
