from datetime import date, datetime
from typing import Annotated, Literal, TypedDict

from fastapi import APIRouter, Depends, Header, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import (
    SESSION_COOKIE,
    ClientAddressDep,
    CurrentBusinessId,
    CurrentSession,
    get_accounts,
    get_business_opening,
    get_hasher,
    get_public_url,
    get_settings,
    get_signer,
    raise_unauthenticated,
)
from app.accounts.adapters.sql_accounts import SqlAccounts
from app.accounts.application import invitations, manage_business, reset_password
from app.accounts.application.invitations import EmailTaken
from app.accounts.application.ports import BusinessOpening
from app.accounts.application.sign_in import LoginLocked, change_password, log_in
from app.accounts.domain.account import AccountRuleBroken
from app.accounts.domain.invitation import InvitationKind, InvitationNotUsable
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.reset_link import CurrentPasswordWrong, ResetLinkGone
from app.accounts.domain.session_token import SESSION_LIFETIME, SessionSigner
from app.clock import Clock, get_clock, get_today
from app.db import get_session
from app.http_errors import TranslateErrors
from app.settings import Settings
from app.shared.copy.negotiation import pre_sign_in_language
from app.shared.language import BusinessLanguage, shown_language

# Public: how a user gets a session. Every other accounts route is gated in `app.main`.
public_router = APIRouter(tags=["accounts"])
router = APIRouter(tags=["accounts"])

AccountsDep = Annotated[SqlAccounts, Depends(get_accounts)]
SessionDep = Annotated[Session, Depends(get_session)]
HasherDep = Annotated[PasswordHasher, Depends(get_hasher)]
SignerDep = Annotated[SessionSigner, Depends(get_signer)]
ClockDep = Annotated[Clock, Depends(get_clock)]
TodayDep = Annotated[date, Depends(get_today)]
SettingsDep = Annotated[Settings, Depends(get_settings)]

as_http = TranslateErrors(
    [
        (404, (InvitationNotUsable, ResetLinkGone)),
        (409, (EmailTaken,)),
        (422, (AccountRuleBroken, CurrentPasswordWrong)),
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
    # The business day (America/Argentina/Buenos_Aires): the front's one clock. It
    # never builds "today" from a `Date` of its own (docs/adr/0001).
    today: date
    # The language screens are rendered in: the forced one when the operator set it, else
    # the stored one (docs/adr/0050). Never what the Settings control shows.
    shown_language: str


class UserOut(BaseModel):
    email: str


class BusinessOut(BaseModel):
    name: str
    users: list[UserOut]
    # The stored language and the ones a business may switch to, for the Settings control.
    language: str
    selectable_languages: list[str]


class BusinessPatchIn(BaseModel):
    name: str


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


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class ResetSubmitIn(BaseModel):
    new_password: str


def invitation_url(public_url: str, token: str) -> str:
    return f"{public_url}/invitation/{token}"


def reset_url(public_url: str, token: str) -> str:
    return f"{public_url}/reset/{token}"


class _CookieAttributes(TypedDict):
    httponly: bool
    samesite: Literal["lax"]
    secure: bool
    path: str


def _cookie_attributes(settings: Settings) -> _CookieAttributes:
    # `secure` comes only from `Settings.secure_cookie` (derived from `public_url`),
    # never guessed from the request (docs/adr/0002, plan invariant). The one builder
    # serves both `set_cookie` (`_open`) and `delete_cookie` (`logout`), so they can
    # never drift apart.
    return {"httponly": True, "samesite": "lax", "secure": settings.secure_cookie, "path": "/"}


def _open(response: Response, token: str, settings: Settings) -> SessionOut:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        **_cookie_attributes(settings),
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
    settings: SettingsDep,
    address: ClientAddressDep,
) -> SessionOut:
    with as_http:
        token = log_in(
            accounts, session, hasher, signer, body.email, body.password, address, clock()
        )
    if token is None:
        raise_unauthenticated()
    return _open(response, token, settings)


@public_router.post("/auth/logout", status_code=204)
def logout(response: Response, settings: SettingsDep) -> None:
    response.delete_cookie(SESSION_COOKIE, **_cookie_attributes(settings))


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
    settings: SettingsDep,
    opening: Annotated[BusinessOpening, Depends(get_business_opening)],
    accept_language: Annotated[str | None, Header()] = None,
) -> SessionOut:
    # The one place the phone's language is read. `forced=None` on purpose: the forced
    # language changes what is shown, never what is stored. Not `BusinessLanguage.parse`:
    # English may be off the selectable list.
    language = BusinessLanguage(
        pre_sign_in_language(accept_language, None, settings.selectable_languages)
    )
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
            language=language,
        )
    return _open(response, session_token, settings)


def _business_out(profile: manage_business.BusinessProfile, settings: Settings) -> BusinessOut:
    return BusinessOut(
        name=profile.name,
        users=[UserOut(email=e) for e in profile.user_emails],
        language=profile.language,
        selectable_languages=[language.tag for language in settings.selectable_languages],
    )


@router.get("/auth/me")
def me(signed_in: CurrentSession, today: TodayDep, settings: SettingsDep) -> MeOut:
    return MeOut(
        email=signed_in.user.email.value,
        business_name=signed_in.business.name.value,
        today=today,
        shown_language=shown_language(signed_in.business.language, settings.forced_language).tag,
    )


@router.get("/business")
def get_business(
    business_id: CurrentBusinessId, accounts: AccountsDep, settings: SettingsDep
) -> BusinessOut:
    profile = manage_business.business_profile(accounts, business_id)
    return _business_out(profile, settings)


@router.patch("/business")
def rename_business(
    body: BusinessPatchIn,
    business_id: CurrentBusinessId,
    accounts: AccountsDep,
    session: SessionDep,
    settings: SettingsDep,
) -> BusinessOut:
    with as_http:
        profile = manage_business.rename_business(accounts, session, business_id, body.name)
    return _business_out(profile, settings)


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


@router.post("/auth/password")
def change_password_route(
    body: ChangePasswordIn,
    response: Response,
    signed_in: CurrentSession,
    accounts: AccountsDep,
    session: SessionDep,
    hasher: HasherDep,
    signer: SignerDep,
    clock: ClockDep,
    settings: SettingsDep,
    address: ClientAddressDep,
) -> SessionOut:
    """Only a missing or invalid session answers 401 here (docs/adr/0019): a wrong
    current password is a 422, never a 401."""
    with as_http:
        token = change_password(
            accounts,
            session,
            hasher,
            signer,
            signed_in.user,
            body.current_password,
            body.new_password,
            address,
            clock(),
        )
    return _open(response, token, settings)


@public_router.get("/reset-links/{token}", status_code=204)
def look_up_reset_link(token: str, accounts: AccountsDep, clock: ClockDep) -> None:
    with as_http:
        reset_password.look_up_reset_link(accounts, token, clock())


@public_router.post("/reset-links/{token}")
def submit_reset_link(
    token: str,
    body: ResetSubmitIn,
    response: Response,
    accounts: AccountsDep,
    session: SessionDep,
    hasher: HasherDep,
    signer: SignerDep,
    clock: ClockDep,
    settings: SettingsDep,
) -> SessionOut:
    with as_http:
        token_out = reset_password.reset_password(
            accounts, session, hasher, signer, token, body.new_password, clock()
        )
    return _open(response, token_out, settings)
