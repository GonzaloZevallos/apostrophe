"""`deploy/README.md`'s Render section documents the exact value an operator pastes
into `APOSTROPHE_TRUSTED_PROXIES`. A previous review found that value set to
`0.0.0.0/0`: every address matches it, so `ClientAddress`'s walk from the right
(`app/accounts/adapters/deps.py`) never finds an untrusted entry and always falls back
to the peer -- Render's own load balancer, the same for every request. Every seller
then shares one address bucket, and 20 failed logins from anyone lock logins out for
everyone (PRD criterion 2's per-address brake, defeated).

This guards the documented value itself, not just the general mechanism already
proven in `test_client_address.py`: if the README's value ever regresses to a
catch-all again, this test fails on the exact text an operator would paste.
"""

from __future__ import annotations

import re
from ipaddress import ip_address
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.accounts.adapters.deps import ClientAddressDep
from app.settings import Settings

REPO_ROOT = Path(__file__).resolve().parents[2]
README = REPO_ROOT / "deploy" / "README.md"


def _documented_trusted_proxies() -> tuple[str, ...]:
    text = README.read_text()
    match = re.search(r"APOSTROPHE_TRUSTED_PROXIES=([0-9./,]+)", text)
    assert match is not None, "deploy/README.md must document a concrete value"
    return tuple(cidr for cidr in match.group(1).split(",") if cidr)


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


def test_the_documented_value_does_not_cover_a_public_address() -> None:
    """The input this guards against: a value every address matches (`0.0.0.0/0` or
    equivalent) would make a plainly public address -- a real client's -- count as
    "trusted" too, the mistake that made `ClientAddress`'s walk fall back to the peer
    on every request. The README's configured value must not do that."""
    settings = Settings(secret_key="k", trusted_proxies=_documented_trusted_proxies())
    networks = settings.trusted_networks()
    public_address = ip_address("198.51.100.7")

    assert not any(public_address in network for network in networks)


def test_the_documented_value_still_tells_two_render_sellers_apart() -> None:
    """The positive case: with the README's own configured value, a peer inside the
    trusted range forwarding a header with a forged leftmost entry and a genuine
    public client on the right resolves to that real client -- and two different real
    clients resolve to two different addresses, so the per-address brake still keys on
    the seller, not on Render's shared edge."""
    settings = Settings(secret_key="k", trusted_proxies=_documented_trusted_proxies())
    peer = "10.1.2.3"

    client_a = _address(settings, peer, {"X-Forwarded-For": "6.6.6.6, 198.51.100.7"})
    client_b = _address(settings, peer, {"X-Forwarded-For": "7.7.7.7, 198.51.100.8"})
    direct_peer_only = _address(settings, peer)

    assert client_a != client_b
    assert client_a != direct_peer_only
    assert client_b != direct_peer_only
