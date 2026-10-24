"""The test locale `en-XA`, generated from English (docs/adr/0050).

Every value is wrapped in `⟦…⟧`, its ASCII letters turned into accented look-alikes and
about 35 % of filler added, with placeholders kept as they are. Pure and deterministic: the
same English always gives the same bytes, whatever the date.
"""

import math
import re

from babel.messages.catalog import Catalog

from app.shared.copy.messages import MessageValue

OPEN = "⟦"
CLOSE = "⟧"
GROWTH = 0.35
HEADER = (
    'msgid ""\n'
    'msgstr ""\n'
    '"Project-Id-Version: apostrophe\\n"\n'
    '"Language: en-XA\\n"\n'
    '"MIME-Version: 1.0\\n"\n'
    '"Content-Type: text/plain; charset=UTF-8\\n"\n'
    '"Content-Transfer-Encoding: 8bit\\n"\n'
    '"Plural-Forms: nplurals=2; plural=(n != 1);\\n"\n'
    '"Generated-By: scripts/pseudo_locale.py\\n"\n'
)

_PLACEHOLDER = re.compile(
    r"%%|%\([A-Za-z_][A-Za-z0-9_]*\)[#0\- +]*\d*(?:\.\d+)?[sdif]|%[sd]|\{[A-Za-z_][A-Za-z0-9_]*\}"
)
_LOOKALIKE = str.maketrans(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    "ÅßÇÐÈḞĜĤÌĴĶĿṀŇÖṖǪŘŠŤÛṼŴẊÝŽåƀçđèḟĝĥìĵķłṁňöṗǫřšťûṽŵẋýž",
)
_FILLER = "·~"


def _pseudo_text(text: str) -> str:
    if not text:
        return text
    pieces: list[str] = []
    length = 0
    position = 0
    for found in _PLACEHOLDER.finditer(text):
        plain = text[position : found.start()]
        pieces.append(plain.translate(_LOOKALIKE))
        pieces.append(found.group())
        length += len(plain)
        position = found.end()
    tail = text[position:]
    pieces.append(tail.translate(_LOOKALIKE))
    length += len(tail)
    filler = (_FILLER * length)[: math.ceil(GROWTH * length)]
    return f"{OPEN}{''.join(pieces)}{filler}{CLOSE}"


def pseudo_catalog(english: Catalog) -> Catalog:
    """The `en-XA` messages of `english`: same ids, each value (and each plural form on its
    own) pseudo-localised, an empty one left empty and no message fuzzy."""
    pseudo = Catalog(locale=None)
    for message in english:
        if not message.id:
            continue
        if isinstance(message.string, (tuple, list)):
            value: MessageValue = tuple(_pseudo_text(form) for form in message.string)
        else:
            value = _pseudo_text(str(message.string))
        pseudo.add(message.id, value, context=message.context)
    return pseudo


def _quoted(text: str) -> str:
    escaped = (
        text.replace("\\", "\\\\").replace('"', '\\"').replace("\t", "\\t").replace("\n", "\\n")
    )
    return f'"{escaped}"'


def _field(keyword: str, text: str) -> str:
    lines = text.split("\n")
    if len(lines) == 1:
        return f"{keyword} {_quoted(text)}\n"
    parts = [_quoted(line + "\n") for line in lines[:-1]]
    if lines[-1]:
        parts.append(_quoted(lines[-1]))
    return f'{keyword} ""\n' + "\n".join(parts) + "\n"


def po_text(catalog: Catalog) -> str:
    """`catalog` as the text of a `.po` file, written by hand so that it never carries a
    date or the version of the library that wrote it."""
    entries = [HEADER]
    for message in catalog:
        if not message.id:
            continue
        lines = ""
        if message.context:
            lines += _field("msgctxt", str(message.context))
        if isinstance(message.id, (tuple, list)):
            lines += _field("msgid", message.id[0]) + _field("msgid_plural", message.id[1])
            forms = message.string if isinstance(message.string, (tuple, list)) else ()
            for index, form in enumerate(forms):
                lines += _field(f"msgstr[{index}]", form)
        else:
            lines += _field("msgid", message.id) + _field("msgstr", str(message.string))
        entries.append(lines)
    return "\n".join(entries)
