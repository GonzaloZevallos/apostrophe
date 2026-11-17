"""Every adapter reads and writes an amount through the money helper (docs/adr/0058).

From the metadata columns tagged `info["money"]` the scan finds the mapped classes that own
them, then parses each module under `app/*/adapters/` with `ast` and flags:

- a read: `Row.column` that is not the first argument of a `scaled(...)` call;
- a write: a `Row(column=...)` keyword or an `x.column = ...` assignment in a module that
  does not refer to `money_stored_value`.

A second scan walks the response models the OpenAPI document publishes and flags a money
field declared as a bare `int`, `float` or `Decimal` instead of `MoneyOut`.

`reads_in`, `writes_in` and `bare_money_fields` are exercised below on inputs they must
reject, not only on the real tree. Limit: a read through a lower-case variable
(`row.amount` on a loaded entity) has no type the parse can see, so it is not scanned; the
route tests at both scales are what catch it.
"""

from __future__ import annotations

import ast
from decimal import Decimal
from typing import Annotated, Any, get_args, get_origin

from pydantic import BaseModel
from pydantic.fields import FieldInfo

from app.db import Base
from app.main import create_app
from app.money_schema import MoneyOut
from app.products.adapters.schemas import QuantityOut
from app.tables import TABLE_MODULES
from tests.architecture.hexagon import REPO_ROOT
from tests.conftest import NOW, SETTINGS, TEST_HASHER, MovableClock
from tests.fakes.telegram import FakeTelegram

# Whole `_`-separated segments of a field name that make it a money figure; a segment in
# NOT_MONEY makes it a count, a ratio or a flag even beside one of them.
MONEY_FIELD_SEGMENTS = frozenset(
    {
        "price",
        "cost",
        "costed",
        "amount",
        "total",
        "shipping",
        "discount",
        "balance",
        "owed",
        "sales",
        "sale",
        "expenses",
        "purchases",
        "profit",
        "cash",
        "margin",
    }
)
NOT_MONEY = frozenset({"count", "percent", "id", "quantity", "pending", "number"})

Owners = dict[str, frozenset[str]]


def money_attributes() -> Owners:
    """Mapped class name -> the attributes of its money columns."""
    found: Owners = {}
    for mapper in Base.registry.mappers:
        names = frozenset(
            column.key for column in mapper.local_table.columns if column.info.get("money") is True
        )
        if names:
            found[mapper.class_.__name__] = names
    return found


def _is_call_of(node: ast.AST, name: str) -> bool:
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    return (isinstance(func, ast.Name) and func.id == name) or (
        isinstance(func, ast.Attribute) and func.attr == name
    )


def _local_names(tree: ast.AST, owners: Owners) -> dict[str, str]:
    """Local name -> mapped class, following `import X as Y`."""
    local = {name: name for name in owners}
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                if alias.name in owners and alias.asname:
                    local[alias.asname] = alias.name
    return local


def reads_in(source: str, owners: Owners) -> list[tuple[int, str]]:
    """`Row.column` references that are not the amount handed to `scaled(...)`."""
    tree = ast.parse(source)
    local = _local_names(tree, owners)
    scaled_amounts = {
        id(call.args[0])
        for call in ast.walk(tree)
        if isinstance(call, ast.Call) and _is_call_of(call, "scaled") and call.args
    }
    return sorted(
        (node.lineno, f"{node.value.id}.{node.attr}")
        for node in ast.walk(tree)
        if isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and node.value.id in local
        and node.attr in owners[local[node.value.id]]
        and id(node) not in scaled_amounts
    )


def writes_in(source: str, owners: Owners) -> list[tuple[int, str]]:
    """Writes of a money column in a module that never refers to `money_stored_value`."""
    tree = ast.parse(source)
    local = _local_names(tree, owners)
    names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
    refers = "money_stored_value" in names or any(
        isinstance(n, ast.Attribute) and n.attr == "money_stored_value" for n in ast.walk(tree)
    )
    every_column = frozenset().union(*owners.values())
    uses_a_row = bool(names & set(local))
    found: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in local:
            columns = owners[local[node.func.id]]
            found.extend(
                (node.lineno, f"{node.func.id}({kw.arg}=)")
                for kw in node.keywords
                if kw.arg in columns
            )
        elif isinstance(node, ast.Assign | ast.AugAssign) and uses_a_row:
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            found.extend(
                (node.lineno, f"{t.attr} =")
                for t in targets
                if isinstance(t, ast.Attribute) and t.attr in every_column
            )
    return [] if refers else sorted(found)


def _adapter_modules() -> list[str]:
    app = REPO_ROOT / "app"
    return sorted(
        str(path.relative_to(REPO_ROOT))
        for path in app.glob("*/adapters/**/*.py")
        if path.name != "tables.py"
    )


def _owners() -> Owners:
    assert TABLE_MODULES, "no table module registered"
    return money_attributes()


OWNERS = _owners()


def test_the_scan_knows_the_money_columns() -> None:
    assert OWNERS["PaymentRow"] == {"amount"}
    assert OWNERS["SaleLineRow"] == {"price_per_gram", "line_total"}
    assert {"StockEntryRow", "ExpenseRow", "PriceEntryRow", "SaleRow"} <= set(OWNERS)


def test_a_read_is_flagged_unless_it_goes_through_scaled() -> None:
    source = (
        "from app.db import scaled\n"
        "a = select(scaled(PaymentRow.amount, f))\n"
        "b = select(PaymentRow.amount)\n"
        "c = func.sum(SaleLineRow.line_total)\n"
        "d = select(Other.amount)\n"
    )

    assert reads_in(source, OWNERS) == [(3, "PaymentRow.amount"), (4, "SaleLineRow.line_total")]


def test_a_read_through_an_alias_is_flagged() -> None:
    source = "from app.payments.adapters.tables import PaymentRow as P\nx = select(P.amount)\n"

    assert reads_in(source, OWNERS) == [(2, "P.amount")]


def test_a_write_is_flagged_unless_the_module_uses_money_stored_value() -> None:
    plain = "row = PaymentRow(amount=5, paid_on=d)\nrow.amount = 3\n"
    helped = "stored = money_stored_value(session, 1, money)\n" + plain

    assert writes_in(plain, OWNERS) == [(1, "PaymentRow(amount=)"), (2, "amount =")]
    assert writes_in(helped, OWNERS) == []


def test_a_keyword_that_is_not_a_money_column_is_not_a_write() -> None:
    assert writes_in("row = PaymentRow(paid_on=d, method='cash')\n", OWNERS) == []


def test_no_adapter_reads_an_amount_without_scaled() -> None:
    modules = _adapter_modules()
    assert modules, "the scan found no adapter modules"

    offenders = {
        path: found
        for path in modules
        if (found := reads_in((REPO_ROOT / path).read_text(encoding="utf-8"), OWNERS))
    }

    assert offenders == {}


def test_no_adapter_writes_an_amount_without_money_stored_value() -> None:
    offenders = {
        path: found
        for path in _adapter_modules()
        if (found := writes_in((REPO_ROOT / path).read_text(encoding="utf-8"), OWNERS))
    }

    assert offenders == {}


def _is_money_name(name: str) -> bool:
    segments = set(name.split("_"))
    return bool(segments & MONEY_FIELD_SEGMENTS) and not segments & NOT_MONEY


def _bare(annotation: Any, metadata: list[Any]) -> bool:
    """`int`, `float` or `Decimal`, possibly optional or in a list, without `MoneyOut`."""
    if get_origin(annotation) is Annotated:
        inner, *extra = get_args(annotation)
        return _bare(inner, [*metadata, *extra])
    if annotation in (int, float, Decimal):
        # A quantity is a decimal too: a field declared `QuantityOut` is not an amount.
        carried = get_args(MoneyOut)[1:] + get_args(QuantityOut)[1:]
        return not any(item in carried for item in metadata)
    return any(_bare(arg, metadata) for arg in get_args(annotation))


def _is_bare(info: FieldInfo) -> bool:
    return _bare(info.annotation, list(info.metadata))


def bare_money_fields(models: list[type[BaseModel]]) -> list[tuple[str, str]]:
    """`(model, field)` of every money-named field declared as a bare number."""
    return sorted(
        (model.__name__, name)
        for model in models
        for name, info in model.model_fields.items()
        if _is_money_name(name) and _is_bare(info)
    )


def _response_schema_names(document: dict[str, Any]) -> set[str]:
    schemas = document["components"]["schemas"]
    pending: list[Any] = [
        content["schema"]
        for item in document["paths"].values()
        for operation in item.values()
        for response in operation["responses"].values()
        for content in response.get("content", {}).values()
        if "schema" in content
    ]
    seen: set[str] = set()
    while pending:
        node = pending.pop()
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str):
                name = ref.rsplit("/", 1)[-1]
                if name not in seen and name in schemas:
                    seen.add(name)
                    pending.append(schemas[name])
            pending.extend(node.values())
        elif isinstance(node, list):
            pending.extend(node)
    return seen


def _all_models() -> list[type[BaseModel]]:
    found: list[type[BaseModel]] = []
    pending = list(BaseModel.__subclasses__())
    while pending:
        model = pending.pop()
        found.append(model)
        pending.extend(model.__subclasses__())
    return found


def _response_models() -> list[type[BaseModel]]:
    app = create_app(
        SETTINGS,
        clock=MovableClock(NOW),
        hasher=TEST_HASHER,
        telegram=FakeTelegram(),
        upkeep_ticker=False,
    )
    # Two models of one name are published as `app__x__Name`; the class name is the tail.
    names = {name.rsplit("__", 1)[-1] for name in _response_schema_names(app.openapi())}
    return [
        model
        for model in _all_models()
        if model.__name__ in names and model.__module__.startswith("app.")
    ]


def test_the_response_scan_flags_a_bare_money_field() -> None:
    class Bare(BaseModel):
        total: int
        balance: Decimal | None
        average_sale: float
        sales_count: int
        profit: MoneyOut
        amounts: list[int]
        costs: list[Decimal]

    assert bare_money_fields([Bare]) == [
        ("Bare", "average_sale"),
        ("Bare", "balance"),
        ("Bare", "total"),
    ]


def test_no_response_model_declares_a_money_field_as_a_bare_number() -> None:
    models = _response_models()
    assert any(model.__name__ == "PanelOut" for model in models), "the scan found no response"

    assert bare_money_fields(models) == []
