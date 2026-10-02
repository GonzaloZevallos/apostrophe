"""Translates the rules a request can break into the HTTP status that says so.

A class rather than `@contextmanager`: its `__exit__` returns `None`, which tells the
type checker it never swallows an exception, so a `return` inside the block still
counts as the function's return.

Every exception a capability registers here carries a `code: ClassVar[str]`
(docs/adr/0007): a plain, namespaced string the front maps to its own Spanish text,
never derived from the class name, so a refactor does not change the contract.
"""

from collections.abc import Sequence
from types import TracebackType
from typing import ClassVar, Protocol, runtime_checkable

from fastapi import HTTPException


@runtime_checkable
class _Coded(Protocol):
    code: ClassVar[str]


class Refused(HTTPException):
    """An `HTTPException` that also carries the broken rule's `code` (docs/adr/0007).
    `app.main` answers it as `{"detail": ..., "code": ...}`."""

    def __init__(self, status_code: int, detail: str, code: str) -> None:
        super().__init__(status_code=status_code, detail=detail)
        self.code = code


class TranslateErrors:
    def __init__(self, statuses: Sequence[tuple[int, tuple[type[Exception], ...]]]) -> None:
        # Checked in order, so a subclass listed first wins over its base listed later.
        self._statuses = statuses

    def registered(self) -> list[tuple[int, type[Exception]]]:
        """Every `(status, class)` pair this translator checks, flattened. Read by
        `tests/test_refusal_codes.py` to walk each class's own subclasses and check they
        all carry a `code`, never by production code."""
        return [(status, kind) for status, kinds in self._statuses for kind in kinds]

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
                coded = exc if isinstance(exc, _Coded) else None
                code = coded.code if coded is not None else "unknown"
                raise Refused(status_code=status, detail=str(exc), code=code) from exc
