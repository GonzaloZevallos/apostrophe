"""Test helper: the VIP type and customer membership, set straight on the rows. The VIP
type is made by the upgrade or the import (docs/adr/0070), never by a route, and a
customer's type is written by the Customer API, which these tests of readers do not
depend on."""

from sqlalchemy import delete, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.customer_types.adapters.sql_customer_type_prices import SqlCustomerTypePrices
from app.customer_types.adapters.tables import CustomerTypePriceRow, CustomerTypeRow
from app.customers.adapters.tables import CustomerRow
from app.products.adapters.tables import PriceEntryRow


def make_type(
    engine: Engine,
    name: str = "VIP",
    *,
    is_vip: bool,
    business_name: str = "Primer Negocio",
) -> int:
    """A customer type of the business; `is_vip` marks the one VIP type, whatever the name."""
    with Session(engine) as session:
        business_id = session.scalars(
            select(BusinessRow.id).where(BusinessRow.name == business_name)
        ).one()
        row = CustomerTypeRow(
            business_id=business_id,
            name=name,
            name_key=name.strip().lower(),
            icon="star" if is_vip else "circle",
            is_vip=is_vip,
        )
        session.add(row)
        session.commit()
        return row.id


def put_in_type(engine: Engine, customer_id: int, type_id: int | None) -> None:
    with Session(engine) as session:
        session.execute(
            update(CustomerRow)
            .where(CustomerRow.id == customer_id)
            .values(customer_type_id=type_id)
        )
        session.commit()


def price_type(engine: Engine, product_id: int, type_id: int, price: int) -> None:
    """The type's price for the product, set straight on a `customer_type_price` row tied to
    the product's latest Price entry (docs/adr/0059): what the VIP price field of a Price
    entry saves. A row already tied to that entry for the type is replaced."""
    with Session(engine) as session:
        entry = session.execute(
            select(PriceEntryRow.id, PriceEntryRow.business_id, PriceEntryRow.effective_on)
            .where(PriceEntryRow.variety_id == product_id)
            .order_by(PriceEntryRow.effective_on.desc())
        ).first()
        assert entry is not None, "the product needs a Price entry first"
        entry_id, business_id, effective_on = entry
        session.execute(
            delete(CustomerTypePriceRow).where(
                CustomerTypePriceRow.price_entry_id == entry_id,
                CustomerTypePriceRow.customer_type_id == type_id,
            )
        )
        SqlCustomerTypePrices(session, business_id).add(
            type_id, product_id, effective_on, price, entry_id
        )
        session.commit()
