"""Gettext files read and written through Babel, the only place that touches its untyped
corners (docs/adr/0050). Everything here is a pure function over a path."""

from pathlib import Path

from babel.messages.catalog import Message
from babel.messages.mofile import read_mo, write_mo
from babel.messages.pofile import read_po

# A message id is its text, or the (singular, plural) pair of a plural message; a value
# is the translated text, or one text per plural form.
MessageId = str | tuple[str, ...]
MessageValue = str | tuple[str, ...]
MessageMap = dict[MessageId, MessageValue]

CATALOG_FILE = "apostrophe"


def po_path(locales_dir: Path, tag: str) -> Path:
    return locales_dir / tag / "LC_MESSAGES" / f"{CATALOG_FILE}.po"


def mo_path(locales_dir: Path, tag: str) -> Path:
    return locales_dir / tag / "LC_MESSAGES" / f"{CATALOG_FILE}.mo"


def _key(message: Message) -> MessageId:
    return tuple(message.id) if isinstance(message.id, (tuple, list)) else str(message.id)


def _value(message: Message) -> MessageValue:
    if isinstance(message.string, (tuple, list)):
        ids = tuple(message.id) if isinstance(message.id, (tuple, list)) else ()
        # The compiled file stands in the id for an empty plural form; so does this map.
        return tuple(
            form or (ids[min(index, 1)] if ids else "") for index, form in enumerate(message.string)
        )
    return str(message.string)


def po_messages(po: Path) -> MessageMap:
    """The messages a compile of `po` carries: no header, no fuzzy entry, no empty one."""
    with po.open("rb") as handle:
        catalog = read_po(handle)
    return {
        _key(message): _value(message)
        for message in catalog
        if message.id and not message.fuzzy and message.string
    }


def mo_messages(mo: Path) -> MessageMap:
    with mo.open("rb") as handle:
        catalog = read_mo(handle)
    return {_key(message): _value(message) for message in catalog if message.id}


def compile_po(po: Path, mo: Path) -> None:
    """Writes `mo` from `po`, leaving fuzzy and empty entries out the way gettext does."""
    with po.open("rb") as handle:
        catalog = read_po(handle)
    with mo.open("wb") as handle:
        write_mo(handle, catalog)
