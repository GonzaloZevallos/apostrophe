"""What the pricing-settings hexagon refuses to invent."""

from __future__ import annotations


class PricingSettingsMissing(LookupError):
    """A business has no `pricing_settings` row. Every path that creates a business
    creates the row in the same commit (docs/adr/0031), so a missing row is a broken
    installation, never a business with default switches: nothing falls back to one.
    The message is fixed and names no business."""

    def __init__(self) -> None:
        super().__init__("the business has no pricing settings row")
