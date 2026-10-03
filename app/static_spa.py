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

from starlette.exceptions import HTTPException
from starlette.responses import FileResponse, Response
from starlette.staticfiles import StaticFiles

if TYPE_CHECKING:
    from starlette.types import Scope

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
