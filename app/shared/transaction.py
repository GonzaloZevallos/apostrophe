"""The unit of work a use case closes (docs/adr/0001).

Repositories write but never commit; a use case that writes commits once, at its end,
so everything it did lands together or not at all. A SQLAlchemy `Session` satisfies
this protocol as it is.

`rollback` is for a use case that may find, after writing, that it must undo
everything instead of committing (business removal, for one): the alternative to one
commit is one rollback, never a partial, uncommitted write left standing.
"""

from typing import Protocol


class Transaction(Protocol):
    def commit(self) -> None: ...

    def rollback(self) -> None: ...
