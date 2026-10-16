"""`require_usable`, the one archived-variety check of stock's use cases, with a fake
catalog and no infrastructure (docs/adr/0032)."""

import pytest

from app.stock.application.errors import VarietyArchived
from app.stock.application.variety_use import require_usable


class _Catalog:
    """Variety 1 is usable; variety 2 exists but is archived."""

    def exists(self, variety_id: int) -> bool:
        return variety_id in {1, 2}

    def usable(self, variety_id: int) -> bool:
        return variety_id == 1

    def archived_ids(self) -> list[int]:
        return [2]

    def listed_ids(self) -> list[int]:
        return [1]

    def names(self) -> dict[int, str]:
        return {1: "Zkittlez", 2: "Gelato"}


def test_a_usable_variety_passes_whether_or_not_it_is_kept() -> None:
    require_usable(_Catalog(), 1, keeps=False)
    require_usable(_Catalog(), 1, keeps=True)


def test_an_archived_variety_is_refused_unless_kept() -> None:
    with pytest.raises(VarietyArchived) as refused:
        require_usable(_Catalog(), 2, keeps=False)

    assert refused.value.variety_id == 2
    assert "2" not in str(refused.value)
    require_usable(_Catalog(), 2, keeps=True)
