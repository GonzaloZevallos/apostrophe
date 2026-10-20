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
     "account_kinds": {"<name>": "open" | "ended"}}

The top-level `email`, `password` and `ids` are La Huerta's. `accounts` is always present
(`{}` when both account tuples are empty): one extra business per name, seeded like La
Huerta. An `open` account (`ONBOARDING_ACCOUNTS`) is still in Onboarding, so a screen that
ends the Onboarding ("Listo") can be reached once per business in one run. An `ended`
account (`ENDED_ONBOARDING_ACCOUNTS`) has its Onboarding ended over HTTP, through
`skip-rest`, after it is seeded, for the screens whose frames do not draw the Onboarding's
notice. `account_kinds` has exactly the keys of `accounts`. An account carries no `ids`:
the ids are La Huerta's.
The data goes in over HTTP, never through the front: the front is what this app exists
to compare, so a redesigned screen must never break the seeding. Never touches the
human's own `apostrophe.db` or `.env`.
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import secrets
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from pathlib import Path
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
ENDED_ONBOARDING_ACCOUNTS = (
    "inicio",
)


class Api(Protocol):
    def call(self, method: str, path: str, body: object | None = None) -> Any: ...


@dataclass(frozen=True)
class Line:
    variety: int
    grams: str
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
        made: int = api.call("POST", "/varieties", {"name": name})["id"]
        api.call(
            "POST",
            f"/varieties/{made}/prices",
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

    def entry(when: str, variety_id: int, origin: str, grams: str, cost: int | None) -> int:
        made: int = api.call(
            "POST",
            "/stock/entries",
            {
                "date": when,
                "variety_id": variety_id,
                "origin": origin,
                "grams": grams,
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
    api.call("PUT", f"/stock/varieties/{cookies}/threshold", {"grams": "20"})

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
                        "grams": line.grams,
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
                "lines": [{"variety_id": v, "grams": grams} for v, grams in lines],
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
    api.call("PUT", f"/stock/varieties/{archived}/threshold", {"grams": "15"})
    entry(ago(40), archived, "opening_stock", "25", None)
    api.call("POST", f"/varieties/{archived}/archive")

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


class HttpApi:
    """The seed's `Api` over the running server, keeping its session cookie."""

    def __init__(self, base: str) -> None:
        self.base = base
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )

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
    if not set(ONBOARDING_ACCOUNTS).isdisjoint(ENDED_ONBOARDING_ACCOUNTS):
        raise SystemExit("sample-app: an account is both open and ended")

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
    except BaseException:
        server.terminate()
        raise

    accounts = {**open_accounts, **ended_accounts}
    facts = {
        "url": base,
        "email": EMAIL,
        "password": PASSWORD,
        # The day the sample is seeded on: the capture's fake clock reads it, never the wall clock.
        "today": today.isoformat(),
        "ids": {**asdict(sample), **links},
        "accounts": {name: asdict(account) for name, account in accounts.items()},
        "account_kinds": {
            **dict.fromkeys(open_accounts, "open"),
            **dict.fromkeys(ended_accounts, "ended"),
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
