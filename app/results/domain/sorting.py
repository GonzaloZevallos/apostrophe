"""The panel's own orderings (PRD: "Te deben block", "Lo que te queda"; plan
invariant: every ordering of customers or varieties by name uses `fold`, in Python).

Pure and generic over structural protocols rather than `app.results.application`'s
dataclasses: `domain/` never imports `application/` (CODING_STANDARDS section 1), even
within the same hexagon, so these take anything shaped the right way — `DebtorRow` and
`StockRow` (`app/results/application/ports.py`) both already are.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date
from typing import Protocol

from app.shared.names import fold

TEASER_SIZE = 3


class _NamedDebt(Protocol):
    # Read-only (`@property`), not plain attributes: `DebtorRow`
    # (`app/results/application/ports.py`) is a frozen dataclass, whose fields mypy
    # treats as read-only — a plain, writable attribute here would reject it.
    @property
    def customer_id(self) -> int: ...
    @property
    def name(self) -> str: ...
    @property
    def balance(self) -> int: ...
    @property
    def owing_since(self) -> date: ...


def teaser[D: _NamedDebt](debtors: Sequence[D]) -> tuple[D, ...]:
    """Re-sorted by balance (highest first), ties by owing since (oldest first), then
    `fold`ed name, then id — and cut to `TEASER_SIZE` (plan: subtask brief). The
    caller's own order (oldest debt first) is never assumed here."""
    ordered = sorted(
        debtors, key=lambda d: (-d.balance, d.owing_since, fold(d.name), d.customer_id)
    )
    return tuple(ordered[:TEASER_SIZE])


def oldest(debtors: Sequence[_NamedDebt]) -> date | None:
    """The first debtor's `owing_since` in the given order (`debtors()`'s own: oldest
    debt first), or `None` with nobody owing. Never re-sorts: `debtors()` already
    answers oldest-first (payments-domain)."""
    return debtors[0].owing_since if debtors else None


class _NamedVariety(Protocol):
    # Read-only, for the same reason as `_NamedDebt` above: `StockRow` is frozen too.
    @property
    def variety_id(self) -> int: ...
    @property
    def name(self) -> str: ...


def sorted_by_name[S: _NamedVariety](rows: Sequence[S]) -> tuple[S, ...]:
    """Every variety, by `fold`ed name then id, ties broken deterministically (plan:
    subtask brief: "stock rows sorted by (fold(name), variety_id)")."""
    return tuple(sorted(rows, key=lambda r: (fold(r.name), r.variety_id)))
