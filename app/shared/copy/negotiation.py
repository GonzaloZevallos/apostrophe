"""The language of a page served before anyone signs in (docs/adr/0050).

Pure, and its signature cannot take a business, a user, an invitation or a link: the
answer depends on the `Accept-Language` header, the forced language and the selectable
list alone, so the page reveals nothing about any of them.
"""

import re
from collections.abc import Collection

from babel import negotiate_locale

from app.shared.language import ENGLISH, Language

_MAX_HEADER = 1024
_PRINTABLE = re.compile(r"[\x20-\x7e]*")
_TAG = re.compile(r"[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*")
_WEIGHT = re.compile(r"0(\.\d{0,3})?|1(\.0{0,3})?")


def _entry(raw: str) -> tuple[str, float] | None:
    """The `(tag, q)` of one header element, or `None` when it is malformed."""
    tag, *parameters = (part.strip() for part in raw.split(";"))
    if tag != "*" and _TAG.fullmatch(tag) is None:
        return None
    if not parameters:
        return tag, 1.0
    if len(parameters) > 1:
        return None
    name, equals, value = parameters[0].partition("=")
    if name.strip().lower() != "q" or not equals:
        return None
    value = value.strip()
    if _WEIGHT.fullmatch(value) is None:
        return None
    return tag, float(value)


def _candidates(header: str) -> list[str] | None:
    """The tags to try, best first; `None` when any element is malformed."""
    entries: list[tuple[str, float]] = []
    for raw in header.split(","):
        if not raw.strip():
            continue
        entry = _entry(raw)
        if entry is None:
            return None
        entries.append(entry)
    usable = [(tag, weight) for tag, weight in entries if tag != "*" and weight > 0]
    usable.sort(key=lambda entry: entry[1], reverse=True)
    return [tag for tag, _ in usable]


def pre_sign_in_language(
    accept_language: str | None, forced: Language | None, selectable: Collection[Language]
) -> Language:
    """The forced language when there is one; else the best selectable match of the
    header; else English. Never raises, whatever the header holds."""
    if forced is not None:
        return forced
    if (
        not accept_language
        or len(accept_language) > _MAX_HEADER
        or _PRINTABLE.fullmatch(accept_language) is None
    ):
        return ENGLISH
    candidates = _candidates(accept_language)
    if not candidates:
        return ENGLISH
    # Babel answers in the case of the header's tag, so the answer is looked up folded.
    available = {language.tag.lower(): language for language in selectable}
    chosen = negotiate_locale(candidates, list(available), sep="-")
    if chosen is None:
        return ENGLISH
    return available.get(chosen.lower(), ENGLISH)
