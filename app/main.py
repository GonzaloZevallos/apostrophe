"""The app factory. `scripts/serve.sh` runs it with `uvicorn --factory`, so importing
this module reads nothing from the environment; tests build the app with their own
settings, engine and clock."""

from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import asynccontextmanager
from typing import Protocol, cast

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import require_session
from app.accounts.adapters.router import public_router as accounts_public_router
from app.accounts.adapters.router import router as accounts_router
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SessionSigner
from app.catalog.adapters.opening import CatalogHeaderFooterOpening
from app.catalog.adapters.router import router as catalog_router
from app.clock import Clock, system_clock
from app.customers.adapters.router import router as customers_router
from app.db import make_engine
from app.expenses.adapters.default_categories import ExpenseCategoriesOpening
from app.expenses.adapters.router import router as expenses_router
from app.http_errors import Refused
from app.migrations.runner import upgrade_to_head
from app.payments.adapters.results_ports import SqlDebtSummary, SqlPaymentsReceived
from app.payments.adapters.router import customers_router as payments_customers_router
from app.payments.adapters.router import router as payments_router
from app.payments.adapters.settlements import SqlBalances, SqlOwingSales
from app.sales.adapters.router import router as sales_router
from app.settings import Settings
from app.static_spa import MissingBuiltFront, SpaStatic, api_segments
from app.stock.adapters.line_costs import SqlLineCosts
from app.stock.adapters.router import router as stock_router
from app.varieties.adapters.router import router as varieties_router


class _Opening(Protocol):
    def opened(self, business_id: int) -> None: ...


class _BoundComposite:
    def __init__(self, openings: Sequence[_Opening]) -> None:
        self._openings = openings

    def opened(self, business_id: int) -> None:
        for opening in self._openings:
            opening.opened(business_id)


class CompositeOpening:
    """Combines several capabilities' own opening factories into the one
    `app.state.business_opening` (docs/adr/0006): each is shaped like a lone factory
    already was (`Callable[[Session], _Opening]`); this composes any number of them,
    called once per request with that request's `Session`, so a new capability that
    seeds something at opening joins the tuple below, not a new keyword on
    `accept_invitation`."""

    def __init__(self, *factories: Callable[[Session], _Opening]) -> None:
        self._factories = factories

    def __call__(self, session: Session) -> _BoundComposite:
        return _BoundComposite([factory(session) for factory in self._factories])


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
    # own `Session`. `CompositeOpening` composes every capability that seeds something
    # at opening, so a new one joins here, not as a second keyword argument on
    # `accept_invitation` (docs/adr/0006).
    app.state.business_opening = CompositeOpening(
        ExpenseCategoriesOpening, CatalogHeaderFooterOpening
    )
    # A factory, not an instance (the same shape as `business_opening` above): sales
    # reaches line cost only through its own `LineCosts` port, never `app.stock`
    # directly (CODING_STANDARDS section 1). A dependency under `app/sales/adapters/`
    # builds it over the request's own `Session` and business, the way
    # `get_business_opening` already does for `business_opening` — not added here, so
    # this line is the one seam the sales-costs subtask reaches it through.
    app.state.line_costs = SqlLineCosts
    # Two more factories of the same shape: customers reaches a balance, and sales a
    # "still owing" mark, only through `Balances`/`OwingSales`, never `app.payments`
    # directly (the plan's invariant). `app/customers/adapters/router.py` and
    # `app/sales/adapters/router.py` build these over the request's own `Session` and
    # business, the way `get_line_costs` already does for `line_costs`.
    app.state.balances = SqlBalances
    app.state.owing_sales = SqlOwingSales
    # Two of results' own ports (plan: subtask "PaymentsReceived and DebtSummary in
    # payments"), the same `(Session, business_id)` factory shape as `line_costs` and
    # `balances` above; `app/results/adapters/` builds each over the request's own
    # `Session` and business, never a second query against `app.payments` directly.
    app.state.payments_received = SqlPaymentsReceived
    app.state.debt_summary = SqlDebtSummary

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
    app.include_router(stock_router, dependencies=gated)
    app.include_router(catalog_router, dependencies=gated)
    app.include_router(payments_router, dependencies=gated)
    app.include_router(payments_customers_router, dependencies=gated)

    if settings.web_dist is not None:
        if not (settings.web_dist / "index.html").is_file():
            raise MissingBuiltFront(settings.web_dist)
        # Last: a `Mount` is only ever reached once no API route has matched, and it
        # adds no entry to `app.openapi()["paths"]`.
        segments = api_segments(app.openapi()["paths"])
        app.mount("/", SpaStatic(settings.web_dist, segments))
    return app
