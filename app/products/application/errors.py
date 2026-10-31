from typing import ClassVar

from app.products.domain.product import ProductArchived as ProductArchived


class ProductNotFound(LookupError):
    code: ClassVar[str] = "variety.not_found"

    def __init__(self, product_id: int) -> None:
        super().__init__(f"no variety {product_id}")


class NameTaken(ValueError):
    code: ClassVar[str] = "variety.name_taken"

    def __init__(self, name: str) -> None:
        super().__init__(f"there is already a variety called {name}")


class NameHeldByArchived(ValueError):
    """The name belongs to an archived variety: fixed text, nothing typed is repeated."""

    code: ClassVar[str] = "variety.name_archived"

    def __init__(self) -> None:
        super().__init__("the name belongs to an archived variety")


class ProductHasHistory(ValueError):
    """A delete was refused because the variety has sale lines or stock entries: fixed
    text, nothing of the variety is repeated."""

    code: ClassVar[str] = "variety.has_history"

    def __init__(self) -> None:
        super().__init__("the variety has history, so it can only be archived")


class ProductUnitRequired(ValueError):
    """The business has two or more units and the request named none. Fixed text."""

    code: ClassVar[str] = "product.unit_required"

    def __init__(self) -> None:
        super().__init__("the business has several units, so the product needs one")


class UnitNotFound(LookupError):
    """The unit is not one of this business's. Fixed text: the id is never repeated."""

    code: ClassVar[str] = "unit.not_found"

    def __init__(self) -> None:
        super().__init__("no such unit")
