from __future__ import annotations

from pydantic import BaseModel

from app.catalog.application.read_catalog import CatalogVarietyView, CatalogView
from app.catalog.domain.variety import CatalogState


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
