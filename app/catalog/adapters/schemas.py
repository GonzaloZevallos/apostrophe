from __future__ import annotations

from pydantic import BaseModel

from app.catalog.application.read_archived import ArchivedCatalogVarietyView
from app.catalog.application.read_catalog import CatalogVarietyView, CatalogView
from app.catalog.domain.product import CatalogState


class CatalogAttributesIn(BaseModel):
    shown: bool
    emoji: str | None
    indica_share: int | None
    aroma: str | None


class HeaderFooterIn(BaseModel):
    header: str
    footer: str


class CatalogVarietyOut(BaseModel):
    id: int
    name: str
    emoji: str | None
    indica_share: int | None
    aroma: str | None
    shown: bool
    state: CatalogState

    @classmethod
    def of(cls, view: CatalogVarietyView) -> CatalogVarietyOut:
        return cls(
            id=view.id,
            name=view.name,
            emoji=view.emoji,
            indica_share=view.indica_share,
            aroma=view.aroma,
            shown=view.shown,
            state=view.state,
        )


class CatalogOut(BaseModel):
    text: str | None
    header: str
    footer: str
    varieties: list[CatalogVarietyOut]

    @classmethod
    def of(cls, view: CatalogView) -> CatalogOut:
        return cls(
            text=view.text,
            header=view.header,
            footer=view.footer,
            varieties=[CatalogVarietyOut.of(v) for v in view.varieties],
        )


class ArchivedCatalogVarietyOut(BaseModel):
    variety_id: int
    name: str
    shown: bool
    emoji: str | None
    indica_share: int | None
    aroma: str | None

    @classmethod
    def of(cls, view: ArchivedCatalogVarietyView) -> ArchivedCatalogVarietyOut:
        return cls(
            variety_id=view.variety_id,
            name=view.name,
            shown=view.shown,
            emoji=view.emoji,
            indica_share=view.indica_share,
            aroma=view.aroma,
        )
