from collections.abc import Iterator
from pathlib import Path

import pytest

from tests.money_format.rescale_world import World, build_world


@pytest.fixture
def world(tmp_path: Path) -> Iterator[World]:
    """A scale-0 database with two businesses: the engine, the id of the business to
    rescale and the id of the other."""
    yield from build_world(tmp_path)
