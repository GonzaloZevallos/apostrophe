"""The one archived-variety check of stock's use cases (docs/adr/0032).

Nothing new is recorded against an archived variety, but a record that already names it
stays workable (docs/adr/0009): `keeps` says the caller's record already had it. Every use
case that needs this check calls `require_usable`; none reads the catalog's `usable`
itself.
"""

from __future__ import annotations

from app.stock.application.errors import VarietyArchived
from app.stock.application.ports import VarietyCatalog


def require_usable(catalog: VarietyCatalog, variety_id: int, *, keeps: bool) -> None:
    """Raises stock's internal `VarietyArchived` when the variety is archived and the
    record does not already keep it. The caller has checked that the variety exists."""
    if not keeps and not catalog.usable(variety_id):
        raise VarietyArchived(variety_id)
