from datetime import datetime
from typing import Literal

from app.shared.transaction import Transaction
from app.varieties.application.errors import (
    NameHeldByArchived,
    NameTaken,
    VarietyArchived,
    VarietyHasHistory,
    VarietyNotFound,
)
from app.varieties.application.ports import Varieties, VarietyLeaving
from app.varieties.domain.variety import NameHolder, Variety, VarietyName


def register_variety(varieties: Varieties, transaction: Transaction, raw_name: str) -> Variety:
    name = VarietyName.of(raw_name)
    _require_name_free(varieties, name, other_than=None)
    variety = varieties.add(Variety(name))
    transaction.commit()
    return variety


def rename_variety(
    varieties: Varieties, transaction: Transaction, variety_id: int, raw_name: str
) -> Variety:
    variety = get_variety(varieties, variety_id)
    name = VarietyName.of(raw_name)
    variety.rename(name)
    _require_name_free(varieties, name, other_than=variety_id)
    stored = varieties.save(variety)
    transaction.commit()
    return stored


def _require_name_free(varieties: Varieties, name: VarietyName, other_than: int | None) -> None:
    holder = varieties.name_holder(name, other_than=other_than)
    if holder is NameHolder.ARCHIVED:
        raise NameHeldByArchived
    if holder is NameHolder.LIVE:
        raise NameTaken(name.value)


def archive_variety(
    varieties: Varieties, transaction: Transaction, variety_id: int, at: datetime
) -> Variety:
    """Never refused because the variety has or lacks history: only deleting is guarded."""
    variety = get_variety(varieties, variety_id)
    variety.archive(at)
    stored = varieties.save(variety)
    transaction.commit()
    return stored


def restore_variety(varieties: Varieties, transaction: Transaction, variety_id: int) -> Variety:
    variety = get_variety(varieties, variety_id)
    variety.restore()
    stored = varieties.save(variety)
    transaction.commit()
    return stored


def get_variety(varieties: Varieties, variety_id: int) -> Variety:
    variety = varieties.get(variety_id)
    if variety is None:
        raise VarietyNotFound(variety_id)
    return variety


def list_varieties(varieties: Varieties, *, archived: bool = False) -> list[Variety]:
    return varieties.archived() if archived else varieties.listed()


def delete_variety(
    varieties: Varieties,
    leaving: VarietyLeaving,
    transaction: Transaction,
    variety_id: int,
) -> None:
    """Only a variety with no history is deleted: the common refusal writes nothing, and
    the last word is one guarded delete after the dependents, in one transaction."""
    variety = get_variety(varieties, variety_id)
    if variety.is_archived:
        raise VarietyArchived(variety_id)
    if varieties.has_history(variety_id):
        raise VarietyHasHistory
    leaving.leaving(variety_id)
    varieties.remove_price_entries(variety_id)
    if not varieties.remove_unused(variety_id):
        transaction.rollback()
        raise VarietyHasHistory
    transaction.commit()


def removal_offered(varieties: Varieties, variety: Variety) -> Literal["delete", "archive"] | None:
    """`None` for an archived variety; otherwise the one removal its page offers."""
    if variety.is_archived:
        return None
    assert variety.id is not None
    return "archive" if varieties.has_history(variety.id) else "delete"
