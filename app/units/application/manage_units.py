from app.shared.transaction import Transaction
from app.shared.unit import Unit, UnitNotFound
from app.units.application.ports import Units, UnitUse
from app.units.domain.unit import (
    DEFAULT_DECIMALS,
    DEFAULT_LABEL,
    DEFAULT_NAME,
    IMPORTED_DECIMALS,
    IMPORTED_LABEL,
    IMPORTED_NAME,
    CountedUnit,
    DecimalsInUse,
    LastUnit,
    UnitDraft,
    UnitInUse,
    UnitLabel,
    UnitName,
    UnitNameTaken,
)


def open_default_unit(units: Units) -> Unit:
    """Called once, when a business opens (docs/adr/0006). Never commits: the caller's own
    transaction covers it, together with the rest of what opening a business does."""
    draft = UnitDraft(UnitName.of(DEFAULT_NAME), UnitLabel.of(DEFAULT_LABEL), DEFAULT_DECIMALS)
    return units.add(draft)


def imported_unit(units: Units) -> Unit:
    """The unit the spreadsheet import gives the products it loads: the business's own
    "grams" when it has one, else a new one. Never commits."""
    name = UnitName.of(IMPORTED_NAME)
    found = units.by_name(name)
    if found is not None:
        return found
    return units.add(UnitDraft(name, UnitLabel.of(IMPORTED_LABEL), IMPORTED_DECIMALS))


def list_units(units: Units, use: UnitUse) -> list[CountedUnit]:
    counts = use.products_per_unit()
    return [CountedUnit(unit, counts.get(unit.id, 0)) for unit in units.list()]


def get_unit(units: Units, unit_id: int) -> Unit:
    unit = units.by_id(unit_id)
    if unit is None:
        raise UnitNotFound
    return unit


def add_unit(
    units: Units, transaction: Transaction, raw_name: str, raw_label: str, decimals: int
) -> CountedUnit:
    draft = UnitDraft(UnitName.of(raw_name), UnitLabel.of(raw_label), decimals)
    if units.by_name(draft.name) is not None:
        raise UnitNameTaken
    unit = units.add(draft)
    transaction.commit()
    return CountedUnit(unit, 0)


def edit_unit(
    units: Units,
    use: UnitUse,
    transaction: Transaction,
    unit_id: int,
    *,
    raw_name: str | None,
    raw_label: str | None,
    decimals: int | None,
) -> CountedUnit:
    """Renaming (name or label) and raising decimals are always allowed. Lowering decimals
    is refused outright until the guarded statement that checks every recorded quantity
    lands, so a unit never loses decimals a quantity may use."""
    current = get_unit(units, unit_id)
    draft = UnitDraft(
        UnitName.of(current.name if raw_name is None else raw_name),
        UnitLabel.of(current.label if raw_label is None else raw_label),
        current.decimals if decimals is None else decimals,
    )
    holder = units.by_name(draft.name)
    if holder is not None and holder.id != unit_id:
        raise UnitNameTaken
    if draft.decimals < current.decimals:
        raise DecimalsInUse
    stored = units.save(Unit(unit_id, draft.name.value, draft.label.value, draft.decimals))
    transaction.commit()
    return CountedUnit(stored, use.products_using(unit_id))


def remove_unit(units: Units, use: UnitUse, transaction: Transaction, unit_id: int) -> None:
    get_unit(units, unit_id)
    if units.count() <= 1:
        raise LastUnit
    if use.products_using(unit_id) > 0:
        raise UnitInUse
    units.remove(unit_id)
    transaction.commit()
