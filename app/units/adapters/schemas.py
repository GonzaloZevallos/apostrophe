from pydantic import BaseModel

from app.units.domain.unit import CountedUnit


class UnitIn(BaseModel):
    name: str
    label: str
    decimals: int


class UnitPatch(BaseModel):
    """Every field optional: what is left out stays as it is."""

    name: str | None = None
    label: str | None = None
    decimals: int | None = None


class UnitOut(BaseModel):
    id: int
    name: str
    label: str
    decimals: int
    product_count: int

    @classmethod
    def of(cls, counted: CountedUnit) -> "UnitOut":
        unit = counted.unit
        return cls(
            id=unit.id,
            name=unit.name,
            label=unit.label,
            decimals=unit.decimals,
            product_count=counted.product_count,
        )
