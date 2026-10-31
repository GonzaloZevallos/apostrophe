"""The app factory. `scripts/serve.sh` runs it with `uvicorn --factory`, so importing
this module reads nothing from the environment; tests build the app with their own
settings, engine and clock."""

import asyncio
import contextlib
from collections.abc import AsyncIterator, Callable, Sequence
from contextlib import asynccontextmanager
from datetime import date
from functools import partial
from typing import Protocol, cast

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.deps import require_session
from app.accounts.adapters.language_router import router as language_router
from app.accounts.adapters.onboarding_facts import SqlUserFacts
from app.accounts.adapters.router import public_router as accounts_public_router
from app.accounts.adapters.router import router as accounts_router
from app.accounts.domain.password import PasswordHasher
from app.accounts.domain.session_token import SessionSigner
from app.catalog.adapters.babel_defaults import BabelHeaderFooterDefaults
from app.catalog.adapters.babel_words import BabelCatalogWords
from app.catalog.adapters.business_language import SqlCatalogLanguage
from app.catalog.adapters.leaving import SqlCatalogLeaving
from app.catalog.adapters.onboarding_facts import SqlCatalogFacts
from app.catalog.adapters.opening import CatalogHeaderFooterOpening
from app.catalog.adapters.router import router as catalog_router
from app.clock import Clock, system_clock
from app.customers.adapters.router import router as customers_router
from app.db import make_engine
from app.expenses.adapters.babel_defaults import BabelCategoryDefaults
from app.expenses.adapters.default_categories import ExpenseCategoriesOpening
from app.expenses.adapters.expenses_ledger import SqlExpensesLedger
from app.expenses.adapters.router import router as expenses_router
from app.http_errors import Refused
from app.migrations.runner import upgrade_to_head
from app.onboarding.adapters.first_run_router import router as first_run_router
from app.onboarding.adapters.opening import OnboardingOpening
from app.onboarding.adapters.router import router as onboarding_router
from app.payments.adapters.payments_ledger import SqlPaymentsLedger
from app.payments.adapters.results_ports import SqlDebtSummary
from app.payments.adapters.router import customers_router as payments_customers_router
from app.payments.adapters.router import router as payments_router
from app.payments.adapters.settlements import SqlBalances, SqlOwingSales
from app.pinned_catalog.adapters.onboarding_facts import SqlBotFacts
from app.pinned_catalog.adapters.router import router as pinned_catalog_router
from app.pinned_catalog.adapters.telegram_holder import PinnedCatalogTelegram, TelegramBackend
from app.pinned_catalog.adapters.telegram_http import HttpTelegram
from app.pinned_catalog.adapters.ticker import run_ticker
from app.pinned_catalog.adapters.token_cipher import TokenCipher
from app.pinned_catalog.adapters.upkeep_trigger import schedule_upkeep
from app.pinned_catalog.application.channel_telegram import ChannelTelegram
from app.pinned_catalog.application.push import BusinessLocks
from app.pricing_settings.adapters.opening import PricingSettingsOpening
from app.pricing_settings.adapters.router import router as pricing_settings_router
from app.pricing_settings.adapters.sql_pricing_settings import SqlPricingSettings
from app.products.adapters.onboarding_facts import SqlProductFacts
from app.products.adapters.router import router as products_router
from app.results.adapters.router import router as results_router
from app.sales.adapters.router import router as sales_router
from app.sales.adapters.sales_ledger import SqlSalesLedger
from app.settings import Settings
from app.shared.copy import CopyCatalog
from app.shared.language import BusinessLanguage
from app.static_spa import FrontNavigation, MissingBuiltFront, ShellPage, SpaStatic, api_segments
from app.stock.adapters.draw_costs import SqlDrawCosts
from app.stock.adapters.leaving import SqlStockLeaving
from app.stock.adapters.line_costs import SqlLineCosts
from app.stock.adapters.onboarding_facts import SqlStockFacts
from app.stock.adapters.purchases import SqlPurchases
from app.stock.adapters.router import router as stock_router
from app.stock.adapters.stock_figures import SqlStockFigures
from app.units.adapters.import_port import UnitsImport
from app.units.adapters.opening import UnitsOpening
from app.units.adapters.products_reader import SqlUnitsReader


class _Opening(Protocol):
    def opened(self, business_id: int, language: BusinessLanguage) -> None: ...


class _BoundComposite:
    def __init__(self, openings: Sequence[_Opening]) -> None:
        self._openings = openings

    def opened(self, business_id: int, language: BusinessLanguage) -> None:
        for opening in self._openings:
            opening.opened(business_id, language)


class _Leaving(Protocol):
    def leaving(self, variety_id: int) -> None: ...


class _BoundLeaving:
    def __init__(self, parts: Sequence[_Leaving]) -> None:
        self._parts = parts

    def leaving(self, variety_id: int) -> None:
        for part in self._parts:
            part.leaving(variety_id)


class CompositeLeaving:
    """Combines the capabilities that keep something of their own about a variety, so
    deleting one removes it all (docs/adr/0006): each factory is `(Session, business_id)`,
    the shape of the other factories on `app.state`."""

    def __init__(self, *factories: Callable[[Session, int], _Leaving]) -> None:
        self._factories = factories

    def __call__(self, session: Session, business_id: int) -> _BoundLeaving:
        return _BoundLeaving([factory(session, business_id) for factory in self._factories])


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


def units_reader(session: Session, business_id: int) -> SqlUnitsReader:
    """The one `units_of` reader every hexagon's own reader port is served by, built here
    for the spreadsheet import and its callers so none imports `app.units` (docs/adr/0055)."""
    return SqlUnitsReader(session, business_id)


def units_import(session: Session, business_id: int) -> UnitsImport:
    """The spreadsheet import's `UnitsImport`, built here so the import's own composition
    root never imports `app.units` (docs/adr/0055)."""
    return UnitsImport(session, business_id)


def _catalog_facts(session: Session, business_id: int, today: date) -> SqlCatalogFacts:
    return SqlCatalogFacts(session, business_id, today, SqlPricingSettings(session, business_id))


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
    # The day-change ticker (ADR-0014): started only when asked, so the test app
    # (`upkeep_ticker=False`) never races a background sync against its own
    # assertions. Exposed on `app.state` so a test can prove it stops on shutdown.
    ticker_task: asyncio.Task[None] | None = None
    if cast(bool, app.state.pinned_catalog_upkeep_ticker):
        ticker_task = asyncio.create_task(run_ticker(app.state))
    app.state.pinned_catalog_ticker_task = ticker_task
    try:
        yield
    finally:
        if ticker_task is not None:
            ticker_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await ticker_task


def create_app(
    settings: Settings | None = None,
    engine: Engine | None = None,
    clock: Clock = system_clock,
    hasher: PasswordHasher | None = None,
    telegram: TelegramBackend | None = None,
    upkeep_ticker: bool = True,
) -> FastAPI:
    settings = settings or Settings.from_env()
    app = FastAPI(title="apostrophe", lifespan=lifespan)
    app.state.engine = engine or make_engine(
        settings.database_url, auth_token=settings.database_auth_token
    )
    app.state.clock = clock
    app.state.signer = SessionSigner(settings.secret_key)
    app.state.hasher = hasher or PasswordHasher()
    app.state.public_url = settings.public_url
    app.state.settings = settings
    # `telegram=None` means the real adapter; every test but `telegram_http`'s own
    # injects a fake through this same keyword (the plan's invariant). The ticker
    # itself and the trigger dependency are the `upkeep` subtask's: this flag is only
    # stored here for it to read.
    api = telegram or HttpTelegram()
    app.state.pinned_catalog_telegram = PinnedCatalogTelegram(
        api=api, channel=ChannelTelegram(api), updates=api
    )
    app.state.pinned_catalog_locks = BusinessLocks()
    app.state.pinned_catalog_cipher = TokenCipher(settings.secret_key)
    app.state.pinned_catalog_upkeep_ticker = upkeep_ticker
    app.add_exception_handler(RequestValidationError, _without_request_data)
    app.add_exception_handler(Refused, _refused)
    # A factory, not an instance: `get_business_opening` builds it over the request's
    # own `Session`. `CompositeOpening` composes every capability that seeds something
    # at opening, so a new one joins here, not as a second keyword argument on
    # `accept_invitation` (docs/adr/0006).
    copy_catalog = CopyCatalog(settings.locales_dir)
    category_defaults = BabelCategoryDefaults(copy_catalog)
    header_footer_defaults = BabelHeaderFooterDefaults(copy_catalog)
    app.state.business_opening = CompositeOpening(
        partial(ExpenseCategoriesOpening, defaults=category_defaults),
        partial(CatalogHeaderFooterOpening, defaults=header_footer_defaults),
        PricingSettingsOpening,
        partial(OnboardingOpening, clock=clock),
        UnitsOpening,
    )
    # Products reads a product's unit only through its own `UnitsReader` port (docs/adr/0055).
    app.state.products_units = SqlUnitsReader
    # The same reader for sales, through the port sales declares for it.
    app.state.sales_units = SqlUnitsReader
    # A factory, not an instance (the same shape as `business_opening` above): sales
    # reaches line cost only through its own `LineCosts` port, never `app.stock`
    # directly (CODING_STANDARDS section 1). A dependency under `app/sales/adapters/`
    # builds it over the request's own `Session` and business, the way
    # `get_business_opening` already does for `business_opening` — not added here, so
    # this line is the one seam the sales-costs subtask reaches it through.
    app.state.line_costs = SqlLineCosts
    # The same shape again: sales reads the switches only through its own
    # `PricingSettingsReader` port, never `app.pricing_settings` (docs/adr/0034).
    app.state.pricing_settings = SqlPricingSettings
    # The catalog reads the pricing switches only through its own `CatalogPricingSettings`
    # port (ADR-0006); the same `(Session, business_id)` factory shape. The router and the
    # pinned catalog's snapshot both build it from here.
    app.state.catalog_pricing_settings = SqlPricingSettings
    # The catalog's fixed lines, built once over the copy module (docs/adr/0050).
    app.state.catalog_words = BabelCatalogWords(copy_catalog)
    # The language those lines are shown in: the forced one read once here, the stored one
    # read per call by `SqlCatalogLanguage` (the only place the catalog applies the override).
    app.state.catalog_language = partial(SqlCatalogLanguage, forced=settings.forced_language)
    # Deleting a variety removes what stock and the catalog keep of it (docs/adr/0006).
    app.state.variety_leaving = CompositeLeaving(SqlStockLeaving, SqlCatalogLeaving)
    # Two more factories of the same shape: customers reaches a balance, and sales a
    # "still owing" mark, only through `Balances`/`OwingSales`, never `app.payments`
    # directly (the plan's invariant). `app/customers/adapters/router.py` and
    # `app/sales/adapters/router.py` build these over the request's own `Session` and
    # business, the way `get_line_costs` already does for `line_costs`.
    app.state.balances = SqlBalances
    # The same factory shape, once per reader: each hexagon declares its own
    # `current() -> PricingSettings` port and none imports `app.pricing_settings`
    # (docs/adr/0006, docs/adr/0034).
    app.state.varieties_pricing_settings = SqlPricingSettings
    app.state.customers_pricing_settings = SqlPricingSettings
    app.state.owing_sales = SqlOwingSales
    # Another factory of the same shape: results reaches stock's rows and draws only
    # through its own `StockFigures` port, never `app.stock` directly (ADR-0006). The
    # panel route builds this over the request's own `Session` and business, the way
    # `get_line_costs` already does for `line_costs`.
    app.state.stock_figures = SqlStockFigures
    # One more of results' own ports (plan: subtask "PaymentsReceived and DebtSummary in
    # payments"; ADR-0013 amendment GH-70 deleted `PaymentsReceived` — Caja now comes
    # from `period_figures`, fed by the ledgers below), the same `(Session,
    # business_id)` factory shape as `line_costs` and `balances` above.
    app.state.debt_summary = SqlDebtSummary
    # Five more factories of the same shape: results reaches every ledger only
    # through its own ports (`DrawCosts`, `SalesLedger`, `PaymentsLedger`,
    # `ExpensesLedger`, `Purchases`), never `app.stock`, `app.sales`, `app.payments`
    # or `app.expenses` adapters directly. `app/results/adapters/router.py` builds
    # each over the request's own `Session` and business, the way `get_line_costs`
    # already does for `line_costs`. `GET /panel` and `GET /analysis` share every one
    # of these (ADR-0013 amendment GH-70): both read `period_figures`'s one
    # computation, never a second sum of their own.
    app.state.draw_costs = SqlDrawCosts
    app.state.sales_ledger = SqlSalesLedger
    app.state.payments_ledger = SqlPaymentsLedger
    app.state.expenses_ledger = SqlExpensesLedger
    app.state.purchases_ledger = SqlPurchases
    # The Onboarding reads each owner's facts only through its own ports (ADR-0006,
    # ADR-0036), the same `(Session, business_id)` factory shape as above; the varieties
    # one also takes today, since "priced today" is a fact of the day.
    app.state.onboarding_variety_facts = SqlProductFacts
    app.state.onboarding_stock_facts = SqlStockFacts
    app.state.onboarding_bot_facts = SqlBotFacts
    app.state.onboarding_user_facts = SqlUserFacts
    # `GET /first-run` asks the catalog whether anything qualifies through the Onboarding's
    # own `CatalogFacts` port (ADR-0006, ADR-0046). It also takes today, and the catalog
    # reads the pricing switches through its own port, so the factory hands it that one.
    app.state.onboarding_catalog_facts = _catalog_facts

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(accounts_public_router)
    # Every other router goes behind the session gate (docs/adr/0002); each endpoint
    # then takes its business from the session (docs/adr/0004).
    gated = [Depends(require_session)]
    # Exactly these four (ADR-0014): a write here may change what the pinned catalog
    # says, so it also schedules upkeep's own post-commit, off-session sync.
    upkeep_gated = [*gated, Depends(schedule_upkeep)]
    app.include_router(accounts_router, dependencies=gated)
    # Not `upkeep_gated`, on purpose: the request wires `Depends(schedule_upkeep)` here, but
    # then `en -> en` would still sync. Only a changed language can owe the pin an edit, so
    # the router schedules upkeep itself when it did (ADR-0014, as pricing settings does).
    app.include_router(language_router, dependencies=gated)
    app.include_router(products_router, dependencies=upkeep_gated)
    app.include_router(customers_router, dependencies=gated)
    app.include_router(expenses_router, dependencies=gated)
    app.include_router(sales_router, dependencies=upkeep_gated)
    app.include_router(stock_router, dependencies=upkeep_gated)
    app.include_router(catalog_router, dependencies=upkeep_gated)
    app.include_router(payments_router, dependencies=gated)
    app.include_router(payments_customers_router, dependencies=gated)
    app.include_router(pinned_catalog_router, dependencies=gated)
    app.include_router(results_router, dependencies=gated)
    app.include_router(onboarding_router, dependencies=gated)
    app.include_router(first_run_router, dependencies=gated)
    # Not `upkeep_gated`: only a PUT that changed a switch may touch the pin, and its
    # router decides that itself (ADR-0014).
    app.include_router(pricing_settings_router, dependencies=gated)

    if settings.web_dist is not None:
        if not (settings.web_dist / "index.html").is_file():
            raise MissingBuiltFront(settings.web_dist)
        # Last: a `Mount` is only ever reached once no API route has matched, and it
        # adds no entry to `app.openapi()["paths"]`.
        segments = api_segments(app.openapi()["paths"])
        shell = ShellPage(
            settings.web_dist / "index.html",
            settings.forced_language,
            settings.selectable_languages,
        )
        spa = SpaStatic(settings.web_dist, segments, shell)
        app.mount("/", spa)
        # Outside routing, so `/expenses` reaches the front before the API's router claims
        # it (docs/adr/0024); the same `spa`, so the shell has one author of its headers.
        app.add_middleware(FrontNavigation, spa=spa)
    return app
