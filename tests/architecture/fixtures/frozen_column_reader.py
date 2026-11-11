from app.customers.adapters.tables import CustomerRow
from app.products.adapters.tables import PriceEntryRow


def offend() -> list[object]:
    price = PriceEntryRow.vip_price
    member = CustomerRow.is_vip
    written = PriceEntryRow(vip_price=1)
    return [price, member, written]
