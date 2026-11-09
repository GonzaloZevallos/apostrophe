"""The port the removal reads a business's money storage through: the scale its amount
columns are stored at and the decimals it shows (docs/adr/0058). The export states both
beside the tables, so the stored integers it holds can be read back as the amounts the
business entered. Implemented by `app/money_format/adapters`, the only hexagon that reads
that table (docs/adr/0034)."""

from __future__ import annotations

from typing import Protocol

from app.business_removal.domain.export_document import ExportedMoney


class MoneyFormatRead(Protocol):
    def of(self, business_id: int) -> ExportedMoney:
        """The business's `{scale, decimals}`, read in the transaction that reads its
        rows. Raises when the business has no money format: an export without it could not
        be read back."""
        ...
