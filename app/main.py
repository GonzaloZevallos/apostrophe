"""The app factory. `scripts/serve.sh` runs it with `uvicorn --factory`, so importing
this module reads nothing from the environment; tests build the app with their own
settings, engine and clock."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import cast

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Engine

from app.accounts.adapters.deps import require_session
from app.accounts.adapters.router import public_router as accounts_public_router
from app.accounts.adapters.router import router as accounts_router
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SessionSigner
from app.clock import Clock, system_clock
from app.customers.adapters.router import router as customers_router
from app.db import make_engine
from app.expenses.adapters.default_categories import ExpenseCategoriesOpening
from app.expenses.adapters.router import router as expenses_router
from app.http_errors import Refused
from app.migrations.runner import upgrade_to_head
from app.sales.adapters.router import router as sales_router
from app.settings import Settings
from app.static_spa import MissingBuiltFront, SpaStatic, api_segments
from app.varieties.adapters.router import router as varieties_router


async def _without_request_data(request: Request, exc: Exception) -> JSONResponse:
    # The default 422 body echoes each error's `input` (and sometimes `ctx`, `url`),
    # which for a customer can be a phone number or a name (ADR-0005). This answers
    # with only `loc`, `type` and `msg`.
    assert isinstance(exc, RequestValidationError)
    detail = [
        {"loc": list(error["loc"]), "type": error["type"], "msg": error["msg"]}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": detail, "code": "RequestInvalid"})


async def _refused(request: Request, exc: Exception) -> JSONResponse:
    # Every `Refused` already carries the broken rule's `code` (docs/adr/0008); the
    # front maps it, never `detail`.
    assert isinstance(exc, Refused)
    content = {"detail": exc.detail, "code": exc.code}
    return JSONResponse(status_code=exc.status_code, content=content)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Starlette's `State` is untyped; `create_app` always assigns an `Engine`.
    upgrade_to_head(cast(Engine, app.state.engine))
    yield


def create_app(
    settings: Settings | None = None,
    engine: Engine | None = None,
    clock: Clock = system_clock,
    hasher: PasswordHasher | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    app = FastAPI(title="apostrophe", lifespan=lifespan)
    app.state.engine = engine or make_engine(settings.database_url)
    app.state.clock = clock
    app.state.signer = SessionSigner(settings.secret_key)
    app.state.hasher = hasher or PasswordHasher()
    app.state.public_url = settings.public_url
    app.add_exception_handler(RequestValidationError, _without_request_data)
    app.add_exception_handler(Refused, _refused)
    # A factory, not an instance: `get_business_opening` builds it over the request's
    # own `Session`. The next capability that seeds at opening turns this into a
    # composite, not a second keyword argument on `accept_invitation` (docs/adr/0006).
    app.state.business_opening = ExpenseCategoriesOpening

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(accounts_public_router)
    # Every other router goes behind the session gate (docs/adr/0002); each endpoint
    # then takes its business from the session (docs/adr/0004).
    gated = [Depends(require_session)]
    app.include_router(accounts_router, dependencies=gated)
    app.include_router(varieties_router, dependencies=gated)
    app.include_router(customers_router, dependencies=gated)
    app.include_router(expenses_router, dependencies=gated)
    app.include_router(sales_router, dependencies=gated)

    if settings.web_dist is not None:
        if not (settings.web_dist / "index.html").is_file():
            raise MissingBuiltFront(settings.web_dist)
        # Last: a `Mount` is only ever reached once no API route has matched, and it
        # adds no entry to `app.openapi()["paths"]`.
        segments = api_segments(app.openapi()["paths"])
        app.mount("/", SpaStatic(settings.web_dist, segments))
    return app
