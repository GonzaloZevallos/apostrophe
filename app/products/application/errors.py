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


class ProductUnitLocked(ValueError):
    """The product has history (a sale line, a stock entry or a withdrawal line), so its
    unit is fixed for good. Fixed text: nothing of the product or the unit is repeated."""

    code: ClassVar[str] = "product.unit_locked"

    def __init__(self) -> None:
        super().__init__("the product has history, so its unit cannot change")


class ProductUnitDecimalsInUse(ValueError):
    """A bulk minimum or the low-stock threshold of the product uses more decimals than
    the new unit allows. Fixed text: no quantity or unit is repeated."""

    code: ClassVar[str] = "product.unit_decimals_in_use"

    def __init__(self) -> None:
        super().__init__("a quantity of the product uses more decimals than the unit allows")
