"""The docs generator draws one diagram per `app/*` package, found from the filesystem.

A new package must either join `HEXAGON_ROOTS` (domain, application, adapters) or be listed
here as a non-hexagon one; otherwise the generated docs would draw it with the wrong shape.
"""

from scripts.docs.discover import discover
from scripts.docs.generate import layers_present
from tests.architecture.hexagon import REPO_ROOT
from tests.architecture.test_architecture import ALL_HEXAGON_NAMES

NON_HEXAGON_PACKAGES = frozenset({"shared"})
APP = REPO_ROOT / "app"


def test_discover_finds_the_hexagons_plus_the_named_non_hexagon_packages() -> None:
    hexagons = {name.removeprefix("app.") for name in ALL_HEXAGON_NAMES}
    assert set(discover(APP)) == hexagons | NON_HEXAGON_PACKAGES


def test_a_package_gets_hexagon_layers_exactly_when_it_is_a_hexagon_root() -> None:
    hexagons = {name.removeprefix("app.") for name in ALL_HEXAGON_NAMES}
    drawn_as_hexagon = {name for name in discover(APP) if layers_present(APP / name)}
    assert drawn_as_hexagon == hexagons
