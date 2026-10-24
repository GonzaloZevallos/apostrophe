"""Serves the built front (`web/dist`) next to the API, same origin and port
(`scripts/serve.sh`).

A `Mount`, not a catch-all route: Starlette never lists a mount in `app.openapi()`, so
the API's route list — and with it `tests/test_gated_routes.py` and the isolation sweep
— stays exactly what the capabilities register. A catch-all route would also answer 401
to a signed-out invitation link and turn an unknown API path into HTML.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import Collection
from pathlib import Path
from typing import TYPE_CHECKING

import anyio
import anyio.to_thread
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException
from starlette.responses import FileResponse, RedirectResponse, Response
from starlette.staticfiles import StaticFiles

from app.shared.copy.negotiation import pre_sign_in_language
from app.shared.language import ENGLISH, Language

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Receive, Scope, Send

# Served with `Cache-Control: no-cache`: a stale copy of any of these would keep
# serving an old manifest or a stale service worker forever. `index.html` is not a file
# response: `ShellPage` answers it.
_NO_CACHE_NAMES = frozenset({"manifest.webmanifest", "sw.js"})
_INDEX = "index.html"


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
        "/varieties/archived",
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

_ID = "{id}"

# The old Spanish front paths and where they live now: one row each in
# `legacy_front_paths.json` beside this module, the only home of the list (docs/adr/0033).
LEGACY_FRONT_PATHS_FILE = Path(__file__).with_name("legacy_front_paths.json")
_LITERAL_SEGMENT = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class MalformedLegacyFrontPaths(ValueError):
    """The legacy rows file is not a list of `{old, now}` templates. Raised at import, so a
    bad file fails the deploy instead of answering a wrong redirect."""


def _check_template(template: object, role: str) -> str:
    if not isinstance(template, str) or not template.startswith("/"):
        raise MalformedLegacyFrontPaths(f"a legacy {role} path must be a string starting with /")
    for segment in template[1:].split("/"):
        if segment != _ID and not _LITERAL_SEGMENT.match(segment):
            raise MalformedLegacyFrontPaths(
                f"a legacy {role} path has a segment that is neither a literal nor {_ID}"
            )
    return template


def parse_legacy_front_paths(text: str) -> tuple[tuple[str, str], ...]:
    """The `(old, now)` templates of a rows file. Every segment is a literal or `{id}`, an
    `{id}` in `now` needs one in `old` (there would be nothing to carry), and no old path
    is listed twice. Anything else raises `MalformedLegacyFrontPaths`."""
    try:
        document = json.loads(text)
    except json.JSONDecodeError as exc:
        raise MalformedLegacyFrontPaths("the legacy rows file is not JSON") from exc
    if not isinstance(document, list):
        raise MalformedLegacyFrontPaths("the legacy rows file must be a list")
    rows: list[tuple[str, str]] = []
    for row in document:
        if not isinstance(row, dict) or set(row) != {"old", "now"}:
            raise MalformedLegacyFrontPaths("a legacy row has exactly `old` and `now`")
        old = _check_template(row["old"], "old")
        now = _check_template(row["now"], "now")
        if _ID in now.split("/") and _ID not in old.split("/"):
            raise MalformedLegacyFrontPaths(f"a legacy row's now has {_ID} but its old has none")
        rows.append((old, now))
    if len({old for old, _ in rows}) != len(rows):
        raise MalformedLegacyFrontPaths("a legacy old path is listed twice")
    return tuple(rows)


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


LEGACY_FRONT_PATHS: tuple[tuple[str, str], ...] = parse_legacy_front_paths(
    LEGACY_FRONT_PATHS_FILE.read_text(encoding="utf-8")
)


class MissingBuiltFront(RuntimeError):
    def __init__(self, directory: Path) -> None:
        super().__init__(
            f"{directory} has no index.html; run `npm run build` in web/ first"
        )


class MalformedBuiltFront(RuntimeError):
    def __init__(self, path: Path) -> None:
        super().__init__(
            f'{path} is not a page with exactly one <html lang="…"> tag and a closing '
            "</html>; run `npm run build` in web/ again"
        )


_HTML_START_TAG = re.compile(r"<html\b[^>]*>", re.IGNORECASE)
_LANG_ATTRIBUTE = re.compile(r'(?<=\s)lang="[^"]*"', re.IGNORECASE)
_HTML_END = "</html>"


def _page_per_language(text: str, languages: Collection[Language]) -> dict[Language, bytes] | None:
    """`text` once per language with the root element's `lang` replaced, or `None` when it
    is not exactly one `<html>` start tag holding exactly one `lang="…"`, closed by
    `</html>`. Nothing else in the page changes."""
    tags = list(_HTML_START_TAG.finditer(text))
    if len(tags) != 1 or not text.rstrip().lower().endswith(_HTML_END):
        return None
    tag = tags[0]
    if len(_LANG_ATTRIBUTE.findall(tag.group())) != 1:
        return None
    return {
        language: (
            text[: tag.start()]
            + _LANG_ATTRIBUTE.sub(f'lang="{language.tag}"', tag.group())
            + text[tag.end() :]
        ).encode("utf-8")
        for language in languages
    }


class ShellPage:
    """The one author of `index.html` (docs/adr/0050): the page's `lang` follows the
    request's `Accept-Language` among the selectable languages (or is the forced one), and
    nothing else about the request reaches it. No cookie, path, query or token is read, so
    the page is byte-identical for any link in any state.

    The bytes per language are built at boot and again whenever the file changes, because
    `npm run build` may replace it under a running server. A file that cannot be read or is
    malformed leaves the last good bytes in place, and nothing is logged.
    """

    def __init__(
        self,
        index_path: Path,
        forced_language: Language | None,
        selectable_languages: Collection[Language],
    ) -> None:
        self._path = index_path
        self._forced = forced_language
        self._selectable = tuple(selectable_languages)
        servable = {ENGLISH, *self._selectable}
        if forced_language is not None:
            servable.add(forced_language)
        self._servable = frozenset(servable)
        self._lock = anyio.Lock()
        loaded = self._load()
        if loaded is None:
            raise MalformedBuiltFront(index_path)
        self._key, self._pages = loaded

    def _load(self) -> tuple[tuple[int, int], dict[Language, bytes]] | None:
        try:
            status = self._path.stat()
            text = self._path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return None
        pages = _page_per_language(text, self._servable)
        if pages is None:
            return None
        return (status.st_mtime_ns, status.st_size), pages

    def _refresh(self) -> None:
        try:
            status = self._path.stat()
        except OSError:
            return
        if (status.st_mtime_ns, status.st_size) == self._key:
            return
        loaded = self._load()
        if loaded is not None:
            self._key, self._pages = loaded

    async def response(self, scope: Scope) -> Response:
        async with self._lock:
            await anyio.to_thread.run_sync(self._refresh)
            pages = self._pages
        language = pre_sign_in_language(
            Headers(scope=scope).get("accept-language"), self._forced, self._selectable
        )
        body = pages.get(language, pages[ENGLISH])
        is_head = scope["method"] == "HEAD"
        response = Response(
            content=b"" if is_head else body,
            media_type="text/html; charset=utf-8",
            headers={"Cache-Control": "no-cache", "Vary": "Accept-Language"},
        )
        response.headers["Content-Length"] = str(len(body))
        return response


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

    def __init__(self, directory: Path, api_segments: frozenset[str], shell: ShellPage) -> None:
        super().__init__(directory=directory, html=False, follow_symlink=False)
        self._api_segments = api_segments
        self._shell = shell

    async def get_response(self, path: str, scope: Scope) -> Response:
        if os.path.normpath(path) == _INDEX:
            return await self._shell.response(scope)
        target = path
        try:
            response = await super().get_response(path, scope)
        except HTTPException as exc:
            if exc.status_code != 404 or not self._falls_back_to_index(path):
                raise
            return await self._shell.response(scope)
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
    decides before the API's router can claim it (docs/adr/0024, docs/adr/0033):

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
