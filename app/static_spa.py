"""Serves the built front (`web/dist`) next to the API, same origin and port
(`scripts/serve.sh`).

A `Mount`, not a catch-all route: Starlette never lists a mount in `app.openapi()`, so
the API's route list — and with it `tests/test_gated_routes.py` and the isolation sweep
— stays exactly what the capabilities register. A catch-all route would also answer 401
to a signed-out invitation link and turn an unknown API path into HTML.
"""

from __future__ import annotations

import re
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


# Front paths whose first segment is also an API route's (`/expenses`): the API's router
# would answer them, so the front is served there only through these two tables, and only to
# a browser navigation (docs/adr/0024, docs/adr/0030). A moved screen adds its own entry
# with its route.
SHARED_FRONT_PATHS = frozenset(
    {
        "/expenses",
        "/expenses/new",
        "/varieties",
        "/varieties/new",
        "/varieties/catalog",
        "/varieties/entries",
        "/varieties/entries/new",
    }
)

# The parameterised ones: each is fully anchored and its only variable is `[0-9]+` (a
# record's integer id, never a name, so none collides with `catalog`, `entries` or `new`).
# Matched with `fullmatch`, so a trailing newline never slips past the `$`.
SHARED_FRONT_PATTERNS = (
    re.compile(r"^/varieties/[0-9]+$"),
    re.compile(r"^/varieties/[0-9]+/prices$"),
    re.compile(r"^/varieties/[0-9]+/prices/new$"),
    re.compile(r"^/varieties/[0-9]+/entries$"),
    re.compile(r"^/varieties/entries/[0-9]+$"),
)

# The old Spanish front paths and where they live now. Permanent, whatever the method.
LEGACY_FRONT_PATHS = {
    "/mas": "/more",
    "/gastos": "/expenses",
    "/variedades": "/varieties",
    "/catalogo": "/varieties/catalog",
    "/mi-stock": "/varieties",
    "/mi-stock/nueva-entrada": "/varieties/entries/new",
}

# The old Spanish paths that carry a record's id across: each row is a fully anchored
# pattern and the target it expands to (`\1` is the captured id).
LEGACY_FRONT_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^/variedades/([0-9]+)$"), r"/varieties/\1"),
    (re.compile(r"^/mi-stock/entradas/([0-9]+)$"), r"/varieties/entries/\1"),
)


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

    - a legacy Spanish path (or it plus one trailing slash), exact or matching a
      `LEGACY_FRONT_PATTERNS` row, is a 308 to its new path (the captured id carried
      across), for any method and any `Accept`, keeping the query string;
    - for a `GET`/`HEAD` that accepts `text/html`, an exact `SHARED_FRONT_PATHS` entry or a
      full match of a `SHARED_FRONT_PATTERNS` pattern is the app shell, served by the same
      `SpaStatic` as `/` so its headers have one author, and the same path plus one
      trailing slash is a 308 to the slashless path;
    - everything else reaches the app untouched.
    """

    def __init__(
        self,
        app: ASGIApp,
        spa: SpaStatic,
        legacy_patterns: tuple[tuple[re.Pattern[str], str], ...] = LEGACY_FRONT_PATTERNS,
    ) -> None:
        self._app = app
        self._spa = spa
        self._legacy_patterns = legacy_patterns

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return
        path: str = scope["path"]
        legacy_target = self._legacy_target(_without_one_slash(path))
        if legacy_target is not None:
            await self._redirect(legacy_target, scope, receive, send)
            return
        if scope["method"] in ("GET", "HEAD") and _accepts_html(scope):
            if _is_shared_front_path(path):
                response = await self._spa.get_response("index.html", scope)
                await response(scope, receive, send)
                return
            slashless = _without_one_slash(path)
            if slashless != path and _is_shared_front_path(slashless):
                await self._redirect(slashless, scope, receive, send)
                return
        await self._app(scope, receive, send)

    def _legacy_target(self, path: str) -> str | None:
        exact = LEGACY_FRONT_PATHS.get(path)
        if exact is not None:
            return exact
        for pattern, target in self._legacy_patterns:
            match = pattern.fullmatch(path)
            if match is not None:
                return match.expand(target)
        return None

    @staticmethod
    async def _redirect(target: str, scope: Scope, receive: Receive, send: Send) -> None:
        query = scope["query_string"].decode("latin-1")
        location = f"{target}?{query}" if query else target
        await RedirectResponse(location, status_code=308)(scope, receive, send)


def _is_shared_front_path(path: str) -> bool:
    return path in SHARED_FRONT_PATHS or any(
        pattern.fullmatch(path) for pattern in SHARED_FRONT_PATTERNS
    )


def _without_one_slash(path: str) -> str:
    return path[:-1] if path.endswith("/") and path != "/" else path


def _accepts_html(scope: Scope) -> bool:
    return "text/html" in Headers(scope=scope).get("accept", "").lower()
