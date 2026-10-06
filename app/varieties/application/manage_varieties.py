from app.shared.transaction import Transaction
from app.varieties.application.errors import NameTaken, VarietyNotFound
from app.varieties.application.ports import Varieties
from app.varieties.domain.variety import Variety, VarietyName


def register_variety(varieties: Varieties, transaction: Transaction, raw_name: str) -> Variety:
    name = VarietyName.of(raw_name)
    if varieties.name_holder(name) is not None:
        raise NameTaken(name.value)
    variety = varieties.add(Variety(name))
    transaction.commit()
    return variety


def rename_variety(
    varieties: Varieties, transaction: Transaction, variety_id: int, raw_name: str
) -> Variety:
    variety = get_variety(varieties, variety_id)
    name = VarietyName.of(raw_name)
    if varieties.name_holder(name, other_than=variety_id) is not None:
        raise NameTaken(name.value)
    variety.rename(name)
    stored = varieties.save(variety)
    transaction.commit()
    return stored


def get_variety(varieties: Varieties, variety_id: int) -> Variety:
    variety = varieties.get(variety_id)
    if variety is None:
        raise VarietyNotFound(variety_id)
    return variety


def list_varieties(varieties: Varieties) -> list[Variety]:
    return varieties.listed()
