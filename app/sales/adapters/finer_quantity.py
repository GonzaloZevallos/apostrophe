"""Sales' clause for the unit's lowering guard: a sale line whose quantity is not a multiple
of the step. Units declares the clause's shape and never reads `sale_line`; `app/main.py`
hands this builder over (docs/adr/0055)."""

from sqlalchemy import ColumnElement, exists

from app.products.adapters.tables import ProductRow
from app.sales.adapters.tables import SaleLineRow


def finer_sale_lines(unit_id: int, business_id: int, step: int) -> ColumnElement[bool]:
    return exists().where(
        SaleLineRow.variety_id == ProductRow.id,
        ProductRow.unit_id == unit_id,
        ProductRow.business_id == business_id,
        SaleLineRow.business_id == business_id,
        SaleLineRow.grams_hundredths % step != 0,
    )
