"""What `GET /sales` costs, guarded without a clock (docs/adr/0038).

PRD metric 6 says the list answers in under 300 ms with a few hundred sales. No test
here measures a duration: a duration depends on how busy the machine is. The two
things that decide the cost do not:

- the **query plan** of the two statements of `SqlSales._views`: the database must
  search the named indexes, never scan `sale`, `sale_line` or `payment`, never build an
  automatic index and never sort through a temporary b-tree. `plan_problems` reads a
  plan by the tokens of its lines, so a driver wording a line differently still reads
  the same;
- the **statement count**: the request issues as many statements with 30 sales as with
  300, so no statement is issued per sale or per customer.

The settlement statements (`SqlLedgers`, which read the business whole, ADR-0012) are
not in the plan check; the statement count alone covers them. `settle()` runs in Python,
so a cost inside it is outside what either check sees.

The plan test runs on the stdlib `sqlite3` driver and on libsql. No `ANALYZE` is run: if
a driver picks another plan on an un-analysed database, the test fails and that calls
for a decision (ADR-0038), not for tuning the query around it.
"""

from __future__ import annotations

import itertools
import re
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.engine import Engine

from app.db import make_engine

SALES_INDEX = "ix_sale_business_id_sale_date"
LINES_INDEX = "ix_sale_line_sale_id"
PAYMENT_INDEX = "ix_payment_sale_id"
LIST_TABLES = ("sale", "sale_line", "payment")

# The statements `GET /sales` emits for a signed-in request: the session's user and
# business (2), the two list statements (2), then the settlement's three reads (3).
# Pinned so a constant increase fails too, not only one that grows with the data.
PINNED_STATEMENTS = 7

PERIOD = {"date_from": "2026-09-01", "date_to": "2026-09-30"}


# --- the plan reader: a pure function over `EXPLAIN QUERY PLAN` detail lines -------------


@dataclass(frozen=True)
class _Step:
    verb: str | None
    table: str | None
    index: str | None
    automatic: bool
    sorts_with_temp_btree: bool


def _read(line: str) -> _Step:
    tokens = line.split()
    verb = tokens[0] if tokens and tokens[0] in ("SCAN", "SEARCH") else None
    table: str | None = None
    if verb is not None and len(tokens) > 1:
        position = 2 if tokens[1] == "TABLE" else 1
        table = tokens[position] if len(tokens) > position else None
    index: str | None = None
    for position, token in enumerate(tokens[:-1]):
        following = tokens[position + 1]
        if token == "INDEX" and not following.startswith("("):
            index = following
    return _Step(
        verb=verb,
        table=table,
        index=index,
        automatic="AUTOMATIC" in tokens,
        sorts_with_temp_btree=tokens[:3] == ["USE", "TEMP", "B-TREE"] and "ORDER" in tokens,
    )


def plan_problems(plan_lines: Sequence[str], statement: Literal["sales", "lines"]) -> list[str]:
    """What is wrong with the plan of one list statement; empty when it is sound.
    `"sales"` is the sale joined to its payment, `"lines"` the lines of the listed
    sales. Matches the tokens of each line, never a whole line."""
    steps = [_read(line) for line in plan_lines]
    problems: list[str] = []

    def _searches(table: str, index: str) -> bool:
        return any(
            step.verb == "SEARCH" and step.table == table and step.index == index for step in steps
        )

    required = (
        [("sale", SALES_INDEX), ("payment", PAYMENT_INDEX)]
        if statement == "sales"
        else [("sale_line", LINES_INDEX)]
    )
    for table, index in required:
        if not _searches(table, index):
            problems.append(f"{table} is not searched through {index}")
    for step in steps:
        if step.verb == "SCAN" and step.table in LIST_TABLES:
            problems.append(f"{step.table} is scanned whole")
    if statement == "sales":
        if any(step.automatic for step in steps):
            problems.append("an automatic index is built at run time")
        if any(step.sorts_with_temp_btree for step in steps):
            problems.append("the order is made by a temporary b-tree")
    return problems


INDEXED_SALES = [
    "SEARCH sale USING INDEX ix_sale_business_id_sale_date "
    "(business_id=? AND sale_date>? AND sale_date<?)",
    "SEARCH customer USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN",
    "SEARCH payment USING INDEX ix_payment_sale_id (sale_id=?) LEFT-JOIN",
]
INDEXED_LINES = [
    "SEARCH sale_line USING INDEX ix_sale_line_sale_id (sale_id=?)",
    "SEARCH variety USING INTEGER PRIMARY KEY (rowid=?)",
    "USE TEMP B-TREE FOR RIGHT PART OF ORDER BY",
]


def test_an_indexed_plan_has_no_problems() -> None:
    assert plan_problems(INDEXED_SALES, "sales") == []
    assert plan_problems(INDEXED_LINES, "lines") == []


def test_a_covering_index_search_is_not_a_problem() -> None:
    covering = [
        INDEXED_SALES[0],
        "SEARCH payment USING COVERING INDEX ix_payment_sale_id (sale_id=?) LEFT-JOIN",
    ]

    assert plan_problems(covering, "sales") == []


def test_a_scan_of_sale_is_flagged_in_either_wording_of_the_line() -> None:
    for scan in ("SCAN sale", "SCAN TABLE sale"):
        plan = [scan, *INDEXED_SALES[1:]]

        problems = plan_problems(plan, "sales")

        assert "sale is scanned whole" in problems
        assert f"sale is not searched through {SALES_INDEX}" in problems


def test_a_scan_of_the_lines_is_flagged() -> None:
    problems = plan_problems(["SCAN sale_line", INDEXED_LINES[1]], "lines")

    assert "sale_line is scanned whole" in problems
    assert f"sale_line is not searched through {LINES_INDEX}" in problems


def test_an_automatic_index_is_flagged() -> None:
    plan = [
        INDEXED_SALES[0],
        "BLOOM FILTER ON payment (sale_id=? AND business_id=?)",
        "SEARCH payment USING AUTOMATIC PARTIAL COVERING INDEX "
        "(sale_id=? AND business_id=?) LEFT-JOIN",
    ]

    problems = plan_problems(plan, "sales")

    assert "an automatic index is built at run time" in problems
    assert f"payment is not searched through {PAYMENT_INDEX}" in problems


def test_a_temporary_btree_for_the_order_is_flagged_in_either_driver_wording() -> None:
    for wording in ("LAST TERM OF ORDER BY", "RIGHT PART OF ORDER BY", "ORDER BY"):
        plan = [*INDEXED_SALES, f"USE TEMP B-TREE FOR {wording}"]

        assert plan_problems(plan, "sales") == ["the order is made by a temporary b-tree"]


def test_a_missing_payment_index_is_flagged_by_name() -> None:
    plan = [*INDEXED_SALES[:2], "SCAN payment"]

    problems = plan_problems(plan, "sales")

    assert f"payment is not searched through {PAYMENT_INDEX}" in problems
    assert "payment is scanned whole" in problems


# --- GET /sales through the real app ---------------------------------------------------


@pytest.fixture(params=["sqlite", "libsql"])
def engine(request: pytest.FixtureRequest, tmp_path: Path) -> Iterator[Engine]:
    """Replaces `tests/conftest.py`'s in-memory engine, for this file only, with one per
    driver; `app` and `client` take whichever `engine` is in scope."""
    url = "sqlite://" if request.param == "sqlite" else f"sqlite+libsql:///{tmp_path / 'a.db'}"
    engine = make_engine(url)
    yield engine
    engine.dispose()


def _seed(client: TestClient, sales: int) -> None:
    """`sales` sales through the HTTP API: three per customer, every other one left
    owing, every seventh without a customer, spread over September, and a later
    payment for a third of the customers that owe."""
    variety = client.post("/varieties", json={"name": "Lavanda"}).json()["id"]
    priced = client.post(
        f"/varieties/{variety}/prices",
        json={"effective_from": "2026-01-01", "list_price": 10_000},
    )
    assert priced.status_code == 201, priced.text
    customers: list[int] = []
    for number in range(max(sales // 3, 1)):
        created = client.post(
            "/customers", json={"name": f"Cliente {number}", "phone": f"11 {2000 + number}-6789"}
        )
        assert created.status_code == 201, created.text
        customers.append(int(created.json()["id"]))
    owing: list[int] = []
    for number in range(sales):
        customer = None if number % 7 == 0 else customers[(number // 3) % len(customers)]
        is_owing = customer is not None and number % 2 == 1
        body: dict[str, object] = {
            "date": (date(2026, 9, 1) + timedelta(days=number % 28)).isoformat(),
            "payment": "owing" if is_owing else "cash",
            "lines": [
                {"variety_id": variety, "quantity": "2"},
                {"variety_id": variety, "quantity": "1"},
            ],
        }
        if customer is not None:
            body["customer_id"] = customer
        sold = client.post("/sales", json=body)
        assert sold.status_code == 201, sold.text
        if is_owing and customer is not None and customer not in owing:
            owing.append(customer)
    for customer in owing[::3]:
        paid = client.post(
            f"/customers/{customer}/payments",
            json={"paid_on": "2026-10-01", "amount": 1, "method": "cash"},
        )
        assert paid.status_code == 201, paid.text


_Captured = tuple[str, tuple[object, ...]]


def _list_period(client: TestClient, engine: Engine) -> tuple[list[_Captured], int]:
    """The statements one `GET /sales` over September issues, with their parameters, and
    how many sales it answered."""
    captured: list[_Captured] = []

    def _record(
        conn: object, cursor: object, statement: str, parameters: object, *args: object
    ) -> None:
        captured.append((statement, tuple(parameters) if isinstance(parameters, tuple) else ()))

    event.listen(engine, "before_cursor_execute", _record)
    try:
        response = client.get("/sales", params=PERIOD)
    finally:
        event.remove(engine, "before_cursor_execute", _record)
    assert response.status_code == 200, response.text
    return captured, len(response.json())


def _list_statements(
    captured: Sequence[_Captured],
) -> tuple[_Captured, _Captured]:
    """The two statements of `SqlSales._views`, told from the rest by their joins: the
    sales one joins the customer, the lines one joins the variety."""
    sales = [item for item in captured if " JOIN customer " in item[0]]
    lines = [item for item in captured if " JOIN variety " in item[0]]
    assert len(sales) == 1 and len(lines) == 1, [statement for statement, _ in captured]
    return sales[0], lines[0]


_EXPLAINED = itertools.count()


def _plan(engine: Engine, statement: str, parameters: tuple[object, ...]) -> list[str]:
    # The comment makes every EXPLAIN a new text: the driver keeps the prepared
    # statement of a text it has seen, and the plan of an EXPLAIN is fixed when it is
    # prepared, so after a schema change the same text would answer the old plan.
    explain = f"EXPLAIN QUERY PLAN /* {next(_EXPLAINED)} */ {statement}"
    with engine.connect() as connection:
        rows = connection.exec_driver_sql(explain, parameters).all()
    return [str(row[3]) for row in rows]


def _plans(engine: Engine, client: TestClient, sales: int) -> tuple[list[str], list[str]]:
    captured, answered = _list_period(client, engine)
    assert answered == sales
    (sales_statement, sales_parameters), (lines_statement, lines_parameters) = _list_statements(
        captured
    )
    return (
        _plan(engine, sales_statement, sales_parameters),
        _plan(engine, lines_statement, lines_parameters),
    )


def test_the_list_statements_search_the_indexes_rather_than_scan(
    client: TestClient, engine: Engine
) -> None:
    # 30 sales are enough: with no ANALYZE the planner knows no row counts, so the plan
    # does not depend on how many sales there are (the count test below uses 300).
    _seed(client, 30)

    sales_plan, lines_plan = _plans(engine, client, 30)

    assert plan_problems(sales_plan, "sales") == [], sales_plan
    assert plan_problems(lines_plan, "lines") == [], lines_plan


def test_dropping_the_sale_index_makes_the_guard_name_it(
    client: TestClient, engine: Engine
) -> None:
    _seed(client, 30)
    sales_plan, lines_plan = _plans(engine, client, 30)
    assert plan_problems(sales_plan, "sales") == [], sales_plan
    assert plan_problems(lines_plan, "lines") == [], lines_plan

    with engine.begin() as connection:
        connection.execute(text(f"DROP INDEX {SALES_INDEX}"))
    sales_plan, lines_plan = _plans(engine, client, 30)

    problems = plan_problems(sales_plan, "sales")
    assert {name for problem in problems for name in re.findall(r"ix_\w+", problem)} == {
        SALES_INDEX
    }, problems
    assert plan_problems(lines_plan, "lines") == [], lines_plan


@pytest.mark.parametrize("engine", ["sqlite"], indirect=True)
def test_the_list_issues_the_same_number_of_statements_with_30_sales_as_with_300(
    client: TestClient, other_client: TestClient, engine: Engine
) -> None:
    _seed(client, 30)
    _seed(other_client, 300)

    small, small_answered = _list_period(client, engine)
    big, big_answered = _list_period(other_client, engine)

    assert (small_answered, big_answered) == (30, 300)
    # Equal, and equal to the measured value: pinned, so one statement more for every
    # request fails as well. `settle()` runs in Python, so what it does with the rows it
    # reads is outside what a count of statements sees.
    assert (len(small), len(big)) == (PINNED_STATEMENTS, PINNED_STATEMENTS)
