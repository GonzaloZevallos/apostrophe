"""`CatalogImport` (app/catalog/adapters/import_port.py), the spreadsheet import's seam
over catalog attributes, header and footer (GH-11, subtask catalog-port).

A business and a variety are opened through the `client` fixture first, so the session
itself is still real; `CatalogImport` is then exercised directly over a plain `Session`
and `NoCommit`, because this is a port seam test, not a behaviour test
(CODING_STANDARDS §5's one agreed exception for the catalog, per the plan).
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.catalog.adapters.import_port import CatalogImport
from app.catalog.adapters.sql_attributes import SqlCatalogAttributes
from app.catalog.adapters.sql_catalog_varieties import SqlCatalogVarieties
from app.catalog.adapters.sql_header_footer import SqlCatalogHeaderFooter
from app.catalog.adapters.stock_status import StockStatusesFromStock
from app.catalog.application.read_catalog import read_catalog
from app.catalog.domain.errors import IndicaShareInvalid
from app.pricing_settings.adapters.sql_pricing_settings import SqlPricingSettings
from app.spreadsheet_import.application.no_commit import NoCommit
from app.spreadsheet_import.domain.rows import CatalogRow, HeaderFooterCells, SheetRef

TODAY = date(2026, 10, 2)
REF = SheetRef(sheet="Catálogo", row=6)


def _variety_id(client: TestClient) -> int:
    variety: int = client.post("/varieties", json={"name": "Importada"}).json()["id"]
    return variety


def _row(
    *,
    shown: str = "Sí",
    emoji: str | None = "🌿",
    indica: int | str | None = 50,
    aroma: str | None = "cítrico",
) -> CatalogRow:
    return CatalogRow(
        ref=REF, variety="Importada", shown=shown, emoji=emoji, indica=indica, aroma=aroma
    )


def test_check_attributes_accepts_a_well_formed_row(client: TestClient, engine: Engine) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        assert port.check_attributes(_row()) is None


def test_check_attributes_refuses_an_unknown_shown_value(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        refusal = port.check_attributes(_row(shown="Tal vez"))
        assert refusal is not None
        assert refusal.code == "import.shown_unknown"


def test_check_attributes_refuses_more_than_one_emoji(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        refusal = port.check_attributes(_row(emoji="🌿🌿"))
        assert refusal is not None
        assert refusal.code == "catalog.emoji_invalid"


def test_check_attributes_refuses_an_indica_share_out_of_range(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        refusal = port.check_attributes(_row(indica=150))
        assert refusal is not None
        assert refusal.code == "catalog.indica_share_invalid"


def test_check_attributes_refuses_an_indica_share_that_is_not_a_number(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        refusal = port.check_attributes(_row(indica="mitad"))
        assert refusal is not None
        assert refusal.code == "catalog.indica_share_invalid"


def test_check_attributes_refuses_an_aroma_over_two_hundred_characters(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        refusal = port.check_attributes(_row(aroma="x" * 201))
        assert refusal is not None
        assert refusal.code == "catalog.aroma_too_long"


def test_check_header_footer_accepts_blank_cells(client: TestClient, engine: Engine) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        assert port.check_header_footer(HeaderFooterCells(header="", footer="")) is None


def test_check_header_footer_refuses_a_header_over_five_hundred_characters(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        refusal = port.check_header_footer(HeaderFooterCells(header="x" * 501, footer=""))
        assert refusal is not None
        assert refusal.code == "catalog.header_too_long"


def test_check_header_footer_refuses_a_footer_over_five_hundred_characters(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        refusal = port.check_header_footer(HeaderFooterCells(header="", footer="x" * 501))
        assert refusal is not None
        assert refusal.code == "catalog.footer_too_long"


def test_write_attributes_writes_through_no_commit_and_reads_back(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)

    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        port.write_attributes(variety_id, _row(), TODAY, NoCommit())
        session.commit()

    with Session(engine) as session:
        attributes = SqlCatalogAttributes(session, business_id=1).all()[variety_id]
        assert attributes.shown is True
        assert attributes.emoji is not None
        assert attributes.emoji.value == "🌿"
        assert attributes.indica_share is not None
        assert attributes.indica_share.percent == 50
        assert attributes.aroma is not None
        assert attributes.aroma.text == "cítrico"

        view = read_catalog(
            SqlCatalogVarieties(session, business_id=1),
            StockStatusesFromStock(session, business_id=1),
            SqlCatalogAttributes(session, business_id=1),
            SqlCatalogHeaderFooter(session, business_id=1),
            SqlPricingSettings(session, business_id=1),
            TODAY,
        )
        written = next(v for v in view.varieties if v.id == variety_id)
        assert written.emoji == "🌿"
        assert written.indica_share == 50
        assert written.aroma == "cítrico"


def test_write_attributes_with_a_blank_cell_writes_no_emoji_share_or_aroma(
    client: TestClient, engine: Engine
) -> None:
    variety_id = _variety_id(client)

    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        port.write_attributes(
            variety_id, _row(shown="No", emoji=None, indica=None, aroma=None), TODAY, NoCommit()
        )
        session.commit()

    with Session(engine) as session:
        attributes = SqlCatalogAttributes(session, business_id=1).all()[variety_id]
        assert attributes.shown is False
        assert attributes.emoji is None
        assert attributes.indica_share is None
        assert attributes.aroma is None


def test_write_attributes_refuses_an_indica_share_that_is_not_a_number_and_writes_nothing(
    client: TestClient, engine: Engine
) -> None:
    """`check_attributes` already refuses a text indica cell (tested above); this
    proves `write_attributes` itself never trusts an unchecked caller either, raising
    the same `IndicaShareInvalid` catalog's own domain object would, and leaving no
    row behind rather than writing it as `IndicaShareInvalid`-but-stored."""
    variety_id = _variety_id(client)

    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        with pytest.raises(IndicaShareInvalid):
            port.write_attributes(variety_id, _row(indica="mitad"), TODAY, NoCommit())
        session.commit()

    with Session(engine) as session:
        assert variety_id not in SqlCatalogAttributes(session, business_id=1).all()


def test_write_header_footer_writes_through_no_commit_and_reads_back(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        port.write_header_footer(
            HeaderFooterCells(header="Encabezado importado", footer="Pie importado"),
            TODAY,
            NoCommit(),
        )
        session.commit()

    with Session(engine) as session:
        stored = SqlCatalogHeaderFooter(session, business_id=1).get()
        assert stored.header == "Encabezado importado"
        assert stored.footer == "Pie importado"


def test_write_header_footer_with_blank_cells_writes_a_blank_header_and_footer(
    client: TestClient, engine: Engine
) -> None:
    with Session(engine) as session:
        port = CatalogImport(session, business_id=1)
        port.write_header_footer(HeaderFooterCells(header="", footer=""), TODAY, NoCommit())
        session.commit()

    with Session(engine) as session:
        stored = SqlCatalogHeaderFooter(session, business_id=1).get()
        assert stored.header == ""
        assert stored.footer == ""
