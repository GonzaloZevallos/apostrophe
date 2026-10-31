"""`build_document` and `id_sets` (the plan's seams): every value conversion,
references including the composite expense foreign key and variety-following
labels, and that no password hash, invitation or digest ever reaches the document."""

from datetime import date, datetime
from typing import Any

from app.business_removal.domain.export_document import Business, build_document, id_sets
from app.business_removal.domain.schema import Column, ColumnType, ForeignKey, Schema, Table


def _col(name: str, *, primary_key: bool = False) -> Column:
    return Column(name, ColumnType.OTHER, nullable=True, primary_key=primary_key)


SCHEMA = Schema(
    (
        Table(
            "app_user",
            (_col("id", primary_key=True), _col("email"), _col("joined_at"), _col("password_hash")),
            (),
        ),
        Table(
            "customer",
            (_col("id", primary_key=True), _col("name"), _col("phone")),
            (),
        ),
        Table(
            "variety",
            (_col("id", primary_key=True), _col("name")),
            (),
        ),
        Table(
            "sale",
            (
                _col("id", primary_key=True),
                _col("sale_date"),
                _col("customer_id"),
                _col("shipping_charged"),
                _col("recorded_at"),
            ),
            (ForeignKey(("customer_id",), "customer", ("id",)),),
        ),
        Table(
            "sale_line",
            (
                _col("id", primary_key=True),
                _col("sale_id"),
                _col("variety_id"),
                _col("grams_hundredths"),
            ),
            (
                ForeignKey(("sale_id",), "sale", ("id",)),
                ForeignKey(("variety_id",), "variety", ("id",)),
            ),
        ),
        Table(
            "expense_category",
            (_col("id", primary_key=True), _col("business_id"), _col("name")),
            (),
        ),
        Table(
            "expense",
            (
                _col("id", primary_key=True),
                _col("business_id"),
                _col("category_id"),
                _col("spent_on"),
                _col("amount"),
            ),
            (
                ForeignKey(
                    ("business_id", "category_id"), "expense_category", ("business_id", "id")
                ),
            ),
        ),
        Table(
            "invitation",
            (_col("id", primary_key=True), _col("business_id"), _col("token_digest")),
            (),
        ),
        Table(
            "login_guard",
            (_col("email", primary_key=True), _col("attempts")),
            (),
        ),
    )
)

BUSINESS = Business(1, "La Flor", "es", "Europe/Madrid")
EXPORTED_AT = datetime(2026, 10, 3, 12, 0, 0)


def test_dates_and_instants_become_iso_strings() -> None:
    rows = {
        "app_user": [{"id": 1, "email": "a@b.com", "joined_at": datetime(2026, 1, 1, 9, 30)}],
        "customer": [],
        "variety": [],
        "sale": [
            {
                "id": 1,
                "sale_date": date(2026, 1, 2),
                "customer_id": None,
                "shipping_charged": 0,
                "recorded_at": datetime(2026, 1, 2, 10, 0, 0),
            }
        ],
        "sale_line": [],
        "expense_category": [],
        "expense": [],
    }

    document = build_document(BUSINESS, SCHEMA, rows, EXPORTED_AT)

    assert document["exported_at"] == "2026-10-03T12:00:00Z"
    sale = document["kinds"]["sale"][0]
    assert sale["sale_date"] == "2026-01-02"
    assert sale["recorded_at"] == "2026-01-02T10:00:00Z"
    assert sale["customer_id"] is None
    user = document["kinds"]["app_user"][0]
    assert user["joined_at"] == "2026-01-01T09:30:00Z"


def test_hundredths_are_formatted_from_integers_under_the_key_without_the_suffix() -> None:
    rows: dict[str, list[dict[str, Any]]] = {
        "app_user": [],
        "customer": [],
        "variety": [{"id": 1, "name": "OG"}],
        "sale": [
            {
                "id": 1,
                "sale_date": date(2026, 1, 2),
                "customer_id": None,
                "shipping_charged": 0,
                "recorded_at": datetime(2026, 1, 2, 10, 0, 0),
            }
        ],
        "sale_line": [
            {"id": 1, "sale_id": 1, "variety_id": 1, "grams_hundredths": 350},
        ],
        "expense_category": [],
        "expense": [],
    }

    document = build_document(BUSINESS, SCHEMA, rows, EXPORTED_AT)

    line = document["kinds"]["sale_line"][0]
    assert line["grams"] == "3.50"
    assert "grams_hundredths" not in line


def test_a_foreign_key_becomes_an_id_and_name_reference() -> None:
    rows = {
        "app_user": [],
        "customer": [{"id": 1, "name": "Juana", "phone": "123"}],
        "variety": [],
        "sale": [
            {
                "id": 1,
                "sale_date": date(2026, 1, 2),
                "customer_id": 1,
                "shipping_charged": 0,
                "recorded_at": datetime(2026, 1, 2, 10, 0, 0),
            }
        ],
        "sale_line": [],
        "expense_category": [],
        "expense": [],
    }

    document = build_document(BUSINESS, SCHEMA, rows, EXPORTED_AT)

    sale = document["kinds"]["sale"][0]
    assert sale["customer_id"] == {"id": 1, "name": "Juana"}


def test_the_composite_expense_foreign_key_references_the_category_by_id_alone() -> None:
    rows: dict[str, list[dict[str, Any]]] = {
        "app_user": [],
        "customer": [],
        "variety": [],
        "sale": [],
        "sale_line": [],
        "expense_category": [{"id": 1, "business_id": 1, "name": "Insumos de cultivo"}],
        "expense": [
            {
                "id": 1,
                "business_id": 1,
                "category_id": 1,
                "spent_on": date(2026, 1, 1),
                "amount": 500,
            },
        ],
    }

    document = build_document(BUSINESS, SCHEMA, rows, EXPORTED_AT)

    expense = document["kinds"]["expense"][0]
    assert expense["category_id"] == {"id": 1, "name": "Insumos de cultivo"}
    assert "business_id" not in expense
    category = document["kinds"]["expense_category"][0]
    assert "business_id" not in category


def test_a_table_with_no_name_column_is_labelled_by_its_variety() -> None:
    rows: dict[str, list[dict[str, Any]]] = {
        "app_user": [],
        "customer": [],
        "variety": [{"id": 1, "name": "OG Kush"}],
        "sale": [
            {
                "id": 1,
                "sale_date": date(2026, 1, 2),
                "customer_id": None,
                "shipping_charged": 0,
                "recorded_at": datetime(2026, 1, 2, 10, 0, 0),
            }
        ],
        "sale_line": [
            {"id": 1, "sale_id": 1, "variety_id": 1, "grams_hundredths": 100},
        ],
        "expense_category": [],
        "expense": [],
    }

    document = build_document(BUSINESS, SCHEMA, rows, EXPORTED_AT)

    line = document["kinds"]["sale_line"][0]
    assert line["sale_id"] == {"id": 1, "name": "2026-01-02"}
    assert line["variety_id"] == {"id": 1, "name": "OG Kush"}


def test_records_are_sorted_by_id() -> None:
    rows = {
        "app_user": [],
        "customer": [
            {"id": 2, "name": "Beta", "phone": "2"},
            {"id": 1, "name": "Alfa", "phone": "1"},
        ],
        "variety": [],
        "sale": [],
        "sale_line": [],
        "expense_category": [],
        "expense": [],
    }

    document = build_document(BUSINESS, SCHEMA, rows, EXPORTED_AT)

    assert [record["id"] for record in document["kinds"]["customer"]] == [1, 2]


def test_id_sets_collects_ids_per_kind() -> None:
    rows = {
        "app_user": [],
        "customer": [{"id": 1, "name": "A", "phone": "1"}, {"id": 2, "name": "B", "phone": "2"}],
        "variety": [],
        "sale": [],
        "sale_line": [],
        "expense_category": [],
        "expense": [],
    }

    document = build_document(BUSINESS, SCHEMA, rows, EXPORTED_AT)

    assert id_sets(document)["customer"] == frozenset({1, 2})


def test_no_password_hash_or_withheld_table_ever_reaches_the_document() -> None:
    rows: dict[str, list[dict[str, Any]]] = {
        "app_user": [
            {"id": 1, "email": "a@b.com", "joined_at": None, "password_hash": "scrypt$..."}
        ],
        "customer": [],
        "variety": [],
        "sale": [],
        "sale_line": [],
        "expense_category": [],
        "expense": [],
        "invitation": [{"id": 1, "business_id": 1, "token_digest": "deadbeef"}],
        "login_guard": [{"email": "a@b.com", "attempts": 3}],
    }

    document = build_document(BUSINESS, SCHEMA, rows, EXPORTED_AT)

    assert "invitation" not in document["kinds"]
    assert "login_guard" not in document["kinds"]
    user = document["kinds"]["app_user"][0]
    assert "password_hash" not in user
    assert "business_id" not in user


def test_the_header_carries_the_business_s_id_name_language_and_time_zone() -> None:
    document = build_document(
        Business(1, "La Flor", "de", "Asia/Tokyo"),
        SCHEMA,
        {"app_user": [], "customer": []},
        EXPORTED_AT,
    )

    assert document["business"] == {
        "id": 1,
        "name": "La Flor",
        "language": "de",
        "time_zone": "Asia/Tokyo",
    }
