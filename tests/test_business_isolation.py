"""Nothing one business records is reachable from another (docs/adr/0004).

Business A records one of everything through the API. Business B then calls every
gated route: a route that names a record must answer 404 for A's records, and a route
that lists must show none of them. Afterwards A still reads every record unchanged.

A capability adds two things here in the diff that adds its routes:

- a seeder in `SEEDERS`: records its things in the business of the client it gets, with
  `MARKER` in every name, and returns the path parameters that name them;
- in `BODIES`, a valid body for each of its gated routes that takes one.

A route with a path parameter no seeder names, or with a body and no example, fails.

Every list route (`LISTS`) is also read right after seeding, before B's call: a route
with no `GET` by id (expense categories have none) could otherwise still be reached and
rewritten through a by-id route that answers 404 only after it wrote. Comparing A's
list bodies before and after B's call catches that even when no single-record read
would.
"""

from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import delete as sa_delete
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.accounts.application import manage_business
from app.accounts.application.ports import Accounts
from app.expenses.adapters.sql_expense_categories import SqlExpenseCategories
from app.expenses.adapters.tables import ExpenseCategoryRow
from app.expenses.application import manage_categories
from app.expenses.domain.category import CategoryNotFound
from app.main import create_app
from app.payments.adapters import router as payments_router_module
from app.payments.adapters.sql_payments import SqlPayments
from app.payments.adapters.tables import PaymentRow
from app.results.domain.periods import periods as compute_periods
from app.shared.calendar import Month
from app.shared.transaction import Transaction
from tests.conftest import SETTINGS, TEST_HASHER, TODAY, MovableClock, open_business, signed_in
from tests.fakes.telegram import FakeTelegram

MARKER = "zz-isolation-marker"


def seed_varieties(client: TestClient) -> dict[str, int]:
    variety = client.post("/varieties", json={"name": f"{MARKER} variety"}).json()
    entry = client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    ).json()
    return {"variety_id": variety["id"], "entry_id": entry["id"]}


def seed_customers(client: TestClient) -> dict[str, int]:
    customer = client.post(
        "/customers", json={"name": f"{MARKER} customer", "phone": "11 2345-6789"}
    ).json()
    # A customer with no phone (ADR-0021) is isolated the same way; it carries no id
    # a gated route needs, so it is checked only through the list comparison.
    client.post("/customers", json={"name": f"{MARKER} no-phone customer"})
    return {"customer_id": customer["id"]}


def seed_expenses(client: TestClient) -> dict[str, int]:
    category = client.post("/expense-categories", json={"name": f"{MARKER} category"})
    assert category.status_code == 201, category.text
    category_id = category.json()["id"]
    expense = client.post(
        "/expenses",
        json={
            "spent_on": "2026-10-02",
            "category_id": category_id,
            "amount": 1_000,
            "detail": f"{MARKER} detail",
        },
    )
    assert expense.status_code == 201, expense.text
    return {"category_id": category_id, "expense_id": expense.json()["id"]}


def seed_sales(client: TestClient) -> dict[str, int]:
    variety = client.post("/varieties", json={"name": f"{MARKER} sales variety"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    customer = client.post(
        "/customers", json={"name": f"{MARKER} sales customer", "phone": "11 5555-5555"}
    ).json()
    without_customer = client.post(
        "/sales",
        json={
            "payment": "cash",
            "note": MARKER,
            "lines": [{"variety_id": variety["id"], "grams": "10"}],
        },
    ).json()
    client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": customer["id"],
            "lines": [{"variety_id": variety["id"], "grams": "10"}],
        },
    )
    return {"sale_id": without_customer["id"]}


def seed_catalog(client: TestClient) -> dict[str, int]:
    variety = client.post("/varieties", json={"name": f"{MARKER} catalog variety"}).json()
    price = client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    assert price.status_code == 201, price.text
    entry = client.post(
        "/stock/entries",
        json={
            "variety_id": variety["id"],
            "origin": "opening_stock",
            "grams": "50",
        },
    )
    assert entry.status_code == 201, entry.text
    attributes = client.put(
        f"/catalog/varieties/{variety['id']}",
        json={"shown": True, "emoji": None, "indica_share": None, "aroma": MARKER},
    )
    assert attributes.status_code == 200, attributes.text
    header_footer = client.put("/catalog/header-footer", json={"header": MARKER, "footer": MARKER})
    assert header_footer.status_code == 200, header_footer.text
    return {"variety_id": variety["id"]}


def seed_stock(client: TestClient) -> dict[str, int]:
    variety = client.post("/varieties", json={"name": f"{MARKER} stock variety"}).json()
    entry = client.post(
        "/stock/entries",
        json={
            "variety_id": variety["id"],
            "origin": "opening_stock",
            "grams": "50",
            "note": MARKER,
        },
    )
    assert entry.status_code == 201, entry.text
    withdrawal = client.post(
        "/stock/withdrawals",
        json={
            "reason": "promotion",
            "note": MARKER,
            "lines": [{"variety_id": variety["id"], "grams": "5"}],
        },
    )
    assert withdrawal.status_code == 201, withdrawal.text
    return {"stock_entry_id": entry.json()["id"], "withdrawal_id": withdrawal.json()["id"]}


def seed_pinned_catalog(client: TestClient) -> dict[str, int]:
    tested = client.post(
        "/pinned-catalog/test",
        json={
            "token": f"{MARKER}:bot-token",
            "own_chat": f"{MARKER} own chat",
            "channel_chat": f"{MARKER} channel",
        },
    )
    assert tested.status_code == 200, tested.text
    published = client.post("/pinned-catalog/publish")
    assert published.status_code == 200, published.text
    return {}


def seed_payments(client: TestClient) -> dict[str, int]:
    variety = client.post("/varieties", json={"name": f"{MARKER} payments variety"}).json()
    client.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    customer = client.post(
        "/customers", json={"name": f"{MARKER} payments customer", "phone": "11 4444-3333"}
    ).json()
    customer_id = customer["id"]
    client.post(
        "/sales",
        json={
            "payment": "owing",
            "customer_id": customer_id,
            "lines": [{"variety_id": variety["id"], "grams": "10"}],
        },
    )
    payment = client.post(
        f"/customers/{customer_id}/payments",
        json={"paid_on": "2026-09-20", "amount": 1_000, "method": "cash"},
    )
    assert payment.status_code == 201, payment.text
    return {"customer_id": customer_id, "payment_id": payment.json()["payment"]["id"]}


SEEDERS: list[Callable[[TestClient], dict[str, int]]] = [
    seed_varieties,
    seed_customers,
    seed_expenses,
    seed_sales,
    seed_stock,
    seed_catalog,
    seed_pinned_catalog,
    seed_payments,
]

BODIES: dict[tuple[str, str], dict[str, Any]] = {
    ("POST", "/varieties"): {"name": "Another variety"},
    ("PATCH", "/varieties/{variety_id}"): {"name": "Renamed"},
    ("POST", "/varieties/{variety_id}/prices"): {
        "effective_from": "2026-02-01",
        "list_price": 12_000,
    },
    ("POST", "/customers"): {"name": "Another customer", "phone": "11 9876-5432"},
    ("PATCH", "/customers/{customer_id}"): {"name": "Renamed"},
    ("POST", "/expense-categories"): {"name": "Another category"},
    ("PATCH", "/expense-categories/{category_id}"): {"name": "Renamed category"},
    ("POST", "/expenses"): {
        "spent_on": "2026-10-02",
        "category_id": 1,
        "amount": 500,
        "detail": "another expense",
    },
    ("PUT", "/expenses/{expense_id}"): {
        "spent_on": "2026-10-02",
        "category_id": 1,
        "amount": 999,
        "detail": "edited expense",
    },
    ("PATCH", "/business"): {"name": "Renamed by B"},
    ("POST", "/sales"): {
        "payment": "owing",
        "customer_id": 1,
        "lines": [{"variety_id": 1, "grams": "1"}],
    },
    ("PUT", "/sales/{sale_id}/customer"): {"customer_id": 1},
    ("POST", "/stock/entries"): {
        "variety_id": 1,
        "origin": "opening_stock",
        "grams": "10",
    },
    ("PUT", "/stock/entries/{stock_entry_id}"): {
        "variety_id": 1,
        "origin": "opening_stock",
        "grams": "20",
    },
    ("POST", "/stock/withdrawals"): {
        "reason": "own_use",
        "lines": [{"variety_id": 1, "grams": "1"}],
    },
    ("PUT", "/stock/withdrawals/{withdrawal_id}"): {
        "reason": "own_use",
        "lines": [{"variety_id": 1, "grams": "2"}],
    },
    ("PUT", "/stock/varieties/{variety_id}/threshold"): {"grams": "15"},
    ("PUT", "/catalog/varieties/{variety_id}"): {
        "shown": True,
        "emoji": None,
        "indica_share": 50,
        "aroma": "another aroma",
    },
    ("PUT", "/catalog/header-footer"): {"header": "another header", "footer": "another footer"},
    ("POST", "/pinned-catalog/test"): {
        "token": "999999:another-token",
        "own_chat": "another own chat",
        "channel_chat": None,
    },
    ("POST", "/pinned-catalog/own-chat-lookup"): {"token": None},
    ("POST", "/customers/{customer_id}/payments/preview"): {
        "paid_on": "2026-10-02",
        "amount": 100,
    },
    ("POST", "/customers/{customer_id}/payments"): {
        "paid_on": "2026-10-02",
        "amount": 100,
        "method": "cash",
    },
    ("POST", "/auth/password"): {
        "current_password": "the wrong current password",
        "new_password": "a new password of some length",
    },
}

PUBLIC_PATHS = {"/health", "/auth/login", "/auth/logout"}


def _operations() -> list[tuple[str, str, bool]]:
    document = create_app(
        SETTINGS, hasher=TEST_HASHER, telegram=FakeTelegram(), upkeep_ticker=False
    ).openapi()
    return sorted(
        (method.upper(), path, "requestBody" in operation)
        for path, item in document["paths"].items()
        for method, operation in item.items()
        if path not in PUBLIC_PATHS
        and not path.startswith("/invitations/{token}")
        and not path.startswith("/reset-links/{token}")
    )


OPERATIONS = _operations()
BY_ID = [(m, p) for m, p, _ in OPERATIONS if "{" in p]
LISTS = [p for m, p, _ in OPERATIONS if m == "GET" and "{" not in p]
# A non-GET route with no `{` in its path never names a record: the business it acts on
# can only come from the session. B calling one must never move anything A can see
# through `LISTS` (a `GET /business` with no path parameter is itself one of `LISTS`,
# which is how a route like `PATCH /business` gets checked at all).
SINGLETON_WRITES = [(m, p) for m, p, _ in OPERATIONS if m != "GET" and "{" not in p]


@pytest.fixture
def business_a(app: FastAPI, engine: Engine, clock: MovableClock) -> Iterator[TestClient]:
    with TestClient(app) as client:
        token = open_business(client, engine, clock, f"{MARKER} business", f"{MARKER}@a.com")
        yield signed_in(client, token)


@pytest.fixture
def business_b(
    app: FastAPI, engine: Engine, clock: MovableClock, business_a: TestClient
) -> Iterator[TestClient]:
    with TestClient(app) as client:
        yield signed_in(client, open_business(client, engine, clock, "B", "b@b.com"))


@pytest.fixture
def seeded(business_a: TestClient) -> dict[str, int]:
    names: dict[str, int] = {}
    for seed in SEEDERS:
        names |= seed(business_a)
    return names


def _concrete(path: str, names: dict[str, int]) -> str:
    for name, value in names.items():
        path = path.replace(f"{{{name}}}", str(value))
    assert "{" not in path, f"no seeder names the parameters of {path}"
    return path


def test_every_route_that_takes_a_body_has_an_example() -> None:
    missing = [(m, p) for m, p, has_body in OPERATIONS if has_body and (m, p) not in BODIES]

    assert missing == []


def test_there_are_routes_that_name_a_record() -> None:
    assert len(BY_ID) > 0 and len(LISTS) > 0


def _lists_snapshot(business_a: TestClient) -> dict[str, Any]:
    return {list_path: business_a.get(list_path).json() for list_path in LISTS}


def _assert_a_lists_unchanged(business_a: TestClient, before: dict[str, Any]) -> None:
    for list_path in LISTS:
        assert business_a.get(list_path).json() == before[list_path]


def _assert_another_business_cannot_reach_a_record(
    business_a: TestClient,
    business_b: TestClient,
    seeded: dict[str, int],
    method: str,
    path: str,
) -> None:
    """The sweep's own check, factored out so the proof below can run this exact
    comparison against a deliberately broken route, instead of a copy of it."""
    before = _lists_snapshot(business_a)

    response = business_b.request(
        method, _concrete(path, seeded), json=BODIES.get((method, path))
    )

    assert response.status_code == 404, response.text
    for read in [p for m, p in BY_ID if m == "GET"]:
        assert business_a.get(_concrete(read, seeded)).status_code == 200
    _assert_a_lists_unchanged(business_a, before)


def _assert_a_business_s_write_touches_only_its_own_business(
    business_a: TestClient, business_b: TestClient, method: str, path: str
) -> None:
    """A singleton write (no `{` in its path) can only act on the caller's own
    business, taken from the session (CODING_STANDARDS §9). Whatever B does, every
    list A can see — `GET /business` among them — must read the same before and
    after."""
    before = _lists_snapshot(business_a)

    response = business_b.request(method, path, json=BODIES.get((method, path)))

    assert response.status_code < 500, response.text
    _assert_a_lists_unchanged(business_a, before)


@pytest.mark.parametrize(("method", "path"), BY_ID, ids=[f"{m} {p}" for m, p in BY_ID])
def test_another_business_cannot_reach_a_record(
    business_a: TestClient,
    business_b: TestClient,
    seeded: dict[str, int],
    method: str,
    path: str,
) -> None:
    _assert_another_business_cannot_reach_a_record(business_a, business_b, seeded, method, path)


@pytest.fixture
def seeded_b(business_a: TestClient) -> dict[str, int]:
    """Business A's own variety and customer, named without `MARKER`: the valid
    reference `REFERENCES`-style checks send last, so `MARKER` never has to appear in
    a body that `test_another_business_lists_none_of_its_records` would then see."""
    variety = business_a.post("/varieties", json={"name": "Referenced variety"}).json()
    business_a.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 11_000},
    )
    customer = business_a.post(
        "/customers", json={"name": "Referenced customer", "phone": "11 1111-2222"}
    ).json()
    return {"variety_id": variety["id"], "customer_id": customer["id"]}


def _sale_body(*, variety_id: int, customer_id: int) -> dict[str, Any]:
    return {
        "payment": "owing",
        "customer_id": customer_id,
        "lines": [{"variety_id": variety_id, "grams": "1"}],
    }


def test_a_body_reference_to_a_missing_or_foreign_variety_is_refused_the_same_way(
    business_a: TestClient, business_b: TestClient, seeded_b: dict[str, int]
) -> None:
    foreign_variety = seeded_b["variety_id"]
    customer_id = business_b.post(
        "/customers", json={"name": "B customer", "phone": "11 3333-4444"}
    ).json()["id"]

    missing = business_b.post(
        "/sales", json=_sale_body(variety_id=999_999, customer_id=customer_id)
    )
    other_business = business_b.post(
        "/sales", json=_sale_body(variety_id=foreign_variety, customer_id=customer_id)
    )

    assert missing.status_code == 404, missing.text
    assert other_business.status_code == 404, other_business.text
    assert missing.json() == other_business.json()

    own_variety = business_b.post("/varieties", json={"name": "B variety"}).json()
    business_b.post(
        f"/varieties/{own_variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 5_000},
    )
    valid = business_b.post(
        "/sales", json=_sale_body(variety_id=own_variety["id"], customer_id=customer_id)
    )
    assert valid.status_code == 201, valid.text


def test_a_withdrawal_naming_a_missing_or_foreign_variety_is_refused_the_same_way(
    business_a: TestClient, business_b: TestClient, seeded_b: dict[str, int]
) -> None:
    def body(variety_id: int) -> dict[str, Any]:
        return {"reason": "promotion", "lines": [{"variety_id": variety_id, "grams": "1"}]}

    own_variety = business_b.post("/varieties", json={"name": "B withdrawal variety"}).json()
    own = business_b.post("/stock/withdrawals", json=body(own_variety["id"]))
    assert own.status_code == 201, own.text
    path = f"/stock/withdrawals/{own.json()['id']}"

    sends: list[Callable[[int], Any]] = [
        lambda variety_id: business_b.post("/stock/withdrawals", json=body(variety_id)),
        lambda variety_id: business_b.put(path, json=body(variety_id)),
    ]
    for send in sends:
        missing = send(999_999)
        other_business = send(seeded_b["variety_id"])

        assert missing.status_code == 404, missing.text
        assert other_business.status_code == 404, other_business.text
        assert missing.json() == other_business.json()

    assert business_b.get(f"/stock/varieties/{seeded_b['variety_id']}/movements").status_code == 404


def test_a_body_reference_to_a_missing_or_foreign_customer_is_refused_the_same_way(
    business_a: TestClient, business_b: TestClient, seeded_b: dict[str, int]
) -> None:
    variety = business_b.post("/varieties", json={"name": "B variety 2"}).json()
    business_b.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 5_000},
    )
    foreign_customer = seeded_b["customer_id"]

    missing = business_b.post(
        "/sales", json=_sale_body(variety_id=variety["id"], customer_id=999_999)
    )
    other_business = business_b.post(
        "/sales", json=_sale_body(variety_id=variety["id"], customer_id=foreign_customer)
    )

    assert missing.status_code == 404, missing.text
    assert other_business.status_code == 404, other_business.text
    assert missing.json() == other_business.json()

    own_customer = business_b.post(
        "/customers", json={"name": "B customer 2", "phone": "11 7777-8888"}
    ).json()
    valid = business_b.post(
        "/sales", json=_sale_body(variety_id=variety["id"], customer_id=own_customer["id"])
    )
    assert valid.status_code == 201, valid.text


def test_assigning_a_customer_from_another_business_is_refused_the_same_way_as_missing(
    business_a: TestClient, business_b: TestClient, seeded_b: dict[str, int]
) -> None:
    variety = business_b.post("/varieties", json={"name": "B variety 3"}).json()
    business_b.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 5_000},
    )
    sale_id = business_b.post(
        "/sales",
        json={"payment": "cash", "lines": [{"variety_id": variety["id"], "grams": "1"}]},
    ).json()["id"]
    foreign_customer = seeded_b["customer_id"]

    missing = business_b.put(f"/sales/{sale_id}/customer", json={"customer_id": 999_999})
    other_business = business_b.put(
        f"/sales/{sale_id}/customer", json={"customer_id": foreign_customer}
    )

    assert missing.status_code == 404, missing.text
    assert other_business.status_code == 404, other_business.text
    assert missing.json() == other_business.json()

    own_customer = business_b.post(
        "/customers", json={"name": "B customer 3", "phone": "11 6666-5555"}
    ).json()
    valid = business_b.put(f"/sales/{sale_id}/customer", json={"customer_id": own_customer["id"]})
    assert valid.status_code == 200, valid.text


@pytest.mark.parametrize("path", LISTS)
def test_another_business_lists_none_of_its_records(
    business_b: TestClient, seeded: dict[str, int], path: str
) -> None:
    response = business_b.get(path)

    assert response.status_code == 200
    assert MARKER not in response.text


def test_business_a_sees_its_own_catalog_seed(
    business_a: TestClient, seeded: dict[str, int]
) -> None:
    """The negative check above (`MARKER not in response.text`) only proves something
    if the seed actually qualifies for business A's own catalog: a seed that silently
    failed to show, price or stock its variety would pass that check too, over empty
    data. This is the positive half: business A must see `MARKER` in its own `text`,
    `header` and a variety name."""
    catalog = business_a.get("/catalog").json()

    assert catalog["header"] == MARKER
    assert catalog["text"] is not None and MARKER in catalog["text"]
    assert any(variety["name"] == f"{MARKER} catalog variety" for variety in catalog["varieties"])
    assert any(
        variety["name"] == f"{MARKER} catalog variety" and variety["state"] == "in"
        for variety in catalog["varieties"]
    )


def test_another_business_reads_the_pinned_catalog_as_its_own_empty_state(
    business_a: TestClient, business_b: TestClient, seeded: dict[str, int]
) -> None:
    """A's saved token and channel never reach B: B's `publish_blocked_by` is the
    empty state's own value, while A's is `None`."""
    own = business_a.get("/pinned-catalog").json()
    other = business_b.get("/pinned-catalog")

    assert own["publish_blocked_by"] is None
    assert MARKER not in other.text
    assert other.json()["publish_blocked_by"] == "not_tested"


def test_another_business_cannot_look_up_with_the_saved_token_of_a_business(
    business_a: TestClient,
    business_b: TestClient,
    seeded: dict[str, int],
    telegram: FakeTelegram,
) -> None:
    """The lookup with no typed token takes the saved one of the caller's own business
    only: A has a saved token and a chat that wrote to its bot, and B, with none, is
    told so and never reaches A's chat or token."""
    telegram.set_private_chats(f"{MARKER}:bot-token", ["424242424"])
    own = business_a.post("/pinned-catalog/own-chat-lookup", json={"token": None})

    other = business_b.post("/pinned-catalog/own-chat-lookup", json={"token": None})

    assert own.status_code == 200, own.text
    assert own.json() == {"own_chat": "424242424"}
    assert other.status_code == 422
    assert other.json()["code"] == "pinned_catalog.token_required"
    assert "424242424" not in other.text
    assert MARKER not in other.text


def test_the_list_check_catches_a_write_that_a_bare_404_check_would_miss(
    business_a: TestClient,
    business_b: TestClient,
    seeded: dict[str, int],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Proven negative (CODING_STANDARDS §5): before trusting the before/after list
    comparison in `_assert_another_business_cannot_reach_a_record`, it must be seen to
    fail on the shape of bug it exists for — a by-id route that writes to another
    business's record with no business filter, and then answers 404 regardless of what
    it found (Tech Lead, round-3 Q4). This calls the sweep's own check, not a copy of
    it: deleting the list-comparison lines from that helper would turn this test red,
    because the broken route below still answers 404, so the earlier assertions in the
    helper would no longer catch it."""

    def unfiltered_row(self: SqlExpenseCategories, category_id: int) -> ExpenseCategoryRow | None:
        return self._session.get(ExpenseCategoryRow, category_id)

    def removes_with_no_filter_then_always_answers_not_found(
        categories: SqlExpenseCategories, transaction: Transaction, category_id: int
    ) -> None:
        categories.remove(category_id)
        transaction.commit()
        raise CategoryNotFound(category_id)

    monkeypatch.setattr(SqlExpenseCategories, "_row", unfiltered_row)
    monkeypatch.setattr(
        manage_categories,
        "remove_category",
        removes_with_no_filter_then_always_answers_not_found,
    )

    with pytest.raises(AssertionError):
        _assert_another_business_cannot_reach_a_record(
            business_a,
            business_b,
            seeded,
            "DELETE",
            "/expense-categories/{category_id}",
        )


@pytest.mark.parametrize(
    ("method", "path"), SINGLETON_WRITES, ids=[f"{m} {p}" for m, p in SINGLETON_WRITES]
)
def test_a_singleton_write_from_b_never_touches_a(
    business_a: TestClient,
    business_b: TestClient,
    seeded: dict[str, int],
    method: str,
    path: str,
) -> None:
    _assert_a_business_s_write_touches_only_its_own_business(business_a, business_b, method, path)


def test_the_singleton_check_catches_a_write_that_always_touches_business_1(
    business_a: TestClient,
    business_b: TestClient,
    seeded: dict[str, int],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Proven negative (CODING_STANDARDS §5), modelled on the proof above for
    `_assert_another_business_cannot_reach_a_record`: a singleton route (no `{` in its
    path, so a record id cannot anchor the check) that ignores the session and always
    renames business 1 — `business_a`'s, since it opens first — must fail the
    singleton check when B calls it."""

    original_rename_business = manage_business.rename_business

    def renames_business_one_no_matter_who_asks(
        accounts: Accounts, transaction: Transaction, business_id: int, raw_name: str
    ) -> manage_business.BusinessProfile:
        return original_rename_business(accounts, transaction, 1, raw_name)

    monkeypatch.setattr(
        manage_business, "rename_business", renames_business_one_no_matter_who_asks
    )

    with pytest.raises(AssertionError):
        _assert_a_business_s_write_touches_only_its_own_business(
            business_a, business_b, "PATCH", "/business"
        )


def test_another_business_reads_debtors_as_zero_while_a_has_debt(
    business_a: TestClient, business_b: TestClient, seeded: dict[str, int]
) -> None:
    a_debtors = business_a.get("/payments/debtors").json()
    assert a_debtors["total_owed"] > 0
    assert a_debtors["sales_owing_count"] > 0
    assert a_debtors["debtors"] != []

    b_debtors = business_b.get("/payments/debtors").json()
    assert b_debtors == {"total_owed": 0, "sales_owing_count": 0, "debtors": []}


def test_another_business_reads_the_panel_as_zero_while_a_has_every_figure(
    business_a: TestClient, business_b: TestClient, clock: MovableClock
) -> None:
    """The panel route joins the isolation sweep (plan invariant, subtask brief): A
    seeds a sale with a gift line, a sale left owing, a later payment, an expense, a
    purchase and a negative adjustment, all dated today; B's panel must equal a
    freshly opened business's. The adjustment proves the combined stock read stays
    filtered by business: without the `business_id` filter it would draw from A's
    lot and B would show a shortfall too."""
    today = clock().date().isoformat()
    variety = business_a.post("/varieties", json={"name": f"{MARKER} panel variety"}).json()
    business_a.post(
        f"/varieties/{variety['id']}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    customer = business_a.post(
        "/customers", json={"name": f"{MARKER} panel customer", "phone": "11 7777-8888"}
    ).json()
    gifted = business_a.post(
        "/sales",
        json={
            "date": today,
            "payment": "cash",
            "lines": [{"variety_id": variety["id"], "grams": "3", "gift": True}],
        },
    )
    assert gifted.status_code == 201, gifted.text
    owing = business_a.post(
        "/sales",
        json={
            "date": today,
            "customer_id": customer["id"],
            "payment": "owing",
            "lines": [{"variety_id": variety["id"], "grams": "2"}],
        },
    )
    assert owing.status_code == 201, owing.text
    payment = business_a.post(
        f"/customers/{customer['id']}/payments",
        json={"paid_on": today, "amount": 1_000, "method": "cash"},
    )
    assert payment.status_code == 201, payment.text
    category = business_a.post(
        "/expense-categories", json={"name": f"{MARKER} panel category"}
    ).json()
    expense = business_a.post(
        "/expenses",
        json={
            "spent_on": today,
            "category_id": category["id"],
            "amount": 500,
            "detail": f"{MARKER} panel expense",
        },
    )
    assert expense.status_code == 201, expense.text
    purchase = business_a.post(
        "/stock/entries",
        json={
            "variety_id": variety["id"],
            "origin": "purchase",
            "grams": "50",
            "total_cost": 2_000,
            "date": today,
        },
    )
    assert purchase.status_code == 201, purchase.text
    adjustment = business_a.post(
        "/stock/entries",
        json={
            "variety_id": variety["id"],
            "origin": "adjustment",
            "grams": "-5",
            "date": today,
        },
    )
    assert adjustment.status_code == 201, adjustment.text

    a_panel = business_a.get("/panel").json()
    today_figures = a_panel["periods"]["today"]
    assert today_figures["sales"] > 0
    assert today_figures["grams_gifted"] > 0
    assert today_figures["expenses"] > 0
    assert today_figures["purchases"] > 0
    assert today_figures["shortfall"] is not None
    assert today_figures["shortfall"]["amount"] > 0
    assert a_panel["debts"]["total_owed"] > 0
    assert a_panel["stock"] != []

    b_panel = business_b.get("/panel").json()

    def _fresh(start: str, end: str) -> dict[str, Any]:
        return {
            "start": start,
            "end": end,
            "sales": 0,
            "sales_count": 0,
            "average_sale": None,
            "grams_sold": 0,
            "grams_gifted": 0,
            "cost_of_goods": 0,
            "pending_cost": False,
            "shortfall": None,
            "expenses": 0,
            "purchases": 0,
            "profit": 0,
            "profit_pending": False,
            "cash": 0,
        }

    bounds = compute_periods(TODAY)
    assert b_panel["periods"]["today"] == _fresh(today, today)
    assert b_panel["periods"]["week"] == _fresh(
        bounds.week.start.isoformat(), bounds.week.end.isoformat()
    )
    assert b_panel["periods"]["month"] == _fresh(
        bounds.month.start.isoformat(), bounds.month.end.isoformat()
    )
    assert b_panel["debts"] == {
        "total_owed": 0,
        "sales_owing_count": 0,
        "oldest": None,
        "teaser": [],
    }
    assert b_panel["stock"] == []


def test_another_business_gets_404_deleting_an_on_the_spot_payment(
    business_a: TestClient, business_b: TestClient, engine: Engine, seeded: dict[str, int]
) -> None:
    """`seed_sales`'s own cash sale (`seeded["sale_id"]`) carries an on-the-spot
    payment: its id is read straight from the test engine (CODING_STANDARDS §5), the
    way a repository-level test already does for `business_id`), since no route
    answers a payment's own id for an on-the-spot sale."""
    with Session(engine) as session:
        on_the_spot = session.scalar(
            select(PaymentRow).where(PaymentRow.sale_id == seeded["sale_id"])
        )
    assert on_the_spot is not None

    response = business_b.delete(f"/payments/{on_the_spot.id}")

    assert response.status_code == 404, response.text
    assert business_a.get(f"/sales/{seeded['sale_id']}").status_code == 200


def test_the_delete_check_catches_a_payment_delete_that_ignores_business(
    business_a: TestClient,
    business_b: TestClient,
    seeded: dict[str, int],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Proven negative (CODING_STANDARDS §5), modelled on the expense-category proof
    above: a delete that finds a payment by id alone, ignoring the business, and
    always succeeds must make the sweep's own check fail when B deletes A's id —
    otherwise `SqlPayments.get` filtering on `business_id` would never be proven to
    matter."""

    def deletes_by_id_alone_and_always_succeeds(
        payments: SqlPayments, transaction: Transaction, payment_id: int
    ) -> None:
        payments._session.execute(sa_delete(PaymentRow).where(PaymentRow.id == payment_id))
        transaction.commit()

    monkeypatch.setattr(
        payments_router_module,
        "delete_payment_use_case",
        deletes_by_id_alone_and_always_succeeds,
    )

    with pytest.raises(AssertionError):
        _assert_another_business_cannot_reach_a_record(
            business_a, business_b, seeded, "DELETE", "/payments/{payment_id}"
        )


def test_another_business_s_analysis_is_exactly_the_empty_shape(
    business_a: TestClient, business_b: TestClient
) -> None:
    """`GET /analysis` has no path parameter, so it is only ever exercised as one of
    `LISTS` by the sweep above. This is the plan's own extra proof (ADR-0020,
    CODING_STANDARDS section 9): B, with no records of its own, must answer exactly
    the fixed empty shape — every field of it, not a sample — while A's answer
    carries real sales and the `MARKER` variety. Nothing of A's ever reaches B."""
    seed_sales(business_a)

    a_analysis = business_a.get("/analysis").json()
    b_analysis = business_b.get("/analysis").json()

    assert a_analysis["first_record"] is not None
    assert a_analysis["month"]["sales"] > 0
    assert any(MARKER in variety["name"] for variety in a_analysis["month"]["varieties"])

    current_month = str(Month.containing(TODAY))
    assert b_analysis == {
        "today": TODAY.isoformat(),
        "first_record": None,
        "month": {
            "month": current_month,
            "previous": None,
            "next": None,
            "sales": 0,
            "sales_without_shipping": 0,
            "grams_sold": 0.0,
            "grams_gifted": 0.0,
            "average_margin": {"amount": 0, "percent": None, "pending_grams": 0.0},
            "shortfall": None,
            "varieties": [],
        },
        "weeks": [],
        "months": [],
        "weekdays": [
            {"weekday": weekday, "sales": 0, "count": 0, "best": False}
            for weekday in range(1, 8)
        ],
        "since_first_record": None,
        "month_expenses": {"categories": [], "total": 0, "purchases": 0},
        "since_first_record_expenses": {"categories": [], "total": 0, "purchases": 0},
    }
