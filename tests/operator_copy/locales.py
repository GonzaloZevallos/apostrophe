"""The catalogs the operator-copy tests run over: production `en` and `en-XA`, and a `de`
written from `en` (each text is `de:` + the English, placeholders kept), all in a
temporary directory -- no hand-kept `de` `.po` lives in the fixtures (docs/adr/0050)."""

from __future__ import annotations

import shutil
from pathlib import Path

from babel.messages.catalog import Catalog

from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import compile_po, po_text, read_catalog
from app.shared.copy.messages import MessageValue, po_path
from app.shared.copy.pseudo import HEADER
from app.shared.language import ENGLISH, TEST_LOCALE

MARK = "de:"


def _german(text: str) -> str:
    return f"{MARK}{text}"


def _de_catalog(english: Catalog) -> Catalog:
    german = Catalog(locale=None)
    for message in english:
        if not message.id:
            continue
        value: MessageValue
        if isinstance(message.string, (tuple, list)):
            value = tuple(_german(form) for form in message.string)
        else:
            value = _german(str(message.string))
        german.add(message.id, value, context=message.context)
    return german


def build_operator_locales(root: Path) -> Path:
    """`root` holding `en`, `en-XA` (copied) and `de` (written and compiled)."""
    locales = root / "locales"
    for language in (ENGLISH, TEST_LOCALE):
        shutil.copytree(DEFAULT_LOCALES_DIR / language.tag, locales / language.tag)
    english = read_catalog(po_path(locales, ENGLISH.tag))
    target = po_path(locales, "de")
    target.parent.mkdir(parents=True)
    target.write_text(
        po_text(_de_catalog(english)).replace(HEADER, HEADER.replace("en-XA", "de"), 1),
        encoding="utf-8",
    )
    compile_po(target, target.with_suffix(".mo"))
    return locales
