"""The app factory. `scripts/serve.sh` runs it with `uvicorn --factory`, so importing
this module reads nothing from the environment; tests build the app with their own
settings, engine and clock."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import cast

from fastapi import Depends, FastAPI
from sqlalchemy.engine import Engine

from app.accounts.adapters.deps import require_session
from app.accounts.adapters.router import public_router as accounts_public_router
from app.accounts.adapters.router import router as accounts_router
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SessionSigner
from app.clock import Clock, system_clock
from app.db import make_engine
from app.expenses.adapters.default_categories import ExpenseCategoriesOpening
from app.expenses.adapters.router import router as expenses_router
from app.migrations.runner import upgrade_to_head
from app.settings import Settings
from app.varieties.adapters.router import router as varieties_router


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
    # A factory, not an instance: `get_business_opening` builds it over the request's
    # own `Session`. The next capability that seeds at opening turns this into a
    # composite, not a second keyword argument on `accept_invitation` (docs/adr/0005).
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
    app.include_router(expenses_router, dependencies=gated)
    return app
