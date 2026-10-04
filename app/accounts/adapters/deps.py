"""The session gate and the business every request is scoped to (docs/adr/0002,
docs/adr/0004).

`require_session` sits in front of every capability router (`app.main`);
`CurrentBusinessId` is how an endpoint learns which business it serves. The business
never comes from the URL or the body: only from the session.
"""

import hashlib
import hmac
from collections.abc import Callable
from ipaddress import IPv4Address, IPv4Network, IPv6Address, IPv6Network, ip_address
from typing import Annotated, NoReturn, cast

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application.ports import BusinessOpening
from app.accounts.application.sign_in import SignedIn, open_session
from app.accounts.domain.address import address_key
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SessionSigner
from app.clock import Clock, get_clock
from app.db import get_session
from app.settings import Settings

SESSION_COOKIE = "apostrophe_session"

# Its own fixed context, never shared with another HMAC use (session fingerprints,
# password hashes): a digest from one context can never be replayed as another's.
_CLIENT_ADDRESS_CONTEXT = "accounts.client-address.v1"

# `auto_error=False`: the default would answer its own 401 before the cookie is looked at.
bearer_scheme = HTTPBearer(auto_error=False)


def get_signer(request: Request) -> SessionSigner:
    # Starlette's `State` is untyped; `create_app` always assigns these three.
    return cast(SessionSigner, request.app.state.signer)


def get_hasher(request: Request) -> PasswordHasher:
    return cast(PasswordHasher, request.app.state.hasher)


def get_public_url(request: Request) -> str:
    return cast(str, request.app.state.public_url)


def get_settings(request: Request) -> Settings:
    # Starlette's `State` is untyped; `create_app` always assigns a `Settings`.
    return cast(Settings, request.app.state.settings)


def get_accounts(session: Annotated[Session, Depends(get_session)]) -> SqlAccounts:
    return SqlAccounts(session)


def get_business_opening(
    request: Request, session: Annotated[Session, Depends(get_session)]
) -> BusinessOpening:
    # Starlette's `State` is untyped; `create_app` always assigns this factory.
    factory = cast(Callable[[Session], BusinessOpening], request.app.state.business_opening)
    return factory(session)


def raise_unauthenticated() -> NoReturn:
    raise HTTPException(
        status_code=401, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"}
    )


def require_session(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)],
    accounts: Annotated[SqlAccounts, Depends(get_accounts)],
    signer: Annotated[SessionSigner, Depends(get_signer)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> SignedIn:
    token = credentials.credentials if credentials else request.cookies.get(SESSION_COOKIE)
    signed_in = None if token is None else open_session(accounts, signer, token, clock())
    if signed_in is None:
        raise_unauthenticated()
    return signed_in


CurrentSession = Annotated[SignedIn, Depends(require_session)]


def current_business_id(signed_in: CurrentSession) -> int:
    return signed_in.business_id


CurrentBusinessId = Annotated[int, Depends(current_business_id)]


def _parse_ip(raw: str) -> IPv4Address | IPv6Address | None:
    try:
        return ip_address(raw.strip())
    except ValueError:
        return None


def _is_trusted(
    ip: IPv4Address | IPv6Address, networks: tuple[IPv4Network | IPv6Network, ...]
) -> bool:
    return any(network.version == ip.version and ip in network for network in networks)


def _forwarded_client(
    header: str, networks: tuple[IPv4Network | IPv6Network, ...]
) -> IPv4Address | IPv6Address | None:
    """Walks `X-Forwarded-For` from the right, past entries inside `networks`, and
    answers the first untrusted one. `None` (fall back to the peer) when an entry it
    walks over cannot be parsed, or every entry is trusted."""
    for raw in reversed(header.split(",")):
        parsed = _parse_ip(raw)
        if parsed is None:
            return None
        if not _is_trusted(parsed, networks):
            return parsed
    return None


def client_address(request: Request, settings: Annotated[Settings, Depends(get_settings)]) -> str:
    """The only reader of `request.client` and `X-Forwarded-For` in the codebase
    (plan invariant). Answers an HMAC-SHA256 digest, under `APOSTROPHE_SECRET_KEY` and
    its own context, of the canonicalised address (`address_key`) — the raw IP never
    leaves this function: never logged, never in an exception message."""
    peer_host = request.client.host if request.client else None
    peer = _parse_ip(peer_host) if peer_host else None
    networks = settings.trusted_networks()
    candidate = peer
    if peer is not None and _is_trusted(peer, networks):
        header = request.headers.get("x-forwarded-for")
        if header:
            forwarded = _forwarded_client(header, networks)
            if forwarded is not None:
                candidate = forwarded
    # `candidate` is `None` only when the peer itself could not be read as an address
    # (never true over a real connection; ASGI always gives one, and the test client's
    # own default stand-in is never trusted anyway). Digest the opaque text instead of
    # raising, so a request is still braked rather than ever failing open.
    canonical = address_key(candidate) if candidate is not None else (peer_host or "")
    digest = hmac.new(
        settings.secret_key.encode(),
        f"{_CLIENT_ADDRESS_CONTEXT}:{canonical}".encode(),
        hashlib.sha256,
    )
    return digest.hexdigest()


ClientAddressDep = Annotated[str, Depends(client_address)]
