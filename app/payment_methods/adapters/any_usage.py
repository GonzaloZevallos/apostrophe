"""The one rule for "in use": a method is in use when any source says it is
(docs/adr/20261124-a-payment-method-is-in-use-when-any-payment-or-expense-points-at-it).

The sources are the adapters of the hexagons whose tables point at `payment_method`;
`app/main.py` wires them, so this module imports only the port and never `app.payments`
or `app.expenses`. Each source filters on its own business."""

from collections.abc import Sequence

from app.payment_methods.application.ports import PaymentMethodUsage


class AnyUsage:
    def __init__(self, sources: Sequence[PaymentMethodUsage]) -> None:
        self._sources = tuple(sources)

    def in_use_among(self, method_ids: Sequence[int]) -> frozenset[int]:
        if not method_ids:
            return frozenset()
        in_use: set[int] = set()
        for source in self._sources:
            in_use |= source.in_use_among(method_ids)
        return frozenset(in_use)
