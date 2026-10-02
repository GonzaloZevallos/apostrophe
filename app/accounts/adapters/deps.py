"""The session gate and the business every request is scoped to (docs/adr/0002,
docs/adr/0004).

`require_session` sits in front of every capability router (`app.main`);
`CurrentBusinessId` is how an endpoint learns which business it serves. The business
never comes from the URL or the body: only from the session.
"""

from collections.abc import Callable
from typing import Annotated, NoReturn, cast

from fastapi import Depends, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application.ports import BusinessOpening
from app.accounts.application.sign_in import SignedIn, open_session
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SessionSigner
from app.clock import Clock, get_clock
from app.db import get_session

SESSION_COOKIE = "apostrophe_session"

# `auto_error=False`: the default would answer its own 401 before the cookie is looked at.
bearer_scheme = HTTPBearer(auto_error=False)


def get_signer(request: Request) -> SessionSigner:
    # Starlette's `State` is untyped; `create_app` always assigns these three.
    return cast(SessionSigner, request.app.state.signer)


def get_hasher(request: Request) -> PasswordHasher:
    return cast(PasswordHasher, request.app.state.hasher)


def get_public_url(request: Request) -> str:
    return cast(str, request.app.state.public_url)


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
