"""The screen families the `muestra.md` guard (`muestra_guard.py`) checks, and what each one
forbids (docs/adr/0035).

A family is switched on by the piece that redraws it: that piece lists its screens, and only
then does the guard read them and apply the denylist. Each family is its own declaration, so
the pieces that fill them never touch the same lines (the plan's invariant 7). `otras` is
reserved and no piece fills it.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Final


@dataclass(frozen=True)
class Family:
    """`screens` are file names under `docs/product/design-system/pantallas/`. `denylist`
    holds stale literals that must appear in none of them; it applies once `screens` is
    not empty."""

    name: str
    screens: tuple[str, ...]
    denylist: tuple[str, ...]

    @property
    def active(self) -> bool:
        return bool(self.screens)


INICIO = Family(
    name="inicio",
    screens=("Inicio.dc.html", "InicioOscuro.dc.html", "InicioCompu.dc.html"),
    denylist=(
        "135 g",
        "270 días",
        "$ 145.500",
        "$ 144.500",
        "$ 161.400",
        "capturadas el 05/10/2026",
        "ninguno de los tres períodos de la muestra tiene costo pendiente",
    ),
)

VARIEDADES = Family(
    name="variedades",
    screens=(
        "Variedades.dc.html",
        "VariedadesCompu.dc.html",
        "VariedadDetalle.dc.html",
        "EntradaStock.dc.html",
        "EntradaStockCompu.dc.html",
    ),
    denylist=("135 g", "270 días", "Hoy tiene 135 g"),
)

VENTAS = Family(
    name="ventas",
    screens=(
        "Ventas.dc.html",
        "VentasCompu.dc.html",
        "VentaDetalle.dc.html",
        "ClienteFicha.dc.html",
    ),
    denylist=(),
)

ANALISIS = Family(
    name="analisis",
    screens=("Analisis.dc.html", "AnalisisCompu.dc.html"),
    denylist=(
        "Septiembre 2026",
        "$ 2.684.000",
        "$ 1.284.000",
        "$ 892.000",
        "$ 508.000",
        "223,5 g",
        "$ 62.000",
        "$ 41.800",
        "$ 28.500",
        "$ 16.000",
        "Insumos de cultivo",
        "Envíos y traslados",
        "$ 512.000",
        "$ 486.000",
        "Tu mejor día es el sábado",
        "mejor: sábado",
    ),
)

# The archived variety's page and Archivadas, phone and computer; the dark twins of the
# registry compare against these same files.
ARCHIVED = Family(
    name="archived",
    screens=(
        "VariedadArchivada.dc.html",
        "VariedadArchivadaCompu.dc.html",
        "Archivadas.dc.html",
        "ArchivadasCompu.dc.html",
    ),
    denylist=(),
)

OTRAS = Family(
    name="otras",
    screens=(),
    denylist=(),
)

FAMILIES: tuple[Family, ...] = (INICIO, VARIEDADES, VENTAS, ANALISIS, ARCHIVED, OTRAS)


# The muestra pause (GH-526, PM ruling): the 2026-10-29 redraw of these drawings no longer
# shows the figures `muestra.md` holds, and a drawing is never edited to make a test pass.
# The figure agreement alone is skipped for the names in `PAUSED`; the date check, the
# denylist and every other check still apply. The ceiling is a literal of its own, never
# built from `PAUSED`: the pause can shrink, never grow. Each entry is the drawing and the
# issue the redesign README (docs/design/redesign/README.md) gives it.
PAUSEABLE: Final[tuple[str, ...]] = (
    "Inicio.dc.html",
    "InicioOscuro.dc.html",
    "InicioCompu.dc.html",
    "VentaDetalle.dc.html",
    "ClienteFicha.dc.html",
    "Analisis.dc.html",
    "AnalisisCompu.dc.html",
)

PAUSED_CEILING: Final[tuple[tuple[str, int], ...]] = (
    ("Inicio.dc.html", 497),
    ("InicioOscuro.dc.html", 497),
    ("InicioCompu.dc.html", 497),
    ("Analisis.dc.html", 321),
    ("AnalisisCompu.dc.html", 321),
)

PAUSED: tuple[str, ...] = (
    "Inicio.dc.html",
    "InicioOscuro.dc.html",
    "InicioCompu.dc.html",
    "Analisis.dc.html",
    "AnalisisCompu.dc.html",
)


def pause_problems(
    paused: tuple[str, ...], ceiling: tuple[tuple[str, int], ...], pantallas: Path
) -> list[str]:
    """What is wrong with a pause list: a name outside the ceiling, a duplicate, a file that
    is missing, a ceiling name that is not one of the seven pauseable drawings, or an issue
    that is not a positive integer."""
    problems: list[str] = []
    allowed = {name for name, _ in ceiling}
    for name in dict.fromkeys(paused):
        if name not in allowed:
            problems.append(f"{name} is paused but is not in PAUSED_CEILING")
    for name in dict.fromkeys(paused):
        if paused.count(name) > 1:
            problems.append(f"{name} is paused twice")
    ceiling_names = [name for name, _ in ceiling]
    for name in dict.fromkeys(ceiling_names):
        if ceiling_names.count(name) > 1:
            problems.append(f"{name} is in PAUSED_CEILING twice")
    for name in dict.fromkeys([*paused, *ceiling_names]):
        if not (pantallas / name).is_file():
            problems.append(f"{name} has no file in {pantallas.name}/")
    for name in dict.fromkeys(ceiling_names):
        if name not in PAUSEABLE:
            problems.append(f"{name} in PAUSED_CEILING is not one of the seven pauseable drawings")
    for name, issue in ceiling:
        if isinstance(issue, bool) or not isinstance(issue, int) or issue <= 0:
            problems.append(f"{name} in PAUSED_CEILING has issue {issue!r}, not a positive integer")
    return problems


# GH-333's English-label rule applies only to drawings that predate the 2026-10-29 redesign.
# The redesign writes each screen's copy in Spanish through i18next keys (epic #494), so the
# Spanish labels of these redrawn Análisis drawings are the target, not a defect (human ruling
# on GH-526). The exception is this literal list of files, never a rule on the label check
# itself: any other Análisis drawing with a Spanish label still fails.
REDESIGN_SPANISH: Final[tuple[str, ...]] = ("Analisis.dc.html", "AnalisisCompu.dc.html")
