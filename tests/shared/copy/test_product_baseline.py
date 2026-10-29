"""The baseline of today's catalog and expenses texts (`app/shared/copy/en.baseline.json`):
frozen before anything moved, so production English has to keep rendering it byte for byte."""

import re
from string import Formatter

from app.settings import DEFAULT_LOCALES_DIR
from app.shared.copy import CopyCatalog, po_messages
from app.shared.copy.messages import po_path
from app.shared.language import ENGLISH
from tests.shared.copy.test_operator_baseline import baseline

AREAS = {"catalog", "expenses"}
PERCENT_KEY = "catalog.indica_line"


def product_baseline() -> dict[str, dict[str, object]]:
    return {key: entry for key, entry in baseline().items() if not key.startswith("operator.")}


def holes(text: str) -> dict[str, str]:
    return {
        str(field): f"<{field}>"
        for _literal, field, _spec, _conv in Formatter().parse(text)
        if field is not None
    }


def keys_outside_the_shape(entries: dict[str, dict[str, object]]) -> list[str]:
    return [
        key for key in entries if not re.fullmatch(r"(catalog|expenses)\.[a-z_]+(\.[a-z_]+)?", key)
    ]


def areas_not_matching_the_key(entries: dict[str, dict[str, object]]) -> list[str]:
    return [key for key, entry in entries.items() if key.split(".")[0] != entry["area"]]


def unnamed_holes_or_stray_percents(entries: dict[str, dict[str, object]]) -> list[str]:
    wrong: list[str] = []
    for key, entry in entries.items():
        text = str(entry["text"])
        if "%" in text and key != PERCENT_KEY:
            wrong.append(key)
        for _literal, field, _spec, _conv in Formatter().parse(text):
            if field is not None and not re.fullmatch(r"[a-z_]+", field):
                wrong.append(key)
    return wrong


def test_the_product_baseline_is_not_empty_and_holds_both_areas() -> None:
    assert {str(entry["area"]) for entry in product_baseline().values()} == AREAS


def test_every_product_key_has_the_shape_and_names_its_area() -> None:
    assert keys_outside_the_shape(product_baseline()) == []
    assert areas_not_matching_the_key(product_baseline()) == []


def test_the_shape_check_rejects_a_key_outside_it() -> None:
    entries: dict[str, dict[str, object]] = {
        "catalog.nothing_to_offer": {"area": "catalog", "text": "x"},
        "catalog.Bad-Key": {"area": "catalog", "text": "x"},
        "expenses.default_category.other": {"area": "catalog", "text": "x"},
    }

    assert keys_outside_the_shape(entries) == ["catalog.Bad-Key"]
    assert areas_not_matching_the_key(entries) == ["expenses.default_category.other"]


def test_placeholders_are_named_and_a_percent_appears_only_in_the_indica_line() -> None:
    assert unnamed_holes_or_stray_percents(product_baseline()) == []
    assert "%" in str(product_baseline()[PERCENT_KEY]["text"])


def test_the_placeholder_check_rejects_a_positional_hole_and_a_stray_percent() -> None:
    entries: dict[str, dict[str, object]] = {
        "catalog.aroma_line": {"area": "catalog", "text": "• Aroma: {}"},
        "catalog.bulk_line": {"area": "catalog", "text": "100% {price}"},
        "catalog.indica_line": {"area": "catalog", "text": "{indica}%"},
    }

    assert unnamed_holes_or_stray_percents(entries) == ["catalog.aroma_line", "catalog.bulk_line"]


def test_no_product_entry_is_pending() -> None:
    assert [key for key, entry in product_baseline().items() if entry.get("pending")] == []


def test_every_product_key_renders_in_production_english_as_its_baseline_text_byte_for_byte() -> (
    None
):
    gettext = CopyCatalog(DEFAULT_LOCALES_DIR).translations(ENGLISH).gettext
    for key, entry in product_baseline().items():
        text = str(entry["text"])
        data = holes(text)
        assert gettext(key).format(**data) == text.format(**data), key


def test_the_catalog_and_expenses_ids_of_the_english_po_are_all_in_the_baseline() -> None:
    held = [
        str(key)
        for key in po_messages(po_path(DEFAULT_LOCALES_DIR, ENGLISH.tag))
        if str(key).startswith(("catalog.", "expenses."))
    ]
    assert held
    assert [key for key in held if key not in product_baseline()] == []
