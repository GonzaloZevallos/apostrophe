"""`PlannedPriceBook.for_variety` (the plan's invariant: ids inside an owner check are
local ordinals that never leave that call), with no infrastructure: plain
`PriceHistoryRow`s in, a `VarietyPricing` or `None` out, the same shape `SqlPriceBook`
answers once written.
"""

from datetime import date

from app.sales.adapters.price_book import PlannedPriceBook
from app.shared.grams import Grams
from app.spreadsheet_import.domain.rows import PriceHistoryRow, SheetRef

REF = SheetRef(sheet="Ajustes", row=37)
KEYS = {"Blue Dream": "blue dream"}
ORDINALS = {"blue dream": 1}


def _row(
    effective: date,
    list_price: int,
    *,
    bulk_price: int | None = None,
    bulk_minimum: Grams | None = None,
    variety: str = "Blue Dream",
) -> PriceHistoryRow:
    return PriceHistoryRow(
        ref=REF,
        variety=variety,
        effective=effective,
        list_price=list_price,
        bulk_price=bulk_price,
        bulk_minimum=bulk_minimum,
    )


def test_for_variety_answers_the_latest_entry_on_or_before_the_day() -> None:
    history = [_row(date(2026, 1, 1), 1_000), _row(date(2026, 3, 1), 1_200)]
    book = PlannedPriceBook(history, KEYS, ORDINALS)

    pricing = book.for_variety(1, date(2026, 6, 1))

    assert pricing is not None
    assert pricing.variety_id == 1
    assert pricing.current is not None
    assert pricing.current.list_price == 1_200


def test_for_variety_answers_no_current_price_before_any_entry() -> None:
    history = [_row(date(2026, 3, 1), 1_200)]
    book = PlannedPriceBook(history, KEYS, ORDINALS)

    pricing = book.for_variety(1, date(2026, 1, 1))

    assert pricing is not None
    assert pricing.current is None


def test_for_variety_answers_none_for_an_ordinal_the_book_was_not_given() -> None:
    book = PlannedPriceBook([], KEYS, ORDINALS)

    assert book.for_variety(99, date(2026, 1, 1)) is None


def test_a_row_that_breaks_a_varieties_rule_is_left_out_of_the_planned_history() -> None:
    # Two rows share an effective date: `Variety.record_price` refuses the second, so
    # the planned history keeps only the first, the same way a duplicate price-entry
    # row never reaches `VarietiesImport.write_price_entry` on a real run.
    history = [_row(date(2026, 1, 1), 1_000), _row(date(2026, 1, 1), 1_200)]
    book = PlannedPriceBook(history, KEYS, ORDINALS)

    pricing = book.for_variety(1, date(2026, 6, 1))

    assert pricing is not None
    assert pricing.current is not None
    assert pricing.current.list_price == 1_000
