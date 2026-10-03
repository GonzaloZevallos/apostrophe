"""`periods()` and `Period` (CODING_STANDARDS.md section 5: domain unit test, no
infrastructure). Bounds are read from the one shared `web/src/format/periods.vectors.json`
(plan invariant: period bounds are tested on both sides from that file; no test
hand-copies expected bounds) rather than written again here.
"""

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from app.results.domain.periods import InvalidPeriod, Period, periods

VECTORS_PATH = (
    Path(__file__).resolve().parents[2] / "web" / "src" / "format" / "periods.vectors.json"
)
VECTORS: list[dict[str, Any]] = json.loads(VECTORS_PATH.read_text(encoding="utf-8"))


def _date(iso: str) -> date:
    return date.fromisoformat(iso)


@pytest.mark.parametrize("vector", VECTORS, ids=[v["today"] for v in VECTORS])
def test_periods_match_every_vector(vector: dict[str, Any]) -> None:
    today = _date(vector["today"])

    answer = periods(today)

    today_range = vector["today_range"]
    assert answer.today == Period(_date(today_range["start"]), _date(today_range["end"]))
    assert answer.week == Period(_date(vector["week"]["start"]), _date(vector["week"]["end"]))
    assert answer.month == Period(_date(vector["month"]["start"]), _date(vector["month"]["end"]))


def test_a_period_accepts_start_equal_to_end() -> None:
    day = date(2026, 10, 3)

    assert Period(day, day).start == day


def test_a_period_refuses_start_after_end() -> None:
    """The enforcement artefact: `Period.__post_init__` rejects a start after its end,
    rather than silently swapping or accepting it."""
    with pytest.raises(InvalidPeriod):
        Period(date(2026, 10, 4), date(2026, 10, 3))
