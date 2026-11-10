"""One helper for the wire shape of money in a response (docs/adr/0058): every amount of a
converted route is a JSON integer while it is whole, never a float and never a string."""

from __future__ import annotations

from typing import Any


def money_values(body: Any, path: str) -> list[Any]:
    """The values at `path`: dotted names, `[]` after a list (`lines[].cost.costed`)."""
    found = [body]
    for step in path.split("."):
        name, is_list = step.removesuffix("[]"), step.endswith("[]")
        found = [item.get(name) for item in found if item is not None]
        if is_list:
            found = [element for items in found for element in items]
    return found


def assert_money_is_int(body: Any, *paths: str, null_ok: tuple[str, ...] = ()) -> None:
    """Every value at each path is an `int` (`bool` is not one). A path answers at least
    one value, and no `null` unless it is listed in `null_ok`, so a path that no longer
    exists or that holds only nulls fails instead of checking nothing."""
    for path in paths:
        values = money_values(body, path)
        assert values, f"{path}: no value to check"
        for value in values:
            if value is None and path in null_ok:
                continue
            assert type(value) is int, f"{path}: {value!r} is not a JSON integer"
