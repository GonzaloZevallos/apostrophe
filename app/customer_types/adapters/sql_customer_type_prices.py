from collections.abc import Sequence
from datetime import date

from sqlalchemy import ColumnElement, delete, select
from sqlalchemy.orm import Session

from app.customer_types.adapters.tables import CustomerTypePriceRow
from app.db import domain_amount, money_of_domain, money_scale_factor, money_stored_value, scaled


class SqlCustomerTypePrices:
    """The rows of `customer_type_price` for one business (docs/adr/0059). Every statement
    filters on that business: a row of another business is, from here, a row that does not
    exist (docs/adr/0004). A row is never updated, a new price is a new row. Writes flush;
    the use case commits. Amounts are the domain's int, in the unit of the business's
    decimals, on the way in and out; the scale is applied here, inside the statement or the
    stored value, and nowhere else."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def add(
        self,
        type_id: int,
        product_id: int,
        effective_on: date,
        price: int,
        price_entry_id: int | None,
    ) -> None:
        self._session.add(
            CustomerTypePriceRow(
                business_id=self._business_id,
                customer_type_id=type_id,
                variety_id=product_id,
                effective_on=effective_on,
                price=money_stored_value(
                    self._session,
                    self._business_id,
                    money_of_domain(self._session, self._business_id, price),
                ),
                price_entry_id=price_entry_id,
            )
        )
        self._session.flush()

    def tied_price(self, price_entry_id: int, type_id: int) -> int | None:
        """The price the type has in the row tied to this Price entry, as the domain's int."""
        factor = money_scale_factor(self._session, self._business_id)
        statement = select(scaled(CustomerTypePriceRow.price, factor)).where(
            CustomerTypePriceRow.business_id == self._business_id,
            CustomerTypePriceRow.price_entry_id == price_entry_id,
            CustomerTypePriceRow.customer_type_id == type_id,
        )
        hundredths = self._session.scalar(statement)
        return (
            None
            if hundredths is None
            else domain_amount(self._session, self._business_id, hundredths)
        )

    def prices_of_type(self, type_id: int, entry_ids: Sequence[int]) -> dict[int, int]:
        """The type's price by Price entry id, for the entries that have one: one
        statement whatever the number of entries."""
        if not entry_ids:
            return {}
        factor = money_scale_factor(self._session, self._business_id)
        statement = select(
            CustomerTypePriceRow.price_entry_id, scaled(CustomerTypePriceRow.price, factor)
        ).where(
            CustomerTypePriceRow.business_id == self._business_id,
            CustomerTypePriceRow.customer_type_id == type_id,
            CustomerTypePriceRow.price_entry_id.in_(entry_ids),
        )
        return {
            entry_id: domain_amount(self._session, self._business_id, hundredths)
            for entry_id, hundredths in self._session.execute(statement).all()
            if entry_id is not None
        }

    def remove_for_entry(self, price_entry_id: int) -> None:
        self._remove(CustomerTypePriceRow.price_entry_id == price_entry_id)

    def remove_for_product(self, product_id: int) -> None:
        self._remove(CustomerTypePriceRow.variety_id == product_id)

    def remove_for_type(self, type_id: int) -> None:
        self._remove(CustomerTypePriceRow.customer_type_id == type_id)

    def _remove(self, which: ColumnElement[bool]) -> None:
        self._session.execute(
            delete(CustomerTypePriceRow).where(
                CustomerTypePriceRow.business_id == self._business_id, which
            )
        )
        self._session.flush()
