"""The port the removal reads and deletes a business's rows through: everything it
needs from storage, over whatever tables the live schema holds, never a hand-kept
list (the plan's invariant).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol

from app.business_removal.domain.business_ref import BusinessRef
from app.business_removal.domain.schema import Schema


@dataclass(frozen=True)
class DeletedIds:
    """What one delete pass removed. `tables` holds the deleted id set for every
    exported table (`business` included), the only ones later compared against the
    export file read back from disk. `withheld_counts` holds, for every withheld
    table with its own `business_id` (`invitation`, `reset_link`), how many rows were
    deleted -- never exported, so counted rather than kept as an id set.
    `login_guard_count` stays its own field: `login_guard` is withheld too but has no
    `business_id` of its own, so it is deleted and counted by email, not by this
    pass's `business_id` at all."""

    tables: dict[str, frozenset[int]]
    withheld_counts: Mapping[str, int]
    login_guard_count: int


class SchemaRows(Protocol):
    """Reads and deletes one business's rows. Every method that touches rows takes
    the business id explicitly: the removal runs outside any request, so there is no
    session to read it from (CODING_STANDARDS section 9's rule, applied the only way
    it can be here). Writes are never committed; the caller commits once, through
    `app.shared.transaction.Transaction`, after everything checks out.
    """

    def schema(self) -> Schema: ...

    def business_of(self, email: str) -> BusinessRef | None:
        """The business of any of its users, found from `email` trimmed and
        lowercased as at login. `None` if no user has that email."""
        ...

    def rows(self, table: str, business_id: int) -> list[dict[str, object]]:
        """Every row of `table` belonging to `business_id` (filtered by `id` for the
        `business` table itself), sorted by `id`. Values are `int`, `str`, `bool`,
        `date`, naive-UTC `datetime` or `None`."""
        ...

    def withheld_count(self, table: str, business_id: int) -> int:
        """How many rows of `table` -- a withheld table with its own `business_id`
        (`invitation`, `reset_link`) -- belong to `business_id`, for the dry run's
        own "deleted only" line. Read-only; never deletes anything."""
        ...

    def delete_business(self, business_id: int, order: tuple[str, ...]) -> DeletedIds:
        """Deletes every row of `business_id` from the tables in `order`
        (`DELETE ... WHERE business_id = :id RETURNING id`, `business` by `id`), then
        the `login_guard` rows of exactly the emails `app_user`'s delete returned.
        Never commits."""
        ...
