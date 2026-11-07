"""`DrawSource`: a draw is an adjustment, a sale line or a withdrawal, whatever the
withdrawal's reason (ADR-0031). The reason is the business's own list and moves no lot."""

from __future__ import annotations

from app.stock.domain.draw_source import DrawSource


def test_a_draw_comes_from_one_of_three_sources() -> None:
    assert {source.name for source in DrawSource} == {"ADJUSTMENT", "SALE_LINE", "WITHDRAWAL"}
