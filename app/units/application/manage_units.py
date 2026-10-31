from app.shared.unit import Unit
from app.units.application.ports import Units
from app.units.domain.unit import (
    DEFAULT_DECIMALS,
    DEFAULT_LABEL,
    DEFAULT_NAME,
    IMPORTED_DECIMALS,
    IMPORTED_LABEL,
    IMPORTED_NAME,
    UnitDraft,
    UnitLabel,
    UnitName,
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
