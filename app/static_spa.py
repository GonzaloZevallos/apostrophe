"""Serves the built front (`web/dist`) next to the API, same origin and port
(`scripts/serve.sh`).

A `Mount`, not a catch-all route: Starlette never lists a mount in `app.openapi()`, so
the API's route list — and with it `tests/test_gated_routes.py` and the isolation sweep
— stays exactly what the capabilities register. A catch-all route would also answer 401
to a signed-out invitation link and turn an unknown API path into HTML.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from starlette.exceptions import HTTPException
from starlette.responses import FileResponse, Response
from starlette.staticfiles import StaticFiles

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

# The one contract between the two languages (docs/adr/0008); the front reads it too.
CONTRACT_PATH = Path(__file__).resolve().parent.parent / "web" / "src" / "api" / "contract.json"
_VARY = b"Sec-Fetch-Mode, Accept"

# Served with `Cache-Control: no-cache`: a stale copy of any of these would keep
# serving an old shell, an old manifest or a stale service worker forever.
_NO_CACHE_NAMES = frozenset({"index.html", "manifest.webmanifest", "sw.js"})


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


def route_segments(contract_path: Path = CONTRACT_PATH) -> frozenset[str]:
    """The first path segments the front's router owns, English and old Spanish. They may
    overlap the API's own (docs/adr/0024)."""
    contract = json.loads(contract_path.read_text())
    return frozenset(contract["routeSegments"])


class NavigationFallback:
    """Pure-ASGI middleware ahead of routing (docs/adr/0024).

    A GET or HEAD browser navigation to an extension-less path under a route segment
    answers `index.html`, so a reload, a saved link or the home-screen shortcut opens the
    front even where the API owns the same path. Anything else reaches the API unchanged.
    Every answer under a route segment carries `Vary: Sec-Fetch-Mode, Accept`, because a
    cache cannot tell the fallback from the API's answer; other paths get no added `Vary`.
    """

    def __init__(self, app: ASGIApp, index: Path, segments: frozenset[str]) -> None:
        self._app = app
        self._index = index
        self._segments = segments

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self._first_segment(scope) not in self._segments:
            await self._app(scope, receive, send)
            return

        async def send_with_vary(message: Message) -> None:
            if message["type"] == "http.response.start":
                message["headers"] = [*message.get("headers", []), (b"vary", _VARY)]
            await send(message)

        if self._is_navigation(scope):
            response = FileResponse(self._index, headers={"Cache-Control": "no-cache"})
            await response(scope, receive, send_with_vary)
            return
        await self._app(scope, receive, send_with_vary)

    @staticmethod
    def _first_segment(scope: Scope) -> str:
        return str(scope["path"]).lstrip("/").split("/", 1)[0]

    @staticmethod
    def _is_navigation(scope: Scope) -> bool:
        if str(scope["method"]) not in {"GET", "HEAD"} or Path(str(scope["path"])).suffix:
            return False
        headers = {name: value for name, value in scope["headers"]}
        mode = headers.get(b"sec-fetch-mode")
        if mode is not None:
            return bool(mode == b"navigate")
        first_media_type = headers.get(b"accept", b"").split(b",", 1)[0].split(b";", 1)[0]
        return bool(first_media_type.strip().lower() == b"text/html")
