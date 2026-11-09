"""One helper for the wire shape of money in a response (docs/adr/0058): every amount of a
converted route is a JSON integer while it is whole, never a float and never a string."""

from __future__ import annotations

from typing import Any


def money_values(body: Any, path: str) -> list[Any]:
    """The values at `path`: dotted names, `[]` after a list (`lines[].cost.costed`)."""
    found = [body]
    for step in path.split("."):
        name, is_list = step.removesuffix("[]"), step.endswith("[]")
        found = [item[name] for item in found if item is not None]
        if is_list:
            found = [element for items in found for element in items]
    return found


def assert_money_is_int(body: Any, *paths: str) -> None:
    """Every non-null value at each path is an `int` (`bool` is not one), and each path
    answers at least one value, so a path that no longer exists fails instead of passing."""
    for path in paths:
        values = money_values(body, path)
        assert values, f"{path}: no value to check"
        for value in values:
            assert value is None or type(value) is int, f"{path}: {value!r} is not a JSON integer"
