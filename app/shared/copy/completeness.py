from functools import cache
from pathlib import Path

from babel.messages.catalog import Message
from babel.messages.pofile import read_po

from app.shared.copy.messages import po_path
from app.shared.language import ENGLISH, Language

_FileStamp = tuple[int, int] | None


def _stamp(path: Path) -> _FileStamp:
    try:
        stat = path.stat()
    except OSError:
        return None
    return (stat.st_mtime_ns, stat.st_size)


def missing_keys(locales_dir: Path, language: Language) -> tuple[str, ...]:
    """The English ids `language` lacks, in `en.po` order.

    A key is missing when it is absent, flagged fuzzy (whatever its text) or has an empty
    plural form. A language with no `.po` lacks every key."""
    english = po_path(locales_dir, ENGLISH.tag)
    own = po_path(locales_dir, language.tag)
    return _missing(locales_dir.resolve(), language.tag, _stamp(english), _stamp(own))


@cache
def _missing(
    locales_dir: Path, tag: str, english_stamp: _FileStamp, own_stamp: _FileStamp
) -> tuple[str, ...]:
    # The stamps are the cache key: an edited file has a new one and is read again.
    english_ids = _ids(po_path(locales_dir, ENGLISH.tag)) if english_stamp else ()
    if own_stamp is None:
        return english_ids
    done = _complete_ids(po_path(locales_dir, tag))
    return tuple(key for key in english_ids if key not in done)


def _messages(po: Path) -> list[Message]:
    with po.open("rb") as handle:
        return [message for message in read_po(handle) if message.id]


def _text(message: Message) -> str:
    return str(message.id[0] if isinstance(message.id, (tuple, list)) else message.id)


def _ids(po: Path) -> tuple[str, ...]:
    return tuple(_text(message) for message in _messages(po))


def _complete_ids(po: Path) -> frozenset[str]:
    return frozenset(
        _text(message) for message in _messages(po) if not message.fuzzy and _filled(message.string)
    )


def _filled(string: str | tuple[str, ...] | list[str] | None) -> bool:
    if string is None:
        return False
    if isinstance(string, str):
        return bool(string)
    return len(string) > 0 and all(string)
