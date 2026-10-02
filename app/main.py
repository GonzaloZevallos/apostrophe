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
from app.migrations.runner import upgrade_to_head
from app.settings import Settings
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
    return JSONResponse(status_code=422, content={"detail": detail})


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
    return app
