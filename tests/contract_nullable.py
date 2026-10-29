"""Nullability for every fixture `tests/contract_shapes.py::assert_matches_fixture`
checks (plan, "Nullability"). Kept out of `web/src/api/fixtures/` on purpose: a
fixture is plain JSON the front's `fetch` fakes also import, so its own type contract
lives here instead, hand-written, never guessed from one example.

Path notation: `a.b` for a nested key, `lines[]` for a plain list's representative
item, `rows[payment]` for the item of a kind-discriminated list carrying that `kind`.

A nullable object or array field is declared with `ShapeOf`, pointing at a fixture
path that shows that object (or array) non-null — never a bare `"object"`/`"array"`,
which would accept any value of that JSON type, `null` included once stripped of its
own shape.

`tests/test_contract_shapes.py::test_every_fixture_routes_nullable_fields_match_openapi`
keeps this mapping equal to each fixture's routes' nullable fields in `app.openapi()`,
so it cannot rot.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

JsonType = Literal["object", "array", "string", "integer", "number", "boolean"]


@dataclass(frozen=True)
class ShapeOf:
    """A nullable field declared as: `null`, or exactly the shape at `path` in the
    fixture named `fixture` (which must show that path non-null)."""

    fixture: str
    path: str


NULLABLE: Mapping[str, Mapping[str, JsonType | ShapeOf]] = {
    "account": {
        "owing_since": "string",
    },
    "analysis": {
        "first_record": "string",
        "month.previous": "string",
        "month.next": "string",
        "month.average_margin.percent": "integer",
        "month.shortfall": ShapeOf("analysis", "month.shortfall"),
        "month.promotion": ShapeOf("analysis", "month.promotion"),
        "month.own_use": ShapeOf("analysis", "month.own_use"),
        "month.varieties[].share_percent": "integer",
        "month.varieties[].margin.percent": "integer",
        "since_first_record": ShapeOf("analysis", "since_first_record"),
        "since_first_record.shortfall": ShapeOf("analysis", "since_first_record.shortfall"),
        "since_first_record.promotion": ShapeOf("analysis", "since_first_record.promotion"),
        "since_first_record.own_use": ShapeOf("analysis", "since_first_record.own_use"),
        "weeks[].shortfall": ShapeOf("analysis", "weeks[].shortfall"),
        "weeks[].promotion": ShapeOf("analysis", "weeks[].promotion"),
        "weeks[].own_use": ShapeOf("analysis", "weeks[].own_use"),
        "months[].shortfall": ShapeOf("analysis", "months[].shortfall"),
        "months[].promotion": ShapeOf("analysis", "months[].promotion"),
        "months[].own_use": ShapeOf("analysis", "months[].own_use"),
    },
    "analysis-empty": {
        # `analysis-empty.json` is a business with no record at all: every nullable
        # object is `null` there, so the sibling fixture `analysis` shows each non-null.
        "first_record": "string",
        "month.previous": "string",
        "month.next": "string",
        "month.average_margin.percent": "integer",
        "month.shortfall": ShapeOf("analysis", "month.shortfall"),
        "month.promotion": ShapeOf("analysis", "month.promotion"),
        "month.own_use": ShapeOf("analysis", "month.own_use"),
        "month.varieties[].share_percent": "integer",
        "month.varieties[].margin.percent": "integer",
        "since_first_record": ShapeOf("analysis", "since_first_record"),
        "since_first_record.shortfall": ShapeOf("analysis", "since_first_record.shortfall"),
        "since_first_record.promotion": ShapeOf("analysis", "since_first_record.promotion"),
        "since_first_record.own_use": ShapeOf("analysis", "since_first_record.own_use"),
        "weeks[].shortfall": ShapeOf("analysis", "weeks[].shortfall"),
        "weeks[].promotion": ShapeOf("analysis", "weeks[].promotion"),
        "weeks[].own_use": ShapeOf("analysis", "weeks[].own_use"),
        "months[].shortfall": ShapeOf("analysis", "months[].shortfall"),
        "months[].promotion": ShapeOf("analysis", "months[].promotion"),
        "months[].own_use": ShapeOf("analysis", "months[].own_use"),
    },
    "customer": {
        "phone": "string",
        "owing_since": "string",
    },
    "customer-no-phone": {
        # A customer with no phone (ADR-0021): every nullable field is `null` here.
        "phone": "string",
        "owing_since": "string",
    },
    "debtors": {
        "debtors[].owing_since": "string",
    },
    "movements": {
        # The fixture is a bare list of `kind`-discriminated items.
        "[entry].total_cost": "integer",
        "[entry].cost_per_gram": "integer",
        "[entry].note": "string",
    },
    "panel": {
        "periods.today.average_sale": "integer",
        "periods.week.average_sale": "integer",
        "periods.month.average_sale": "integer",
        "periods.today.shortfall": ShapeOf("panel", "periods.week.shortfall"),
        "periods.week.shortfall": ShapeOf("panel", "periods.week.shortfall"),
        "periods.month.shortfall": ShapeOf("panel", "periods.week.shortfall"),
        "periods.today.promotion": ShapeOf("panel", "periods.week.promotion"),
        "periods.week.promotion": ShapeOf("panel", "periods.week.promotion"),
        "periods.month.promotion": ShapeOf("panel", "periods.week.promotion"),
        "periods.today.own_use": ShapeOf("panel", "periods.week.own_use"),
        "periods.week.own_use": ShapeOf("panel", "periods.week.own_use"),
        "periods.month.own_use": ShapeOf("panel", "periods.week.own_use"),
        "debts.oldest": "string",
        "stock[].sold_out_since": "string",
        "stock[].threshold": "number",
        "stock[].days_left": "integer",
    },
    "payment": {
        "after.owing_since": "string",
    },
    "payment-preview": {
        "after.owing_since": "string",
    },
    "pinnedCatalog": {
        "token_saved_on": "string",
        "publish_blocked_by": "string",
        "own_chat": "string",
        "channel_chat": "string",
        "status": ShapeOf("pinnedCatalog", "status"),
        "status.reason": "string",
        "status.last_published_on": "string",
    },
    "pinnedCatalogStatus": {
        "status": ShapeOf("pinnedCatalogStatus", "status"),
        "status.reason": "string",
        "status.last_published_on": "string",
    },
    "pinnedCatalogTest": {
        "token_saved_on": "string",
        "publish_blocked_by": "string",
        "own_chat": "string",
        "channel_chat": "string",
        # `pinnedCatalogTest.json`'s own `status` is `null`: the sibling fixture
        # `pinnedCatalog` is the one that shows the object non-null.
        "status": ShapeOf("pinnedCatalog", "status"),
        "status.reason": "string",
        "status.last_published_on": "string",
    },
    "sale": {
        "customer": ShapeOf("sale", "customer"),
        "note": "string",
    },
    "sale-detail": {
        "customer": ShapeOf("sale-detail", "customer"),
        "note": "string",
        "lines[].cost.costed": "integer",
        "bill": ShapeOf("sale-detail", "bill"),
        "bill.lines[].rule": "string",
        "bill.lines[].unit_price": "integer",
        "bill.payment.still_owed": "integer",
        "bill.balance": "integer",
    },
    "sale-detail-gift": {
        # `sale-detail-gift.json`'s own `customer` is `null`: the sibling fixture
        # `sale-detail` is the one that shows the object non-null.
        "customer": ShapeOf("sale-detail", "customer"),
        "note": "string",
        "lines[].cost.costed": "integer",
        "bill": ShapeOf("sale-detail", "bill"),
        "bill.lines[].rule": "string",
        "bill.lines[].unit_price": "integer",
        "bill.payment.still_owed": "integer",
        "bill.balance": "integer",
    },
    "withdrawal": {
        "note": "string",
    },
}
