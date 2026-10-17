"""The screen families the `muestra.md` guard (`muestra_guard.py`) checks, and what each one
forbids (docs/adr/0035).

A family is switched on by the piece that redraws it: that piece lists its screens, and only
then does the guard read them and apply the denylist. Each family is its own declaration, so
the pieces that fill them never touch the same lines (the plan's invariant 7). `otras` is
reserved and no piece fills it.
"""

from dataclasses import dataclass


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

# The archived variety's page and Archivadas; the `registry` piece lists its screens.
ARCHIVED = Family(
    name="archived",
    screens=(),
    denylist=(),
)

OTRAS = Family(
    name="otras",
    screens=(),
    denylist=(),
)

FAMILIES: tuple[Family, ...] = (INICIO, VARIEDADES, VENTAS, ANALISIS, ARCHIVED, OTRAS)
