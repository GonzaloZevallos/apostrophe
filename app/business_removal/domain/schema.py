"""The shapes the removal reasons about, read off the live database rather than kept
by hand: a `Schema` is a set of `Table`s, each with its `Column`s and `ForeignKey`s.
Nothing here names a business-owned table; that comes from reflection elsewhere.

Frozen dataclasses, validated in `__post_init__` (CODING_STANDARDS section 2)."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum, auto


class ColumnType(Enum):
    INTEGER = auto()
    TEXT = auto()
    BOOLEAN = auto()
    DATE = auto()
    DATETIME = auto()
    OTHER = auto()


@dataclass(frozen=True)
class Column:
    name: str
    type: ColumnType
    nullable: bool
    primary_key: bool

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("a column needs a name")


@dataclass(frozen=True)
class ForeignKey:
    columns: tuple[str, ...]
    target_table: str
    target_columns: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.columns or not self.target_columns:
            raise ValueError("a foreign key names at least one column on each side")
        if len(self.columns) != len(self.target_columns):
            raise ValueError("a foreign key pairs the same number of columns on each side")
        if not self.target_table:
            raise ValueError("a foreign key names its target table")


@dataclass(frozen=True)
class Table:
    name: str
    columns: tuple[Column, ...]
    foreign_keys: tuple[ForeignKey, ...]

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("a table needs a name")
        if not self.columns:
            raise ValueError(f"table {self.name!r} has no columns")
        names = [column.name for column in self.columns]
        if len(names) != len(set(names)):
            raise ValueError(f"table {self.name!r} repeats a column name")
        known = set(names)
        for foreign_key in self.foreign_keys:
            if any(column not in known for column in foreign_key.columns):
                raise ValueError(
                    f"table {self.name!r} has a foreign key on a column it does not have"
                )

    def column(self, name: str) -> Column:
        for column in self.columns:
            if column.name == name:
                return column
        raise KeyError(name)


@dataclass(frozen=True)
class Schema:
    tables: tuple[Table, ...]

    def __post_init__(self) -> None:
        names = [table.name for table in self.tables]
        if len(names) != len(set(names)):
            raise ValueError("a schema repeats a table name")

    def table(self, name: str) -> Table:
        for table in self.tables:
            if table.name == name:
                return table
        raise KeyError(name)
