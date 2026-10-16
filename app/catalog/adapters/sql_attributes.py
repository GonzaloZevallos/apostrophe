"""The `CatalogAttributesRepository` port over `catalog_attributes`. Built for one
business; every statement filters on it. `put` is a single SQLite upsert on
`(business_id, variety_id)`, never a read followed by an insert (the plan's invariant):
the last write always wins, with no race between "does a row exist" and "write it".
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.catalog.adapters.tables import CatalogAttributesRow
from app.catalog.domain.attributes import CatalogAttributes


class SqlCatalogAttributes:
    def __init__(self, session: Session, business_id: int) -> None:
        self._session = session
        self._business_id = business_id

    def all(self) -> dict[int, CatalogAttributes]:
        statement = select(CatalogAttributesRow).where(
            CatalogAttributesRow.business_id == self._business_id
        )
        return {row.variety_id: _attributes(row) for row in self._session.scalars(statement)}

    def for_variety(self, variety_id: int) -> CatalogAttributes | None:
        statement = select(CatalogAttributesRow).where(
            CatalogAttributesRow.business_id == self._business_id,
            CatalogAttributesRow.variety_id == variety_id,
        )
        row = self._session.scalars(statement).one_or_none()
        return _attributes(row) if row is not None else None

    def put(self, variety_id: int, attributes: CatalogAttributes) -> None:
        values = {
            "business_id": self._business_id,
            "variety_id": variety_id,
            "shown": attributes.shown,
            "emoji": attributes.emoji.value if attributes.emoji is not None else None,
            "indica_share": (
                attributes.indica_share.percent if attributes.indica_share is not None else None
            ),
            "aroma": attributes.aroma.text if attributes.aroma is not None else None,
        }
        insert_statement = sqlite_insert(CatalogAttributesRow).values(**values)
        upsert_statement = insert_statement.on_conflict_do_update(
            index_elements=["business_id", "variety_id"],
            set_={
                "shown": insert_statement.excluded.shown,
                "emoji": insert_statement.excluded.emoji,
                "indica_share": insert_statement.excluded.indica_share,
                "aroma": insert_statement.excluded.aroma,
            },
        )
        self._session.execute(upsert_statement)
        self._session.flush()


def _attributes(row: CatalogAttributesRow) -> CatalogAttributes:
    return CatalogAttributes.of(
        shown=row.shown, emoji=row.emoji, indica_share=row.indica_share, aroma=row.aroma
    )
