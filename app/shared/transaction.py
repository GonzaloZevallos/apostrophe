"""The unit of work a use case closes (docs/adr/0001).

Repositories write but never commit; a use case that writes commits once, at its end,
so everything it did lands together or not at all. A SQLAlchemy `Session` satisfies
this protocol as it is.
"""

from typing import Protocol


class Transaction(Protocol):
    def commit(self) -> None: ...
