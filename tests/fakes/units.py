"""A units reader for tests that stand fakes in for the repositories: every product is
measured in grams to the hundredth, so only the use case's own decisions are under test."""

from collections.abc import Collection

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.shared.unit import Unit

GRAMS = Unit(id=1, name="grams", label="g", decimals=2)


class GramsEverywhere:
    """Satisfies each hexagon's own `UnitsReader` port: `units_of` for sales and products."""

    def units_of(self, product_ids: Collection[int]) -> dict[int, Unit]:
        return {product_id: GRAMS for product_id in product_ids}


def set_unit_decimals(engine: Engine, decimals: int) -> None:
    """Every unit of every business admits `decimals`: a direct update, for a test whose
    subject is something other than the unit and whose quantities need a finer one than
    the 0 a new business opens with."""
    with engine.begin() as connection:
        connection.execute(text("UPDATE unit SET decimals = :decimals"), {"decimals": decimals})
