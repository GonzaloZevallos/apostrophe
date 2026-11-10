"""The Catalog's `_money` and `round_half_up` against `web/src/format/money.vectors.json`,
the file the front's `moneyFormatter` is checked against too (no locale library on either
side): the same figures, written the same way."""

import json
from decimal import Decimal
from fractions import Fraction
from pathlib import Path
from typing import Any

import pytest

from app.catalog.domain.text import _money
from app.shared.money import MoneyFormat, round_half_up

VECTORS: list[dict[str, Any]] = json.loads(
    (Path(__file__).resolve().parents[2] / "web" / "src" / "format" / "money.vectors.json")
    .read_text(encoding="utf-8")
)
WHOLE_ROWS = [row for row in VECTORS if "." not in row["amount"] and row["attached"] is not None]
MINUS = "−"


def _hundredths(signed: str, symbol: str) -> int:
    """The signed hundredths a vector's `signed` text states, read back from the text."""
    negative = signed.startswith(MINUS)
    figure = signed.removeprefix(MINUS).removeprefix(symbol).strip()
    return int(Decimal(figure.replace(".", "").replace(",", ".")) * 100) * (-1 if negative else 1)


def _id(row: dict[str, Any]) -> str:
    return f"{row['symbol']}-{row['amount']}-{row['decimals']}"


@pytest.mark.parametrize("row", WHOLE_ROWS, ids=_id)
def test_money_writes_the_attached_form_of_the_vectors(row: dict[str, Any]) -> None:
    money = MoneyFormat(symbol=row["symbol"], decimals=row["decimals"])

    assert _money(int(row["amount"]), money) == row["attached"]


@pytest.mark.parametrize("row", VECTORS, ids=_id)
def test_round_half_up_agrees_with_the_vectors(row: dict[str, Any]) -> None:
    money = MoneyFormat(symbol=row["symbol"], decimals=row["decimals"])

    rounded = round_half_up(Fraction(Decimal(row["amount"])), money)

    assert rounded.hundredths == _hundredths(row["signed"], row["symbol"])


def test_money_pads_a_whole_amount_to_the_decimals_and_never_divides_it() -> None:
    assert _money(11000, MoneyFormat(symbol="US$", decimals=2)) == "US$11.000,00"
    assert _money(0, MoneyFormat(symbol="$", decimals=0)) == "$0"
