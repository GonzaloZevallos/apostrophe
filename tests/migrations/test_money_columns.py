"""Metadata guards for money (docs/adr/0058): an amount is held only in an Integer column
declared through `money_column()`, which tags `info["money"]`.

`MONEY_NAME_SEGMENTS` is the one place the names a guard treats as money are written. A
column name matches when any of its whole `_`-separated segments is in the set, so
`price_per_gram` and `line_total` match and `totally` does not. There is no exemption
list: a column that matches must be tagged, and a column that must not be tagged must not
be named like money.

Each guard is a function over a `MetaData` that returns the offenders it finds, so the
same function runs over the product's metadata (it must find none) and over a throwaway
one built here (it must find each offender).
"""

from __future__ import annotations

from sqlalchemy import JSON, Column, Integer, MetaData, String, Table, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.db import money_column
from app.tables import metadata as declared_metadata

MONEY_NAME_SEGMENTS = frozenset({"price", "cost", "amount", "total", "shipping", "discount"})

Offender = tuple[str, str]


def _has_money_name(column_name: str) -> bool:
    return any(segment in MONEY_NAME_SEGMENTS for segment in column_name.split("_"))


def _is_tagged(column: Column[object]) -> bool:
    return column.info.get("money") is True


def untagged_money_integers(metadata: MetaData) -> list[Offender]:
    """Integer columns named like money that lack the `money_column()` tag."""
    return [
        (table.name, column.name)
        for table in metadata.sorted_tables
        for column in table.columns
        if isinstance(column.type, Integer)
        and _has_money_name(column.name)
        and not _is_tagged(column)
    ]


def textual_money_columns(metadata: MetaData) -> list[Offender]:
    """Text, String or JSON columns named like money: an amount is never held as text."""
    return [
        (table.name, column.name)
        for table in metadata.sorted_tables
        for column in table.columns
        if isinstance(column.type, Text | String | JSON) and _has_money_name(column.name)
    ]


def tagged_non_integers(metadata: MetaData) -> list[Offender]:
    """Columns tagged money that are not Integer."""
    return [
        (table.name, column.name)
        for table in metadata.sorted_tables
        for column in table.columns
        if _is_tagged(column) and not isinstance(column.type, Integer)
    ]


def _throwaway() -> MetaData:
    metadata = MetaData()
    Table(
        "offender",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("price", Integer),
        Column("total", Text),
        Column("shipping_note", String(20)),
        Column("discount_payload", JSON),
        Column("x", String(10), info={"money": True}),
    )
    Table(
        "clean",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("amount", Integer, info={"money": True}),
        Column("totally", Integer),
        Column("name", String(20)),
    )
    return metadata


def test_every_money_integer_in_the_product_is_tagged() -> None:
    assert untagged_money_integers(declared_metadata) == []


def test_no_text_column_in_the_product_is_named_like_money() -> None:
    assert textual_money_columns(declared_metadata) == []


def test_every_tagged_column_in_the_product_is_an_integer() -> None:
    assert tagged_non_integers(declared_metadata) == []


def test_the_untagged_integer_guard_reports_an_untagged_price() -> None:
    assert untagged_money_integers(_throwaway()) == [("offender", "price")]


def test_the_text_guard_reports_text_string_and_json_money_names() -> None:
    assert textual_money_columns(_throwaway()) == [
        ("offender", "total"),
        ("offender", "shipping_note"),
        ("offender", "discount_payload"),
    ]


def test_the_tagged_guard_reports_a_tagged_string() -> None:
    assert tagged_non_integers(_throwaway()) == [("offender", "x")]


def test_a_name_matches_on_whole_segments_only() -> None:
    assert _has_money_name("price_per_gram")
    assert _has_money_name("line_total")
    assert not _has_money_name("totally")
    assert not _has_money_name("discounted")


class _ScratchBase(DeclarativeBase):
    pass


class _ScratchRow(_ScratchBase):
    __tablename__ = "scratch_row"
    id: Mapped[int] = mapped_column(primary_key=True)
    amount: Mapped[int] = money_column()
    maybe_cost: Mapped[int | None] = money_column(nullable=True)


def test_money_column_tags_info_and_is_a_plain_integer_column() -> None:
    table = _ScratchRow.__table__
    assert table.c.amount.info == {"money": True}
    assert table.c.amount.nullable is False
    assert table.c.maybe_cost.info == {"money": True}
    assert table.c.maybe_cost.nullable is True
    assert type(table.c.amount.type) is Integer
    assert type(table.c.maybe_cost.type) is Integer
