"""`draw_source_of`: a withdrawal's reason decides its draw source, with no
infrastructure (ADR-0031)."""

from __future__ import annotations

from app.stock.domain.draw_source import DrawSource, WithdrawalReason, draw_source_of


def test_both_reasons_map_to_their_own_draw_source() -> None:
    assert draw_source_of(WithdrawalReason.PROMOTION) is DrawSource.PROMOTION
    assert draw_source_of(WithdrawalReason.OWN_USE) is DrawSource.OWN_USE


def test_the_reason_values_are_the_stored_english_words() -> None:
    assert WithdrawalReason.PROMOTION.value == "promotion"
    assert WithdrawalReason.OWN_USE.value == "own_use"
