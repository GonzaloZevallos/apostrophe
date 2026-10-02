from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import (
    SESSION_COOKIE,
    CurrentSession,
    get_accounts,
    get_business_opening,
    get_hasher,
    get_public_url,
    get_signer,
    raise_unauthenticated,
)
from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application import invitations
from app.accounts.application.invitations import EmailTaken
from app.accounts.application.ports import BusinessOpening
from app.accounts.application.sign_in import LoginLocked, log_in
from app.accounts.domain.account import AccountRuleBroken
from app.accounts.domain.invitation import InvitationKind, InvitationNotUsable
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SESSION_LIFETIME, SessionSigner
from app.clock import Clock, get_clock
from app.db import get_session
from app.http_errors import TranslateErrors

# Public: how a user gets a session. Every other accounts route is gated in `app.main`.
public_router = APIRouter(tags=["accounts"])
router = APIRouter(tags=["accounts"])

AccountsDep = Annotated[SqlAccounts, Depends(get_accounts)]
SessionDep = Annotated[Session, Depends(get_session)]
HasherDep = Annotated[PasswordHasher, Depends(get_hasher)]
SignerDep = Annotated[SessionSigner, Depends(get_signer)]
ClockDep = Annotated[Clock, Depends(get_clock)]

as_http = TranslateErrors(
    [
        (404, (InvitationNotUsable,)),
        (409, (EmailTaken,)),
        (422, (AccountRuleBroken,)),
        (429, (LoginLocked,)),
    ]
)


class LoginIn(BaseModel):
    email: str
    password: str


class SessionOut(BaseModel):
    token: str


class MeOut(BaseModel):
    email: str
    business_name: str


class InvitationOut(BaseModel):
    url: str
    expires_at: datetime


class InvitationViewOut(BaseModel):
    kind: InvitationKind
    business_name: str | None
    expires_at: datetime


class AcceptIn(BaseModel):
    email: str
    password: str
    # Required by a new-business invitation; ignored by a join invitation.
    business_name: str | None = None


def invitation_url(public_url: str, token: str) -> str:
    return f"{public_url}/invitation/{token}"


def _open(response: Response, token: str) -> SessionOut:
    # Not `secure`: served over plain http on the home network until it is published
    # (docs/adr/0002).
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        samesite="lax",
    )
    return SessionOut(token=token)


@public_router.post("/auth/login")
def login(
    body: LoginIn,
    response: Response,
    accounts: AccountsDep,
    session: SessionDep,
    hasher: HasherDep,
    signer: SignerDep,
    clock: ClockDep,
) -> SessionOut:
    with as_http:
        token = log_in(accounts, session, hasher, signer, body.email, body.password, clock())
    if token is None:
        raise_unauthenticated()
    return _open(response, token)


@public_router.post("/auth/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE)


@public_router.get("/invitations/{token}")
def look_up_invitation(token: str, accounts: AccountsDep, clock: ClockDep) -> InvitationViewOut:
    with as_http:
        view = invitations.look_up_invitation(accounts, token, clock())
    return InvitationViewOut(
        kind=view.kind, business_name=view.business_name, expires_at=view.expires_at
    )


@public_router.post("/invitations/{token}/accept", status_code=201)
def accept_invitation(
    token: str,
    body: AcceptIn,
    response: Response,
    accounts: AccountsDep,
    session: SessionDep,
    hasher: HasherDep,
    signer: SignerDep,
    clock: ClockDep,
    opening: Annotated[BusinessOpening, Depends(get_business_opening)],
) -> SessionOut:
    with as_http:
        session_token = invitations.accept_invitation(
            accounts,
            session,
            hasher,
            signer,
            token,
            body.email,
            body.password,
            body.business_name,
            clock(),
            opening=opening,
        )
    return _open(response, session_token)


@router.get("/auth/me")
def me(signed_in: CurrentSession) -> MeOut:
    return MeOut(email=signed_in.user.email.value, business_name=signed_in.business.name.value)


@router.post("/invitations", status_code=201)
def invite_partner(
    signed_in: CurrentSession,
    accounts: AccountsDep,
    session: SessionDep,
    clock: ClockDep,
    public_url: Annotated[str, Depends(get_public_url)],
) -> InvitationOut:
    """A link that adds one more user to the caller's own business."""
    issued = invitations.invite_partner(accounts, session, signed_in.business_id, clock())
    return InvitationOut(url=invitation_url(public_url, issued.token), expires_at=issued.expires_at)
