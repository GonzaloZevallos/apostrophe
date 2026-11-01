"""The seed registry of the shared M3 comparator (`tests/migrations/m3.py`).

`SEED_INCREMENTS` maps an Alembic revision to a function that inserts, by raw SQL, at
least one row into every table created at or before that revision that no earlier
increment has seeded, in foreign-key order. `assert_m3` runs every increment up to the
revision it starts from and fails when any table is still empty, so a stale seed is a
failure and never a pass over an empty table.

A later migration part adds the increment for its own revision here: rows for the tables
its migration creates. It never copies this file or the comparator.
"""

from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.engine import Connection

NOW = "2026-01-01 12:00:00"
DAY = "2026-01-01"
Row = dict[str, object]


def _insert(connection: Connection, table: str, rows: list[Row]) -> None:
    for row in rows:
        columns = ", ".join(row)
        marks = ", ".join(f":{name}" for name in row)
        connection.execute(text(f"INSERT INTO {table} ({columns}) VALUES ({marks})"), row)


def seed_0019(connection: Connection) -> None:
    """Two businesses, so a per-business backfill shows; every child table follows."""
    _insert(
        connection,
        "business",
        [
            {"id": 1, "name": "First", "language": "en"},
            {"id": 2, "name": "Second", "language": "es-AR"},
        ],
    )
    _insert(
        connection,
        "app_user",
        [
            {
                "id": 1,
                "business_id": 1,
                "email": "one@example.com",
                "password_hash": "hash-one",
                "joined_at": NOW,
            },
            {
                "id": 2,
                "business_id": 2,
                "email": "two@example.com",
                "password_hash": "hash-two",
                "joined_at": None,
            },
        ],
    )
    _insert(
        connection,
        "variety",
        [
            {"id": 1, "business_id": 1, "name": "Alpha", "name_key": "alpha", "archived_at": None},
            {"id": 2, "business_id": 1, "name": "Beta", "name_key": "beta", "archived_at": NOW},
            {"id": 3, "business_id": 2, "name": "Gamma", "name_key": "gamma", "archived_at": None},
        ],
    )
    _insert(
        connection,
        "customer",
        [
            {"id": 1, "business_id": 1, "name": "Ana", "phone": "+5491100000001", "vip": 1},
            {"id": 2, "business_id": 1, "name": "Bruno", "phone": None, "vip": 0},
            {"id": 3, "business_id": 2, "name": "Carla", "phone": "+5491100000002", "vip": 0},
        ],
    )
    _insert(
        connection,
        "expense_category",
        [
            {"id": 1, "business_id": 1, "name": "Rent", "name_key": "rent"},
            {"id": 2, "business_id": 2, "name": "Transport", "name_key": "transport"},
        ],
    )
    _insert(
        connection,
        "expense",
        [
            {
                "id": 1,
                "business_id": 1,
                "category_id": 1,
                "spent_on": DAY,
                "amount": 1234,
                "detail": "January rent",
                "recorded_at": NOW,
            },
            {
                "id": 2,
                "business_id": 2,
                "category_id": 2,
                "spent_on": DAY,
                "amount": 567,
                "detail": "Bus",
                "recorded_at": NOW,
            },
        ],
    )
    _insert(
        connection,
        "sale",
        [
            {
                "id": 1,
                "business_id": 1,
                "sale_date": DAY,
                "customer_id": 1,
                "shipping_charged": 150,
                "note": "first sale",
                "recorded_at": NOW,
            },
            {
                "id": 2,
                "business_id": 2,
                "sale_date": DAY,
                "customer_id": None,
                "shipping_charged": 0,
                "note": None,
                "recorded_at": NOW,
            },
        ],
    )
    _insert(
        connection,
        "sale_line",
        [
            {
                "id": 1,
                "business_id": 1,
                "sale_id": 1,
                "variety_id": 1,
                "grams_hundredths": 2550,
                "pricing_rule": "list",
                "price_per_gram": 1000,
                "line_total": 25500,
                "position": 0,
            },
            {
                "id": 2,
                "business_id": 2,
                "sale_id": 2,
                "variety_id": 3,
                "grams_hundredths": 1000,
                "pricing_rule": "bulk",
                "price_per_gram": 800,
                "line_total": 8000,
                "position": 0,
            },
        ],
    )
    _insert(
        connection,
        "payment",
        [
            {
                "id": 1,
                "business_id": 1,
                "paid_on": DAY,
                "amount": 999,
                "method": "cash",
                "customer_id": 1,
                "sale_id": 1,
                "recorded_at": NOW,
            },
            {
                "id": 2,
                "business_id": 2,
                "paid_on": DAY,
                "amount": 321,
                "method": "transfer",
                "customer_id": None,
                "sale_id": None,
                "recorded_at": NOW,
            },
        ],
    )
    _insert(
        connection,
        "price_entry",
        [
            {
                "id": 1,
                "business_id": 1,
                "variety_id": 1,
                "effective_from": DAY,
                "list_price": 1000,
                "bulk_price": 800,
                "bulk_minimum_hundredths": 10000,
                "vip_price": 900,
            },
            {
                "id": 2,
                "business_id": 2,
                "variety_id": 3,
                "effective_from": DAY,
                "list_price": 1500,
                "bulk_price": None,
                "bulk_minimum_hundredths": None,
                "vip_price": None,
            },
        ],
    )
    _insert(
        connection,
        "stock_entry",
        [
            {
                "id": 1,
                "business_id": 1,
                "entry_date": DAY,
                "variety_id": 1,
                "origin": "purchase",
                "grams_hundredths": 50000,
                "total_cost": 40000,
                "note": "bought",
                "recorded_at": NOW,
            },
            {
                "id": 2,
                "business_id": 2,
                "entry_date": DAY,
                "variety_id": 3,
                "origin": "harvest",
                "grams_hundredths": 20000,
                "total_cost": None,
                "note": None,
                "recorded_at": NOW,
            },
        ],
    )
    _insert(
        connection,
        "stock_threshold",
        [
            {"id": 1, "business_id": 1, "variety_id": 1, "threshold_hundredths": 5000},
            {"id": 2, "business_id": 2, "variety_id": 3, "threshold_hundredths": 2500},
        ],
    )
    _insert(
        connection,
        "stock_withdrawal",
        [
            {
                "id": 1,
                "business_id": 1,
                "reason": "promotion",
                "withdrawn_on": DAY,
                "note": "gift",
                "recorded_at": NOW,
            },
            {
                "id": 2,
                "business_id": 2,
                "reason": "own_use",
                "withdrawn_on": DAY,
                "note": None,
                "recorded_at": NOW,
            },
        ],
    )
    _insert(
        connection,
        "stock_withdrawal_line",
        [
            {
                "id": 1,
                "business_id": 1,
                "stock_withdrawal_id": 1,
                "variety_id": 1,
                "position": 0,
                "grams_hundredths": 300,
            },
            {
                "id": 2,
                "business_id": 2,
                "stock_withdrawal_id": 2,
                "variety_id": 3,
                "position": 0,
                "grams_hundredths": 150,
            },
        ],
    )
    _insert(
        connection,
        "catalog_attributes",
        [
            {
                "id": 1,
                "business_id": 1,
                "variety_id": 1,
                "shown": 1,
                "emoji": "x",
                "indica_share": 40,
                "aroma": "citrus",
            },
            {
                "id": 2,
                "business_id": 2,
                "variety_id": 3,
                "shown": 0,
                "emoji": None,
                "indica_share": None,
                "aroma": None,
            },
        ],
    )
    _insert(
        connection,
        "catalog_header_footer",
        [
            {"id": 1, "business_id": 1, "header": "Hello", "footer": "Bye"},
            {"id": 2, "business_id": 2, "header": "Hola", "footer": "Chau"},
        ],
    )
    _insert(
        connection,
        "first_run",
        [
            {
                "id": 1,
                "business_id": 1,
                "checklist_gone_at": NOW,
                "imported_at": NOW,
                "import_notice_over_at": None,
            },
            {
                "id": 2,
                "business_id": 2,
                "checklist_gone_at": None,
                "imported_at": None,
                "import_notice_over_at": None,
            },
        ],
    )
    _insert(
        connection,
        "onboarding",
        [
            {
                "id": 1,
                "business_id": 1,
                "header_footer_pass": "done",
                "bot_pass": "skipped",
                "partner_pass": None,
                "categories_pass": "done",
                "ended_at": NOW,
                "created_at": NOW,
            },
            {
                "id": 2,
                "business_id": 2,
                "header_footer_pass": None,
                "bot_pass": None,
                "partner_pass": None,
                "categories_pass": None,
                "ended_at": None,
                "created_at": NOW,
            },
        ],
    )
    _insert(
        connection,
        "pinned_catalog",
        [
            {
                "id": 1,
                "business_id": 1,
                "token_ciphertext": b"ciphertext",
                "token_fingerprint": "f" * 64,
                "token_saved_on": DAY,
                "own_chat": "@own",
                "channel_chat": "@channel",
                "message_id": 7,
                "message_chat": "@channel",
                "message_token_fingerprint": "f" * 64,
                "last_published_text": "published text",
                "last_published_at": NOW,
                "last_failure": None,
                "last_checked_on": DAY,
            },
            {
                "id": 2,
                "business_id": 2,
                "token_ciphertext": None,
                "token_fingerprint": None,
                "token_saved_on": None,
                "own_chat": None,
                "channel_chat": None,
                "message_id": None,
                "message_chat": None,
                "message_token_fingerprint": None,
                "last_published_text": None,
                "last_published_at": None,
                "last_failure": "unauthorized",
                "last_checked_on": None,
            },
        ],
    )
    _insert(
        connection,
        "pricing_settings",
        [
            {"id": 1, "business_id": 1, "is_bulk_pricing": 1, "is_vip_customers": 1},
            {"id": 2, "business_id": 2, "is_bulk_pricing": 0, "is_vip_customers": 1},
        ],
    )
    _insert(
        connection,
        "reset_link",
        [
            {
                "id": 1,
                "business_id": 1,
                "user_id": 1,
                "token_digest": "a" * 64,
                "created_at": NOW,
            }
        ],
    )
    _insert(
        connection,
        "invitation",
        [
            {
                "id": 1,
                "kind": "business",
                "token_digest": "b" * 64,
                "business_id": None,
                "created_at": NOW,
                "used_at": None,
            },
            {
                "id": 2,
                "kind": "user",
                "token_digest": "c" * 64,
                "business_id": 1,
                "created_at": NOW,
                "used_at": NOW,
            },
        ],
    )
    _insert(
        connection,
        "login_guard",
        [{"email": "one@example.com", "failures": 2, "locked_until": NOW}],
    )
    _insert(
        connection,
        "login_address_guard",
        [
            {
                "address_digest": "d" * 64,
                "failures": 3,
                "window_start": NOW,
                "locked_until": None,
            }
        ],
    )


SEED_INCREMENTS: dict[str, Callable[[Connection], None]] = {"0019": seed_0019}
