"""The ADR index `docs/architecture/decisiones.md`, generated from `docs/adr/*.md` alone (GH-692).

`read_front_matter` is the only reader of ADR front matter in the repo. `index_text` is a pure
function of the directory it is given: it reads no clock, no network and no git state, so the
committed page is reproducible byte for byte. Imports nothing from `app` or `tests`.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from scripts.docs.adr_ids import adr_id_from_file_name, superseded_by

_FENCE = "---"

INTRO = (
    "# Decisiones\n"
    "\n"
    "Índice de los ADR de [docs/adr/](../adr/): una fila por archivo, con su"
    " identificador enlazado, una frase en español y la marca que da la línea `status:`"
    " del propio ADR. Solo esa línea decide la marca de la columna «Estado»; esta página"
    " no afirma cuáles ADR están vigentes. Un ADR aceptado puede traer enmiendas o quedar"
    " reemplazado en parte por uno posterior, así que quien lo lee abre el ADR y sigue"
    " sus referencias. Por ejemplo, el [ADR"
    " 0048](../adr/0048-the-phone-check-measures-the-dom-for-what-a-person-reads.md)"
    " reemplaza solo la sección «Known gap» del [ADR"
    " 0029](../adr/0029-text-contrast-is-a-readme-table-checked-by-one-guard.md), y la"
    " línea `status:` de ninguno de los dos lo dice. Los ADR nuevos se llaman"
    " `AAAAMMDD-slug.md` y se citan `ADR-AAAAMMDD-slug`; los `NNNN-` quedan como están, y"
    " las filas nuevas se agregan al final de la tabla.\n"
    "\n"
    "Un ADR da el motivo de una decisión; lo que el sistema hace hoy se afirma en las"
    " demás páginas de [architecture/](README.md), que citan el código. Cómo se mantienen"
    " esas citas lo decide el [ADR"
    " 0068](../adr/0068-architecture-docs-cite-defined-symbols-checked-by-text.md).\n"
    "\n"
    "| ADR | Qué decide | Estado |\n"
    "| --- | --- | --- |\n"
)

ACCEPTED = "accepted"


class AdrIndexError(ValueError):
    """An ADR the index cannot list; the message starts with the file name."""


_NOT_IN_A_SUMMARY = (("|", "a pipe"), ("\n", "a line break"), ("\r", "a line break"))


def read_front_matter(text: str) -> dict[str, str]:
    """The `key: value` block between the `---` lines that open `text`, values as text.

    `{}` when the first line is not `---`. Raises `ValueError` when the block is not closed
    by a line that is exactly `---`, is not a mapping, or holds a value that is not text
    (the message names the key).

    The loader is `yaml.BaseLoader` instead of `yaml.safe_load` on purpose: it builds no
    Python object, so it is as safe, and it resolves no scalar, so `date: 2026-10-02` stays
    the text `2026-10-02` with no resolver override and no change to the shared `SafeLoader`.
    """
    lines = text.splitlines()
    if not lines or lines[0] != _FENCE:
        return {}
    try:
        end = lines.index(_FENCE, 1)
    except ValueError:
        raise ValueError("front matter is not closed") from None
    loaded = yaml.load("\n".join(lines[1:end]), Loader=yaml.BaseLoader)
    if loaded is None:
        return {}
    if not isinstance(loaded, dict):
        raise ValueError("front matter is not a mapping")
    for key, value in loaded.items():
        if not isinstance(value, str):
            raise ValueError(f"front matter key {key!r} is not text")
    return {str(key): str(value) for key, value in loaded.items()}


def _row(path: Path) -> str:
    name = path.name
    adr_id = adr_id_from_file_name(name)
    if adr_id is None:
        raise AdrIndexError(f"{name}: not an ADR file name")
    try:
        front = read_front_matter(path.read_text(encoding="utf-8"))
    except ValueError as error:
        raise AdrIndexError(f"{name}: {error}") from None
    summary = front.get("summary")
    if not summary:
        raise AdrIndexError(f"{name}: summary is missing or empty")
    for char, what in _NOT_IN_A_SUMMARY:
        if char in summary:
            raise AdrIndexError(f"{name}: summary holds {what}")
    status = front.get("status", "")
    replacement = superseded_by(status)
    if status == ACCEPTED:
        mark = ""
    elif replacement is not None:
        mark = f"reemplazada por {replacement}"
    else:
        raise AdrIndexError(f"{name}: unknown status {status!r}")
    return f"| [{adr_id.key}](../adr/{name}) | {summary} | {mark} |\n"


def index_text(adr_dir: Path) -> str:
    """The whole page for the ADRs in `adr_dir`: intro, then one row per file by file name.

    Raises `AdrIndexError` naming the file when an ADR has no usable `summary:` or a status
    that is neither `accepted` nor `superseded by <id>`.
    """
    return INTRO + "".join(_row(path) for path in sorted(adr_dir.glob("*.md")))
