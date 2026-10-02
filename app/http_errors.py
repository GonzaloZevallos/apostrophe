"""Translates the rules a request can break into the HTTP status that says so.

A class rather than `@contextmanager`: its `__exit__` returns `None`, which tells the
type checker it never swallows an exception, so a `return` inside the block still
counts as the function's return.
"""

from collections.abc import Sequence
from types import TracebackType

from fastapi import HTTPException


class TranslateErrors:
    def __init__(self, statuses: Sequence[tuple[int, tuple[type[Exception], ...]]]) -> None:
        # Checked in order, so a subclass listed first wins over its base listed later.
        self._statuses = statuses

    def __enter__(self) -> None:
        return None

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        for status, kinds in self._statuses:
            if isinstance(exc, kinds):
                raise HTTPException(status_code=status, detail=str(exc)) from exc
