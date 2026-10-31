from datetime import datetime
from typing import Literal

from app.products.application.errors import (
    NameHeldByArchived,
    NameTaken,
    ProductArchived,
    ProductHasHistory,
    ProductNotFound,
    ProductUnitRequired,
    UnitNotFound,
)
from app.products.application.ports import ProductLeaving, Products, UnitsReader
from app.products.domain.product import NameHolder, Product, ProductName
from app.shared.transaction import Transaction


def resolve_unit(units: UnitsReader, unit_id: int | None) -> int:
    """The unit a new product gets: the one named (of this business, else not found), or
    the business's only unit when none is named. This is a compatibility rule for callers
    that predate units, not a product rule (docs/product/units.md)."""
    if unit_id is None:
        only = units.only_unit()
        if only is None:
            raise ProductUnitRequired
        return only.id
    unit = units.get(unit_id)
    if unit is None:
        raise UnitNotFound
    return unit.id


def register_product(
    products: Products, transaction: Transaction, raw_name: str, unit_id: int
) -> Product:
    name = ProductName.of(raw_name)
    _require_name_free(products, name, other_than=None)
    product = products.add(Product(name, unit_id))
    transaction.commit()
    return product


def rename_product(
    products: Products, transaction: Transaction, product_id: int, raw_name: str
) -> Product:
    product = get_product(products, product_id)
    name = ProductName.of(raw_name)
    product.rename(name)
    _require_name_free(products, name, other_than=product_id)
    stored = products.save(product)
    transaction.commit()
    return stored


def _require_name_free(products: Products, name: ProductName, other_than: int | None) -> None:
    holder = products.name_holder(name, other_than=other_than)
    if holder is NameHolder.ARCHIVED:
        raise NameHeldByArchived
    if holder is NameHolder.LIVE:
        raise NameTaken(name.value)


def archive_product(
    products: Products, transaction: Transaction, product_id: int, at: datetime
) -> Product:
    """Never refused because the variety has or lacks history: only deleting is guarded."""
    product = get_product(products, product_id)
    product.archive(at)
    stored = products.save(product)
    transaction.commit()
    return stored


def restore_product(products: Products, transaction: Transaction, product_id: int) -> Product:
    product = get_product(products, product_id)
    product.restore()
    stored = products.save(product)
    transaction.commit()
    return stored


def get_product(products: Products, product_id: int) -> Product:
    product = products.get(product_id)
    if product is None:
        raise ProductNotFound(product_id)
    return product


def list_products(products: Products, *, archived: bool = False) -> list[Product]:
    return products.archived() if archived else products.listed()


def delete_product(
    products: Products,
    leaving: ProductLeaving,
    transaction: Transaction,
    product_id: int,
) -> None:
    """Only a variety with no history is deleted: the common refusal writes nothing, and
    the last word is one guarded delete after the dependents, in one transaction."""
    product = get_product(products, product_id)
    if product.is_archived:
        raise ProductArchived(product_id)
    if products.has_history(product_id):
        raise ProductHasHistory
    leaving.leaving(product_id)
    products.remove_price_entries(product_id)
    if not products.remove_unused(product_id):
        transaction.rollback()
        raise ProductHasHistory
    transaction.commit()


def removal_offered(products: Products, product: Product) -> Literal["delete", "archive"] | None:
    """`None` for an archived variety; otherwise the one removal its page offers."""
    if product.is_archived:
        return None
    assert product.id is not None
    return "archive" if products.has_history(product.id) else "delete"
