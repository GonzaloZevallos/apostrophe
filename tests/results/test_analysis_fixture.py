"""`GET /analysis`'s response schema, pinned against the frozen front fixtures.

Nothing here builds `period_figures` or the route (that is `results-backend`'s job);
this only proves `AnalysisOut` accepts exactly the shape the front was handed, and
rejects a shape it should not, so the schema cannot silently drift from either fixture
or let through a field of the wrong type (a count as a float, say). Money is `MoneyOut`:
a non-whole amount is valid there (docs/adr/0058).
"""

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.results.adapters.schemas import AnalysisOut

FIXTURES = Path(__file__).resolve().parents[2] / "web" / "src" / "api" / "fixtures"


@pytest.mark.parametrize("name", ["analysis.json", "analysis-empty.json"])
def test_the_fixture_validates_strictly_against_the_schema(name: str) -> None:
    raw = (FIXTURES / name).read_text()

    AnalysisOut.model_validate_json(raw, strict=True)


def test_strict_mode_rejects_a_float_where_the_contract_says_a_count_is_an_int() -> None:
    raw = (FIXTURES / "analysis.json").read_text()
    broken = raw.replace('"count": 20', '"count": 20.5', 1)
    assert broken != raw, "the fixture must contain a 'count': 20 to corrupt"

    with pytest.raises(ValidationError):
        AnalysisOut.model_validate_json(broken, strict=True)
