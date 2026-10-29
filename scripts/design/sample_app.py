"""The sample app: the built app on its own throwaway database, seeded with a business
like the design's own ("La Huerta"), for the agentic system's UX walkthrough and
screen comparisons (agentic-system ADR-0040).

    scripts/design/sample-app.sh [--port N] [--dir DIR]

Builds nothing itself (the shell wrapper builds `web/` first), starts the server, seeds
it through the API alone, prints the address and the user, and serves until stopped.
`sample.json` in its directory is written only once the seeding is done: a caller that
runs this in the background waits for that file, then reads the address and the ids.

    {"url": ..., "email": ..., "password": ..., "ids": {...},
     "accounts": {"<name>": {"email": ..., "password": ...}},
     "account_kinds": {"<name>": "open" | "ended" | "pre_onboarding" | "imported" | "onboarding"}}

The top-level `email`, `password` and `ids` are La Huerta's. `accounts` is always present
(`{}` when both account tuples are empty): one extra business per name, seeded like La
Huerta. An `open` account (`ONBOARDING_ACCOUNTS`) is still in Onboarding, so a screen that
ends the Onboarding ("Listo") can be reached once per business in one run. An `ended`
account (`ENDED_ONBOARDING_ACCOUNTS`) has its Onboarding ended over HTTP, through
`skip-rest`, after it is seeded, for the screens whose frames do not draw the Onboarding's
notice. A `pre_onboarding` account (`PRE_ONBOARDING_ACCOUNTS`) is a business with no
Onboarding row, which shows the first-run checklist (`checklist` has one priced variety,
`primera_vez` has nothing priced); an `imported` account (`IMPORTED_ACCOUNTS`) is one the real
`scripts/import-spreadsheet.sh` loaded, which shows the after-import notice; an `onboarding`
account (`ONBOARDING_FRAME_ACCOUNTS`) is a business whose Onboarding is open at a fixed point
(`en_curso`: one step done; `completo`: every step answered, not yet ended), seeded over HTTP
alone and never ended. All three kinds are read-only for the screens that name them, and each
checks its own `/first-run` answer (the `onboarding` ones also `/onboarding-progress`) and stops
the sample if it differs. `account_kinds` has exactly the keys of `accounts`, and its values are
the kinds of `ACCOUNT_KINDS`, the same list as `account_kinds` in `screens.json`. An account
carries no `ids`: the ids are La Huerta's.
The data goes in over HTTP, never through the front: the front is what this app exists
to compare, so a redesigned screen must never break the seeding. Never touches the
human's own `apostrophe.db` or `.env`.
"""

from __future__ import annotations

import argparse
import http.cookiejar
import importlib.util
import json
import os
import re
import secrets
import signal
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from contextlib import closing
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path
from types import ModuleType
from typing import Any, Protocol

REPO = Path(__file__).resolve().parents[2]
EMAIL = "vos@lahuerta.com"
PASSWORD = "muestra-de-la-huerta"
BUSINESS = "La Huerta"
# One extra business per "Listo" row of `screens.json`: reaching "Listo" ends a business's
# Onboarding for good (docs/adr/0036), so each capture of it needs a business of its own.
ONBOARDING_ACCOUNTS = (
    "listo",
    "listo_compu",
    "listo_oscuro",
    "listo_compu_oscuro",
    "listo_texto130",
)
# One extra business per capture that must NOT show the Onboarding's notice: its Onboarding
# is ended, always through `POST /onboarding-progress/skip-rest` and never by writing a row.
# A screen reads one of these only when its frames do not draw the notice (`Inicio*`).
ENDED_ONBOARDING_ACCOUNTS = ("inicio",)
# The business of the first-run checklist (GH-274): it has no Onboarding row, as a business
# that existed before the Onboarding (docs/adr/0036, docs/adr/0046). Read-only for every
# screen that names it, and no "Listo" row ever does.
# `checklist` has one priced variety; `primera_vez` (GH-303) has nothing priced.
PRE_ONBOARDING_ACCOUNTS = ("checklist", "primera_vez")
# The business the real spreadsheet import loaded (GH-274): `first_run.imported_at` is
# stamped by `scripts/import-spreadsheet.sh` and by nothing else. Read-only as well.
IMPORTED_ACCOUNTS = ("importada",)
# The two frames of the Onboarding the drawings hold (GH-303): `en_curso` has one step done,
# `completo` has every step answered and its Onboarding not yet ended. Both come over HTTP
# alone, never through `advance` or `skip-rest`, and are read-only like the kinds above.
ONBOARDING_FRAME_ACCOUNTS = ("en_curso", "completo")
# Every kind the sample can write and the account names of each: `account_kinds` of
# `sample.json` is built from it, and `account_kinds` of `screens.json` must be the same set.
ACCOUNT_KINDS = {
    "open": ONBOARDING_ACCOUNTS,
    "ended": ENDED_ONBOARDING_ACCOUNTS,
    "pre_onboarding": PRE_ONBOARDING_ACCOUNTS,
    "imported": IMPORTED_ACCOUNTS,
    "onboarding": ONBOARDING_FRAME_ACCOUNTS,
}


class Api(Protocol):
    def call(self, method: str, path: str, body: object | None = None) -> Any: ...


@dataclass(frozen=True)
class Line:
    variety: int
    quantity: str
    gift: bool = False


@dataclass(frozen=True)
class Account:
    """The sign-in of one extra business, written to `sample.json`'s `accounts`."""

    email: str
    password: str


@dataclass(frozen=True)
class Sample:
    """The ids a comparison needs to reach a screen showing one record."""

    debtor: int
    owing_sale: int
    vip: int
    sold_out: int
    low: int
    no_entries: int
    withdrawal: int
    entry: int
    archived: int


def seed(api: Api, today: date) -> Sample:
    """Every state the design's screens show: sales today and earlier, a gift, a VIP,
    a sale without a customer, two customers owing, a later payment, a variety sold
    out, one under its threshold, one never entered, expenses in two categories and a
    purchase this week, stock withdrawals of each reason (one past every lot of its
    variety, so it carries pending cost). Week-dependent figures sit on `today`, so the
    week is never empty whatever weekday it runs on."""

    def ago(days: int) -> str:
        return (today - timedelta(days=days)).isoformat()

    def this_month(days: int) -> str:
        # Gastos shows one month: an expense must never fall into the previous one.
        return (today - timedelta(days=min(days, today.day - 1))).isoformat()

    # A new business starts with both pricing rules off (docs/adr/0034); the design shows
    # a bulk price and a VIP customer, so the sample switches both on before any price
    # entry (an entry stores nothing for a rule that is off) and gives each bulk-priced
    # variety VIP price = bulk price, as the migration did for existing businesses.
    api.call("PUT", "/pricing-settings", {"is_bulk_pricing": True, "is_vip_customers": True})

    def variety(name: str, list_price: int, bulk: int | None = None) -> int:
        made: int = api.call("POST", "/api/products", {"name": name})["id"]
        api.call(
            "POST",
            f"/api/products/{made}/prices",
            {
                "effective_from": ago(40),
                "list_price": list_price,
                "bulk_price": bulk,
                "bulk_minimum": 5 if bulk is not None else None,
                "vip_price": bulk,
            },
        )
        return made

    gold = variety("24K Gold", 12_000, 10_000)
    cookies = variety("Golden Cookies", 14_000, 12_000)
    jack = variety("Sir Jack", 11_000)
    mango = variety("Mango Bomb", 15_000)

    def entry(when: str, variety_id: int, origin: str, quantity: str, cost: int | None) -> int:
        made: int = api.call(
            "POST",
            "/stock/entries",
            {
                "date": when,
                "variety_id": variety_id,
                "origin": origin,
                "quantity": quantity,
                "total_cost": cost,
                "note": None,
            },
        )["id"]
        return made

    first_entry = entry(ago(40), gold, "purchase", "120", 600_000)
    entry(ago(40), cookies, "purchase", "40", 280_000)
    entry(ago(40), jack, "harvest", "10", None)
    entry(ago(0), gold, "purchase", "30", 150_000)
    # A negative adjustment (GH-70): 24K Gold goes to 133 g, its 2 g costed at
    # $ 10.000 from the same $ 5.000/g lots above — Inicio's Faltante de stock row
    # and Ganancia now carry this, and Stock shows the Ajuste entry.
    entry(ago(0), gold, "adjustment", "-2", None)
    api.call("PUT", f"/stock/varieties/{cookies}/threshold", {"quantity": "20"})

    def customer(name: str, phone: str, vip: bool = False) -> int:
        made: int = api.call("POST", "/customers", {"name": name, "phone": phone, "vip": vip})["id"]
        return made

    nico = customer("Nico Parra", "11 5555-0101")
    tincho = customer("Tincho Aguirre", "11 5555-0102")
    mica = customer("Mica Solano", "11 6033-7725", vip=True)
    lu = customer("Lu Fernández", "11 5555-0104")

    def sale(
        when: str,
        customer_id: int | None,
        payment: str,
        lines: list[Line],
        shipping: int = 0,
        note: str | None = None,
    ) -> int:
        made: int = api.call(
            "POST",
            "/sales",
            {
                "date": when,
                "customer_id": customer_id,
                "shipping_charged": shipping,
                "note": note,
                "payment": payment,
                "lines": [
                    {
                        "variety_id": line.variety,
                        "quantity": line.quantity,
                        "gift": line.gift,
                        "special_price": None,
                    }
                    for line in lines
                ],
            },
        )["id"]
        return made

    owing = sale(ago(19), nico, "owing", [Line(gold, "2")], shipping=1_000)
    sale(ago(19), nico, "cash", [Line(cookies, "1")])
    sale(ago(12), tincho, "cash", [Line(cookies, "8")])
    sale(ago(10), lu, "transfer", [Line(jack, "3")])
    sale(ago(5), None, "cash", [Line(jack, "5")], note="Pasó por el local")
    sale(ago(3), None, "cash", [Line(cookies, "9")])
    sale(ago(1), tincho, "owing", [Line(jack, "1")], shipping=1_000)
    sale(
        ago(0),
        mica,
        "transfer",
        [Line(gold, "10"), Line(cookies, "2"), Line(jack, "1", gift=True)],
        shipping=6_000,
    )
    sale(ago(0), None, "cash", [Line(gold, "3")])
    sale(ago(0), lu, "cash", [Line(cookies, "2")])

    def withdrawal(
        when: str, reason: str, lines: list[tuple[int, str]], note: str | None = None
    ) -> int:
        made: int = api.call(
            "POST",
            "/stock/withdrawals",
            {
                "date": when,
                "reason": reason,
                "note": note,
                "lines": [{"variety_id": v, "quantity": quantity} for v, quantity in lines],
            },
        )["id"]
        return made

    # Stock withdrawals (GH-83): Golden Cookies, the variety the comparisons open, gets a
    # promotion and an own use today, costed from its lot at $ 7.000/g, and an older
    # promotion so its "Ver todas" has more than three rows; it stays under its threshold.
    # Sir Jack is already sold out, so the own-use gram taken from it is beyond every lot:
    # pending cost. Today is in this week and this month whatever weekday it runs on.
    promotion = withdrawal(ago(0), "promotion", [(cookies, "3")], note="Fiesta de Caro")
    withdrawal(ago(2), "promotion", [(cookies, "2")])
    withdrawal(ago(0), "own_use", [(cookies, "2"), (jack, "1")])

    api.call(
        "POST",
        f"/customers/{nico}/payments",
        {"paid_on": ago(2), "amount": 5_000, "method": "cash"},
    )

    def category(name: str) -> int:
        # A new business starts with its default categories; only a missing one is made.
        for existing in api.call("GET", "/expense-categories"):
            if existing["name"].casefold() == name.casefold():
                found: int = existing["id"]
                return found
        made: int = api.call("POST", "/expense-categories", {"name": name})["id"]
        return made

    packaging = category("Packaging")
    shipping_category = category("Envíos")
    api.call(
        "POST",
        "/expenses",
        {"spent_on": ago(0), "category_id": packaging, "amount": 8_000, "detail": "Bolsitas zip"},
    )
    api.call(
        "POST",
        "/expenses",
        {
            "spent_on": this_month(2),
            "category_id": shipping_category,
            "amount": 4_500,
            "detail": "Cadete a Caballito",
        },
    )

    for variety_id, emoji, indica, aroma in (
        (gold, "🌟", 60, "Cítrico y dulce"),
        (cookies, "🍪", 70, "Galletita y vainilla"),
        (jack, "🌲", 30, "Pino y limón"),
    ):
        api.call(
            "PUT",
            f"/catalog/varieties/{variety_id}",
            {"shown": True, "emoji": emoji, "indica_share": indica, "aroma": aroma},
        )

    # The one archived variety (GH-131), last: its catalog attributes are read-only once it
    # is archived. Hidden, with a price, a threshold and a single opening-stock entry with
    # no cost on the day the sample's history starts, so no period figure moves.
    archived = variety("Blue Dream", 13_000)
    api.call(
        "PUT",
        f"/catalog/varieties/{archived}",
        {"shown": False, "emoji": "🫐", "indica_share": 40, "aroma": "Frutos rojos"},
    )
    api.call("PUT", f"/stock/varieties/{archived}/threshold", {"quantity": "15"})
    entry(ago(40), archived, "opening_stock", "25", None)
    api.call("POST", f"/api/products/{archived}/archive")

    return Sample(
        debtor=nico,
        owing_sale=owing,
        vip=mica,
        sold_out=jack,
        low=cookies,
        no_entries=mango,
        withdrawal=promotion,
        entry=first_entry,
        archived=archived,
    )


WORST = 999_999_999
# One word with no break and no trailing space: a name cut at 60 never loses a character.
LONG_NAME = "Larguísimo" * 6


def stretch(api: Api, today: date) -> None:
    """The phone check's worst case on top of `seed` (GH-80): a 60-character business,
    customer, variety and category, a sale of $ 999.999.999, and the month's Ganancia and
    Caja both reading -$ 999.999.999. Only `scripts/design/mobile_seed.py` calls it:
    `main` never does, so the design comparisons keep their own data."""

    def named(prefix: str) -> str:
        return (prefix + " " + LONG_NAME)[:60]

    assert len(named("Cliente")) == 60 == len(LONG_NAME)
    api.call("PATCH", "/business", {"name": named("Negocio")})
    category: int = api.call("POST", "/expense-categories", {"name": named("Categoría")})["id"]
    variety: int = api.call("POST", "/api/products", {"name": named("Variedad")})["id"]
    api.call(
        "POST",
        f"/api/products/{variety}/prices",
        {
            "effective_from": (today - timedelta(days=40)).isoformat(),
            "list_price": WORST,
            "bulk_price": None,
            "bulk_minimum": None,
        },
    )
    when = today.isoformat()
    api.call(
        "POST",
        "/stock/entries",
        {
            "date": when,
            "variety_id": variety,
            "origin": "purchase",
            "quantity": "1",
            "total_cost": 1,
            "note": None,
        },
    )
    customer: int = api.call(
        "POST",
        "/customers",
        {"name": named("Cliente"), "phone": "11 5555-0199", "channel": None, "vip": False},
    )["id"]
    api.call(
        "POST",
        "/sales",
        {
            "date": when,
            "customer_id": customer,
            "shipping_charged": 0,
            "note": None,
            "payment": "cash",
            "lines": [
                {"variety_id": variety, "quantity": "1", "gift": False, "special_price": None}
            ],
        },
    )

    def month() -> dict[str, int]:
        found: dict[str, int] = api.call("GET", "/panel")["periods"]["month"]
        return found

    before = month()
    # Profit = sales - cost - expenses; cash = collected - expenses - purchases. One
    # expense lands the profit, one purchase of a variety nobody sells lands the cash.
    expense = before["profit"] + WORST
    api.call(
        "POST",
        "/expenses",
        {"spent_on": when, "category_id": category, "amount": expense, "detail": "Todo el negocio"},
    )
    purchase = before["cash"] - before["profit"]
    if purchase > 0:
        spare: int = api.call("POST", "/api/products", {"name": "Variedad sin ventas"})["id"]
        api.call(
            "POST",
            "/stock/entries",
            {
                "date": when,
                "variety_id": spare,
                "origin": "purchase",
                "quantity": "1",
                "total_cost": purchase,
                "note": None,
            },
        )


class HttpApi:
    """The seed's `Api` over the running server, keeping its session cookie."""

    def __init__(self, base: str) -> None:
        self.base = base
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method: str, path: str, body: object | None = None) -> Any:
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(
            self.base + path, data=data, method=method, headers={"Content-Type": "application/json"}
        )
        try:
            with self.opener.open(request) as response:
                raw = response.read()
        except urllib.error.HTTPError as refused:
            detail = refused.read().decode(errors="replace")
            raise SystemExit(f"sample-app: {method} {path} -> {refused.code} {detail}") from refused
        return json.loads(raw) if raw else None


def token_from(url: str) -> str:
    """An invitation's token: the last segment of the link the app prints or answers."""
    return url.rstrip("/").rsplit("/", 1)[-1]


def operator_link(env: dict[str, str], *command: str) -> str:
    """The token of a link minted by the operator's own command
    (`app.accounts.adapters.cli`), run the way `scripts/invite-business.sh` and
    `scripts/reset-password.sh` run it: never a row inserted by hand."""
    first_line = subprocess.run(
        ["uv", "run", "--no-project", "python", "-m", "app.accounts.adapters.cli", *command],
        cwd=REPO,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.split("\n")[0]
    return token_from(first_line)


def new_business_token(env: dict[str, str]) -> str:
    """A new-business invitation, issued the way `scripts/invite-business.sh` does."""
    return operator_link(env, "invite-business")


def reset_token(env: dict[str, str], email: str) -> str:
    """A reset link for `email`, issued the way `scripts/reset-password.sh` does."""
    return operator_link(env, "reset-password", email)


def onboarding_accounts(env: dict[str, str], base: str, today: date) -> dict[str, Account]:
    """One extra business per `ONBOARDING_ACCOUNTS` name, each opened the way a new user
    opens one (the operator's invitation, then accepting it over HTTP), seeded exactly like
    La Huerta, and left with its Onboarding open. Each signs in on its own `HttpApi`, so
    its session cookie never mixes with another business's."""
    accounts: dict[str, Account] = {}
    for name in ONBOARDING_ACCOUNTS:
        account = Account(email=name.replace("_", "-") + "@lahuerta.com", password=PASSWORD)
        api = HttpApi(base)
        api.call(
            "POST",
            f"/invitations/{new_business_token(env)}/accept",
            {"email": account.email, "password": account.password, "business_name": BUSINESS},
        )
        api.call("POST", "/auth/login", {"email": account.email, "password": account.password})
        seed(api, today)
        accounts[name] = account
    return accounts


def business_id_of(db_path: Path, email: str) -> int:
    """The id of the business `email` belongs to, read from the sample's own database.
    Read-only: the connection is opened for reading and never writes."""
    with closing(sqlite3.connect(f"{db_path.as_uri()}?mode=ro", uri=True, timeout=30)) as conn:
        found = conn.execute(
            "SELECT business_id FROM app_user WHERE email = ?", (email,)
        ).fetchone()
    if found is None:
        raise SystemExit("sample-app: an account has no business in the sample's database")
    business: int = found[0]
    return business


def expect_first_run(
    api: Api,
    kind: str,
    *,
    account: str,
    steps: tuple[tuple[str, bool], ...] | None = None,
    import_notice: bool,
) -> None:
    """Checks `GET /first-run` against the answer the account being built exists to
    produce, and stops the sample if it differs. `steps` is the checklist's steps in order,
    each with whether it is done (`None`: no checklist). The message names the account's
    kind (`account`, as in `account_kinds`) and the check that failed, a step by its fixed
    name, and never an answer's data."""
    shown = api.call("GET", "/first-run")
    wanted = () if steps is None else steps
    got = tuple((item.get("step"), item.get("done")) for item in shown.get("checklist", ()))

    def stop(check: str) -> SystemExit:
        return SystemExit(f"sample-app: the {account} account's first run is wrong: {check}")

    if shown.get("kind") != kind:
        raise stop("kind")
    for index, (name, done) in enumerate(wanted):
        if index >= len(got) or got[index] != (name, done):
            raise stop(f"step {name}")
    if len(got) != len(wanted):
        raise stop("steps")
    if shown.get("import_notice") is not import_notice:
        raise stop("import_notice")


def accept_new_business(env: dict[str, str], base: str, name: str) -> tuple[Account, HttpApi]:
    """A new business opened the way a new user opens one: the operator's invitation,
    accepted over HTTP. Not signed in yet."""
    account = Account(email=name.replace("_", "-") + "@lahuerta.com", password=PASSWORD)
    api = HttpApi(base)
    api.call(
        "POST",
        f"/invitations/{new_business_token(env)}/accept",
        {"email": account.email, "password": account.password, "business_name": BUSINESS},
    )
    return account, api


DROP_REFUSED = "sample-app: the pre_onboarding account's Onboarding row was not removed"


def drop_onboarding_row(db_path: Path, business: int) -> None:
    """The one row the design tooling writes directly: deletes `business`'s `onboarding`
    row, so it has the stored shape of a business from before the Onboarding. Stops the
    sample, writing nothing, when the business already has a `first_run` row, and stops it
    when the delete does not remove exactly one row (nothing to remove, or a second row)."""
    with closing(sqlite3.connect(db_path, timeout=30)) as conn:
        conn.execute("PRAGMA foreign_keys=ON")
        stamped = conn.execute(
            "SELECT COUNT(*) FROM first_run WHERE business_id = ?", (business,)
        ).fetchone()[0]
        if stamped != 0:
            raise SystemExit(DROP_REFUSED)
        with conn:
            dropped = conn.execute("DELETE FROM onboarding WHERE business_id = ?", (business,))
    if dropped.rowcount != 1:
        raise SystemExit(DROP_REFUSED)


def price_first_variety(api: Api, today: date) -> None:
    """One variety, priced from `today`: the first step of the Onboarding and of the
    checklist, and nothing else."""
    made: int = api.call("POST", "/api/products", {"name": "Primera variedad"})["id"]
    api.call(
        "POST",
        f"/api/products/{made}/prices",
        {
            "effective_from": today.isoformat(),
            "list_price": 10_000,
            "bulk_price": None,
            "bulk_minimum": None,
        },
    )


def pre_onboarding_account(
    env: dict[str, str], base: str, today: date, db_path: Path, name: str, *, priced: bool
) -> Account:
    """A `PRE_ONBOARDING_ACCOUNTS` business: the first-run checklist.

    It is opened by the operator's invitation like any other, and then its `onboarding` row
    is deleted before anything reads the business. That is the only row the design tooling
    writes directly, and it is the stored shape of a business from before the Onboarding:
    no route can make it, since the Onboarding was never backfilled (docs/adr/0036) and the
    `first_run` row is created by its first stamp (docs/adr/0046). Everything else comes
    over HTTP: with `priced`, one variety priced from `today` (so exactly the first step is
    done), and never a stock entry, a publication or a second user."""
    account, api = accept_new_business(env, base, name)
    business = business_id_of(db_path, account.email)
    drop_onboarding_row(db_path, business)
    api.call("POST", "/auth/login", {"email": account.email, "password": account.password})
    if priced:
        price_first_variety(api, today)
    expect_first_run(
        api,
        "checklist",
        account="pre_onboarding",
        steps=(
            ("priced_variety", priced),
            ("stock_entry", False),
            ("published", False),
            ("second_user", False),
        ),
        import_notice=False,
    )
    return account


OPTIONAL_STEPS = ("header_footer", "bot", "partner", "categories")
STEP_ORDER = ("variety", "stock", *OPTIONAL_STEPS)


def expect_onboarding_progress(
    api: Api,
    *,
    account: str,
    steps: tuple[tuple[str, str], ...],
    count: int,
    resume: str,
    over: bool,
    can_skip_rest: bool,
) -> None:
    """Checks `GET /onboarding-progress` against the answer the account being built exists
    to produce, and stops the sample if it differs. `steps` is every step in order, each with
    its state. The message names the account's kind (`account`, as in `account_kinds`) and the
    check that failed, a step by its slug, and never an answer's data."""
    shown = api.call("GET", "/onboarding-progress")
    got = tuple((item.get("step"), item.get("state")) for item in shown.get("steps", ()))

    def stop(check: str) -> SystemExit:
        return SystemExit(f"sample-app: the {account} account's progress is wrong: {check}")

    if shown.get("offered") is not True:
        raise stop("offered")
    if shown.get("over") is not over:
        raise stop("over")
    if shown.get("resume") != resume:
        raise stop("resume")
    if shown.get("count") != count:
        raise stop("count")
    if shown.get("can_skip_rest") is not can_skip_rest:
        raise stop("can_skip_rest")
    for index, (name, state) in enumerate(steps):
        if index >= len(got) or got[index] != (name, state):
            raise stop(f"step {name}")
    if len(got) != len(steps):
        raise stop("steps")


def onboarding_frame_account(env: dict[str, str], base: str, today: date, name: str) -> Account:
    """An `ONBOARDING_FRAME_ACCOUNTS` business: opened by the operator's invitation, signed
    in, and brought to its frame over HTTP alone (no row is written, and neither `advance` nor
    `skip-rest` is ever called, so its Onboarding stays open).

    `en_curso`: one variety priced from `today`, nothing else. `completo`: that, an opening-
    stock entry, and the four optional steps passed as `skipped` (the notice draws a skipped
    segment filled like a done one: `StepIndicator`). Each checks `/first-run` and
    `/onboarding-progress` before returning."""
    account, api = accept_new_business(env, base, name)
    api.call("POST", "/auth/login", {"email": account.email, "password": account.password})
    price_first_variety(api, today)
    if name == "completo":
        # The passes come before the stock entry: a pass that finds both required facts met
        # and every optional step settled ends the Onboarding (`use_cases._settle`), and this
        # account must stay open.
        for step in OPTIONAL_STEPS:
            api.call("POST", "/onboarding-progress/passes", {"step": step, "as": "skipped"})
        (variety,) = api.call("GET", "/api/products")
        api.call(
            "POST",
            "/stock/entries",
            {
                "date": today.isoformat(),
                "variety_id": variety["id"],
                "origin": "opening_stock",
                "quantity": "25",
                "total_cost": None,
                "note": None,
            },
        )
        states = ("done", "done", *("skipped",) * len(OPTIONAL_STEPS))
        count, resume = 6, "finish"
    else:
        states = ("done", *("pending",) * (len(STEP_ORDER) - 1))
        count, resume = 1, "stock"
    expect_first_run(api, "onboarding", account="onboarding", import_notice=False)
    expect_onboarding_progress(
        api,
        account="onboarding",
        steps=tuple(zip(STEP_ORDER, states, strict=True)),
        count=count,
        resume=resume,
        over=False,
        can_skip_rest=name == "completo",
    )
    return account


def load_import_workbook() -> ModuleType:
    """The sibling `import_workbook.py`, loaded by its path: this file runs as a script
    (`scripts/design/` is then on `sys.path`) and is also loaded by path by its tests."""
    path = Path(__file__).with_name("import_workbook.py")
    spec = importlib.util.spec_from_file_location("import_workbook", path)
    if spec is None or spec.loader is None:
        raise SystemExit("sample-app: import_workbook.py cannot be loaded")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


# What the import's report prints when something is wrong or left out, as `report.py`
# writes it. The sample looks for these headings and never echoes the report.
REPORT_PROBLEM_HEADINGS = (
    "Blocking problems:",
    "Left out as unfinished:",
    "Total mismatches (sheet vs. recomputed):",
)


DATABASE_OVERRIDE = re.compile(r"^\s*(export\s+)?APOSTROPHE_DATABASE_URL\s*=", re.MULTILINE)


def refuse_database_override(dotenv: Path) -> None:
    """`scripts/import-spreadsheet.sh` sources the repository's `.env` after the environment
    it is given, so a `.env` that sets the database would send the import to the human's own
    database instead of the sample's. The sample stops before that, reading only whether the
    variable is assigned and never its value."""
    if dotenv.is_file() and DATABASE_OVERRIDE.search(dotenv.read_text(encoding="utf-8")):
        raise SystemExit(
            "sample-app: .env sets APOSTROPHE_DATABASE_URL and the import script would use it; "
            "move .env aside for this run"
        )


def run_import(env: dict[str, str], business: int, workbook: Path, *, dry_run: bool) -> None:
    """Runs `scripts/import-spreadsheet.sh` as the operator does, against the sample's own
    database (`env`). A non-zero exit, or a problem in its report, stops the sample with a
    message that carries nothing of the report: it can name customers and amounts."""
    refuse_database_override(REPO / ".env")
    command = [str(REPO / "scripts" / "import-spreadsheet.sh"), str(business), str(workbook)]
    if dry_run:
        command.append("--dry-run")
    ran = subprocess.run(command, cwd=REPO, env=env, capture_output=True, text=True, check=False)
    step = "dry run" if dry_run else "run"
    if ran.returncode != 0:
        raise SystemExit(f"sample-app: the import {step} failed")
    if any(heading in ran.stdout for heading in REPORT_PROBLEM_HEADINGS):
        raise SystemExit(f"sample-app: the import {step} reported a problem")


def imported_account(env: dict[str, str], base: str, today: date, db_path: Path) -> Account:
    """The `IMPORTED_ACCOUNTS` business: one the real spreadsheet import loaded.

    It is opened by the operator's invitation and left empty, so the import accepts it.
    Its workbook (`import_workbook.build`, written beside the sample's database, never in
    the repository) goes through the operator's own command, first with `--dry-run` and
    then for real: that run, and no row written by the tooling, stamps `imported_at`.
    Nothing here dismisses the after-import notice or publishes the catalog."""
    (name,) = IMPORTED_ACCOUNTS
    account, api = accept_new_business(env, base, name)
    business = business_id_of(db_path, account.email)
    workbook = db_path.parent / "import.xlsx"
    load_import_workbook().build(workbook, today)
    run_import(env, business, workbook, dry_run=True)
    run_import(env, business, workbook, dry_run=False)
    api.call("POST", "/auth/login", {"email": account.email, "password": account.password})
    expect_first_run(api, "none", account="imported", import_notice=True)
    return account


def end_onboarding(api: Api) -> None:
    """Ends the signed-in business's Onboarding through the app's own skip-rest, then checks
    that the app agrees: over, and no first-run element. Any other answer stops the sample
    run, with a message that holds no data."""
    if api.call("POST", "/onboarding-progress/skip-rest").get("over") is not True:
        raise SystemExit("sample-app: the Onboarding did not end")
    if api.call("GET", "/onboarding-progress").get("over") is not True:
        raise SystemExit("sample-app: the Onboarding did not end")
    shown = api.call("GET", "/first-run")
    if shown.get("kind") != "none" or shown.get("import_notice") is not False:
        raise SystemExit("sample-app: the ended account still shows a first-run element")


def open_ended_account(api: Api, open_business: Callable[[Api], Account], today: date) -> Account:
    """A business opened by `open_business` (the invitation accepted over `api`), signed in,
    seeded exactly like La Huerta and, last, with its Onboarding ended."""
    account = open_business(api)
    api.call("POST", "/auth/login", {"email": account.email, "password": account.password})
    seed(api, today)
    end_onboarding(api)
    return account


def ended_onboarding_accounts(env: dict[str, str], base: str, today: date) -> dict[str, Account]:
    """One extra business per `ENDED_ONBOARDING_ACCOUNTS` name, opened the way a new user
    opens one, seeded exactly like La Huerta and left with its Onboarding ended. Each signs
    in on its own `HttpApi`, so its session cookie never mixes with another business's."""
    accounts: dict[str, Account] = {}
    for name in ENDED_ONBOARDING_ACCOUNTS:

        def accept_invitation(api: Api, name: str = name) -> Account:
            account = Account(email=name.replace("_", "-") + "@lahuerta.com", password=PASSWORD)
            api.call(
                "POST",
                f"/invitations/{new_business_token(env)}/accept",
                {
                    "email": account.email,
                    "password": account.password,
                    "business_name": BUSINESS,
                },
            )
            return account

        accounts[name] = open_ended_account(HttpApi(base), accept_invitation, today)
    return accounts


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port: int = probe.getsockname()[1]
        return port


def wait_until_up(base: str, server: subprocess.Popen[bytes]) -> None:
    for _ in range(120):
        if server.poll() is not None:
            raise SystemExit("sample-app: the server exited before answering /health")
        try:
            with urllib.request.urlopen(base + "/health"):
                return
        except OSError:
            time.sleep(0.5)
    raise SystemExit("sample-app: /health never answered")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="sample-app")
    parser.add_argument("--port", type=int, default=0, help="default: a free one")
    parser.add_argument("--dir", type=Path, default=None, help="default: a new temp dir")
    args = parser.parse_args(argv)
    names = tuple(ACCOUNT_KINDS.values())
    if len({name for group in names for name in group}) != sum(len(group) for group in names):
        raise SystemExit("sample-app: an account has more than one kind")

    workdir: Path = args.dir or Path(tempfile.mkdtemp(prefix="apostrophe-sample-"))
    workdir.mkdir(parents=True, exist_ok=True)
    port = args.port or free_port()
    base = f"http://127.0.0.1:{port}"
    env = {
        **{k: v for k, v in os.environ.items() if not k.startswith("APOSTROPHE_")},
        "APOSTROPHE_SECRET_KEY": secrets.token_hex(16),
        "APOSTROPHE_DATABASE_URL": f"sqlite:///{workdir / 'sample.db'}",
        "APOSTROPHE_PUBLIC_URL": base,
        "APOSTROPHE_WEB_DIST": "web/dist",
    }
    server = subprocess.Popen(
        [
            "uv",
            "run",
            "--no-project",
            "uvicorn",
            "app.main:create_app",
            "--factory",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--no-access-log",
        ],
        cwd=REPO,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=(workdir / "server.log").open("wb"),
    )

    def stop(*_: object) -> None:
        server.terminate()
        server.wait(timeout=10)
        sys.exit(0)

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        wait_until_up(base, server)
        token = new_business_token(env)
        api = HttpApi(base)
        api.call(
            "POST",
            f"/invitations/{token}/accept",
            {"email": EMAIL, "password": PASSWORD, "business_name": BUSINESS},
        )
        api.call("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
        today = date.today()
        sample = seed(api, today)
        links = {
            # Unused, so their screens can be compared: one opens a new business, the
            # other joins La Huerta.
            "new_business_token": new_business_token(env),
            "join_token": token_from(api.call("POST", "/invitations")["url"]),
            # A live reset link for the sample's user, so the reset screen can be compared.
            "reset_token": reset_token(env, EMAIL),
        }
        open_accounts = onboarding_accounts(env, base, today)
        ended_accounts = ended_onboarding_accounts(env, base, today)
        db_path = workdir / "sample.db"
        (imported_name,) = IMPORTED_ACCOUNTS
        capture_accounts = {
            **{
                name: pre_onboarding_account(
                    env, base, today, db_path, name, priced=name == "checklist"
                )
                for name in PRE_ONBOARDING_ACCOUNTS
            },
            imported_name: imported_account(env, base, today, db_path),
            **{
                name: onboarding_frame_account(env, base, today, name)
                for name in ONBOARDING_FRAME_ACCOUNTS
            },
        }
    except BaseException:
        server.terminate()
        raise

    accounts = {**open_accounts, **ended_accounts, **capture_accounts}
    facts = {
        "url": base,
        "email": EMAIL,
        "password": PASSWORD,
        # The day the sample is seeded on: the capture's fake clock reads it, never the wall clock.
        "today": today.isoformat(),
        "ids": {**asdict(sample), **links},
        "accounts": {name: asdict(account) for name, account in accounts.items()},
        "account_kinds": {
            name: kind
            for kind, group in ACCOUNT_KINDS.items()
            for name in group
            if name in accounts
        },
    }
    (workdir / "sample.json").write_text(json.dumps(facts, indent=2), encoding="utf-8")
    print(f"url: {base}")
    print(f"email: {EMAIL}")
    print(f"password: {PASSWORD}")
    print(f"facts: {workdir / 'sample.json'}", flush=True)
    server.wait()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
