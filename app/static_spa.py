"""Serves the built front (`web/dist`) next to the API, same origin and port
(`scripts/serve.sh`).

A `Mount`, not a catch-all route: Starlette never lists a mount in `app.openapi()`, so
the API's route list — and with it `tests/test_gated_routes.py` and the isolation sweep
— stays exactly what the capabilities register. A catch-all route would also answer 401
to a signed-out invitation link and turn an unknown API path into HTML.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from starlette.datastructures import Headers
from starlette.exceptions import HTTPException
from starlette.responses import FileResponse, RedirectResponse, Response
from starlette.staticfiles import StaticFiles

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Receive, Scope, Send

# Served with `Cache-Control: no-cache`: a stale copy of any of these would keep
# serving an old shell, an old manifest or a stale service worker forever.
_NO_CACHE_NAMES = frozenset({"index.html", "manifest.webmanifest", "sw.js"})


# Front paths whose first segment is also an API route's (`/sales`, `/expenses`): the API's
# router would answer them, so the front is served there only through this list of
# whole-path templates, and only to a browser navigation (docs/adr/0024, amendment of
# GH-59). A segment is a literal or `{id}`, which matches digits only.
SHARED_FRONT_PATHS = frozenset(
    {
        "/sales",
        "/sales/new",
        "/sales/{id}",
        "/customers",
        "/customers/new",
        "/customers/{id}",
        "/customers/{id}/edit",
        "/customers/{id}/payment",
        "/varieties",
        "/varieties/new",
        "/varieties/{id}",
        "/varieties/{id}/prices",
        "/varieties/{id}/prices/new",
        "/varieties/{id}/entries",
        "/varieties/catalog",
        "/varieties/entries",
        "/varieties/entries/new",
        "/varieties/entries/{id}",
        "/expenses",
        "/expenses/new",
        "/analysis",
    }
)

# The old Spanish front paths and where they live now, as (old, new) templates. Permanent,
# whatever the method; the id an old template captures is carried into the new one.
LEGACY_FRONT_PATHS: tuple[tuple[str, str], ...] = (
    ("/ventas", "/sales"),
    ("/ventas/nueva", "/sales/new"),
    ("/ventas/{id}", "/sales/{id}"),
    ("/clientes", "/customers"),
    ("/clientes/deben", "/customers"),
    ("/clientes/nuevo", "/customers/new"),
    ("/clientes/{id}", "/customers/{id}"),
    ("/clientes/{id}/editar", "/customers/{id}/edit"),
    ("/mi-stock", "/varieties"),
    ("/mi-stock/nueva-entrada", "/varieties/entries/new"),
    ("/mi-stock/entradas/{id}", "/varieties/entries/{id}"),
    ("/variedades", "/varieties"),
    ("/variedades/{id}", "/varieties/{id}"),
    ("/analisis", "/analysis"),
    ("/gastos", "/expenses"),
    ("/gastos/categorias", "/settings/expense-categories"),
    ("/mas", "/more"),
    ("/catalogo", "/varieties/catalog"),
    ("/negocio", "/settings"),
    ("/entrar", "/login"),
)

_ID = "{id}"


def matches_template(path: str, template: str) -> dict[str, str] | None:
    """The one matcher of a request path against a front path (docs/adr/0024). The whole
    path, segment by segment: a literal must be equal, `{id}` takes ASCII digits only, and
    both must have the same number of segments (an empty one never matches). Answers what
    the placeholder captured (`{}` when the template has none), or `None` for no match;
    compare with `is not None`, since `{}` is a match."""
    segments = path.split("/")
    expected = template.split("/")
    if len(segments) != len(expected):
        return None
    captured: dict[str, str] = {}
    for segment, wanted in zip(segments, expected, strict=True):
        if wanted == _ID:
            if not (segment.isascii() and segment.isdigit()):
                return None
            captured["id"] = segment
        elif segment != wanted:
            return None
    return captured


def _matching(path: str, templates: frozenset[str]) -> bool:
    return any(matches_template(path, template) is not None for template in templates)


def _legacy_target(path: str) -> str | None:
    """The new path an old Spanish `path` (or it plus one trailing slash) moved to."""
    whole = _without_one_slash(path)
    for old, new in LEGACY_FRONT_PATHS:
        captured = matches_template(whole, old)
        if captured is not None:
            return new.replace(_ID, captured.get("id", ""))
    return None


class MissingBuiltFront(RuntimeError):
    def __init__(self, directory: Path) -> None:
        super().__init__(
            f"{directory} has no index.html; run `npm run build` in web/ first"
        )


def api_segments(paths: dict[str, object]) -> frozenset[str]:
    """The first path segment of every API route, plus the framework's own docs
    routes: a GET under any of these never falls back to `index.html`."""
    segments = {path.strip("/").split("/", 1)[0] for path in paths if path != "/"}
    return frozenset(segments | {"docs", "redoc", "openapi.json"})


class SpaStatic(StaticFiles):
    """A single-page app's static build: an unknown file under an API segment, or
    with a file extension, stays a plain 404; anything else (a client-side route)
    falls back to `index.html`, so the front's own router decides what it means.
    """

    def __init__(self, directory: Path, api_segments: frozenset[str]) -> None:
        super().__init__(directory=directory, html=False, follow_symlink=False)
        self._api_segments = api_segments

    async def get_response(self, path: str, scope: Scope) -> Response:
        target = path
        try:
            response = await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or not self._falls_back_to_index(path):
                raise
            target = "index.html"
            response = await super().get_response(target, scope)
        if Path(target).name in _NO_CACHE_NAMES and isinstance(response, FileResponse):
            response.headers["Cache-Control"] = "no-cache"
        return response

    def _falls_back_to_index(self, path: str) -> bool:
        first_segment = path.split("/", 1)[0]
        if first_segment in self._api_segments:
            return False
        return Path(path).suffix == ""


class FrontNavigation:
    """Pure ASGI, outside Starlette's routing and its `redirect_slashes`, so the raw path
    decides before the API's router can claim it (docs/adr/0024, docs/adr/0030):

    - a legacy Spanish path (or it plus one trailing slash) is a 308 to its new path, for
      any method and any `Accept`, keeping the query string;
    - for a `GET`/`HEAD` that accepts `text/html`, a whole-path `SHARED_FRONT_PATHS` match is
      the app shell, served by the same `SpaStatic` as `/` so its headers have one author,
      and the same path plus one trailing slash is a 308 to the slashless path;
    - everything else reaches the app untouched.
    """

    def __init__(self, app: ASGIApp, spa: SpaStatic) -> None:
        self._app = app
        self._spa = spa

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return
        path: str = scope["path"]
        legacy_target = _legacy_target(path)
        if legacy_target is not None:
            await self._redirect(legacy_target, scope, receive, send)
            return
        if scope["method"] in ("GET", "HEAD") and _accepts_html(scope):
            if _matching(path, SHARED_FRONT_PATHS):
                response = await self._spa.get_response("index.html", scope)
                await response(scope, receive, send)
                return
            slashless = _without_one_slash(path)
            if slashless != path and _matching(slashless, SHARED_FRONT_PATHS):
                await self._redirect(slashless, scope, receive, send)
                return
        await self._app(scope, receive, send)

    @staticmethod
    async def _redirect(target: str, scope: Scope, receive: Receive, send: Send) -> None:
        query = scope["query_string"].decode("latin-1")
        location = f"{target}?{query}" if query else target
        await RedirectResponse(location, status_code=308)(scope, receive, send)


def _without_one_slash(path: str) -> str:
    return path[:-1] if path.endswith("/") and path != "/" else path


def _accepts_html(scope: Scope) -> bool:
    return "text/html" in Headers(scope=scope).get("accept", "").lower()
