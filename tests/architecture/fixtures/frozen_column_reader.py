from sqlalchemy import insert
from sqlalchemy.sql import Select

from app.customers.adapters.tables import CustomerRow
from app.products.adapters.tables import PriceEntryRow
from app.products.adapters.tables import PriceEntryRow as Entry


def offend() -> list[object]:
    price = PriceEntryRow.vip_price
    member = CustomerRow.is_vip
    written = PriceEntryRow(vip_price=1)
    aliased = Entry.vip_price
    inserted = insert(PriceEntryRow).values(vip_price=2)
    column = PriceEntryRow.__table__.c.vip_price
    return [price, member, written, aliased, inserted, column, Select]
