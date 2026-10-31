"""Products' clause for the unit's lowering guard: a price entry whose bulk minimum is not a
multiple of the step. Units declares the clause's shape and never reads `price_entry`;
`app/main.py` hands this builder over (docs/adr/0055)."""

from sqlalchemy import ColumnElement, exists

from app.products.adapters.tables import PriceEntryRow, ProductRow


def finer_bulk_minimums(unit_id: int, business_id: int, step: int) -> ColumnElement[bool]:
    return exists().where(
        PriceEntryRow.variety_id == ProductRow.id,
        ProductRow.unit_id == unit_id,
        ProductRow.business_id == business_id,
        PriceEntryRow.business_id == business_id,
        PriceEntryRow.bulk_minimum_hundredths % step != 0,
    )
