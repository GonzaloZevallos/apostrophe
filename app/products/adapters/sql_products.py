from sqlalchemy import ColumnElement, delete, exists, select
from sqlalchemy.orm import Session, selectinload

from app.db import flush_or_refuse
from app.sales.adapters.tables import SaleLineRow
from app.shared.quantity import Quantity
from app.shared.reference import ReferenceRefused
from app.stock.adapters.tables import StockEntryRow, StockWithdrawalLineRow
from app.products.adapters.tables import PriceEntryRow, ProductRow
from app.products.domain.product import NameHolder, PriceEntry, Product, ProductName


class SqlProducts:
    """The `Products` port over SQLAlchemy, for one business. Every statement filters
    on that business; a variety of another business is, from here, a variety that does
    not exist (docs/adr/0004). Writes flush; the use case commits."""

    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def add(self, product: Product) -> Product:
        row = ProductRow(
            business_id=self._business_id, name=product.name.value, name_key=product.name.key
        )
        row.price_entries = [self._entry_row(e) for e in product.price_entries]
        self._session.add(row)
        self._session.flush()
        return _product(row)

    def get(self, product_id: int) -> Product | None:
        row = self._row(product_id)
        return None if row is None else _product(row)

    def listed(self) -> list[Product]:
        return self._by_name(ProductRow.archived_at.is_(None))

    def archived(self) -> list[Product]:
        return self._by_name(ProductRow.archived_at.is_not(None))

    def _by_name(self, archival: ColumnElement[bool]) -> list[Product]:
        statement = (
            select(ProductRow)
            .where(ProductRow.business_id == self._business_id, archival)
            .options(selectinload(ProductRow.price_entries))
            .order_by(ProductRow.name_key)
        )
        return [_product(row) for row in self._session.scalars(statement)]

    def save(self, product: Product) -> Product:
        assert product.id is not None, "save takes a variety that was added"
        row = self._row(product.id)
        if row is None:
            # Deleted by a partner since it was read: the caller asks its own lookup.
            raise ReferenceRefused
        row.name = product.name.value
        row.name_key = product.name.key
        row.archived_at = product.archived_at
        kept = {e.id for e in product.price_entries if e.id is not None}
        row.price_entries = [
            *(r for r in row.price_entries if r.id in kept),
            *(self._entry_row(e) for e in product.price_entries if e.id is None),
        ]
        flush_or_refuse(self._session)
        return _product(row)

    def name_holder(self, name: ProductName, *, other_than: int | None = None) -> NameHolder | None:
        statement = select(ProductRow.archived_at).where(
            ProductRow.business_id == self._business_id, ProductRow.name_key == name.key
        )
        if other_than is not None:
            statement = statement.where(ProductRow.id != other_than)
        found = self._session.execute(statement).first()
        if found is None:
            return None
        return NameHolder.LIVE if found.archived_at is None else NameHolder.ARCHIVED

    def has_history(self, product_id: int) -> bool:
        return bool(self._session.scalar(select(self._history_exists(product_id))))

    def remove_price_entries(self, product_id: int) -> None:
        self._session.execute(
            delete(PriceEntryRow).where(
                PriceEntryRow.variety_id == product_id,
                PriceEntryRow.business_id == self._business_id,
            )
        )
        self._session.expire_all()

    def remove_unused(self, product_id: int) -> bool:
        """One statement: the history check and the delete cannot be pulled apart by a
        sale, an entry or a withdrawal recorded in between (the foreign keys close the rest)."""
        statement = (
            delete(ProductRow)
            .where(
                ProductRow.id == product_id,
                ProductRow.business_id == self._business_id,
                ~self._history_exists(product_id),
            )
            .returning(ProductRow.id)
        )
        removed = self._session.execute(statement).first()
        self._session.expire_all()
        return removed is not None

    def _history_exists(self, product_id: int) -> ColumnElement[bool]:
        lines = exists().where(
            SaleLineRow.variety_id == product_id, SaleLineRow.business_id == self._business_id
        )
        entries = exists().where(
            StockEntryRow.variety_id == product_id, StockEntryRow.business_id == self._business_id
        )
        withdrawn = exists().where(
            StockWithdrawalLineRow.variety_id == product_id,
            StockWithdrawalLineRow.business_id == self._business_id,
        )
        return lines | entries | withdrawn

    def _row(self, product_id: int) -> ProductRow | None:
        statement = select(ProductRow).where(
            ProductRow.id == product_id, ProductRow.business_id == self._business_id
        )
        return self._session.scalar(statement)

    def _entry_row(self, entry: PriceEntry) -> PriceEntryRow:
        return PriceEntryRow(
            business_id=self._business_id,
            effective_from=entry.effective_from,
            list_price=entry.list_price,
            bulk_price=entry.bulk.price if entry.bulk else None,
            bulk_minimum_hundredths=entry.bulk.minimum.hundredths if entry.bulk else None,
            vip_price=entry.vip_price,
        )


def _product(row: ProductRow) -> Product:
    return Product(
        name=ProductName(row.name),
        price_entries=tuple(_entry(r) for r in row.price_entries),
        id=row.id,
        archived_at=row.archived_at,
    )


def _entry(row: PriceEntryRow) -> PriceEntry:
    minimum = row.bulk_minimum_hundredths
    return PriceEntry.of(
        effective_from=row.effective_from,
        list_price=row.list_price,
        bulk_price=row.bulk_price,
        bulk_minimum=None if minimum is None else Quantity(minimum),
        vip_price=row.vip_price,
        id=row.id,
    )
