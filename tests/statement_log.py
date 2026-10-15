"""A statement counter for the cost tests (docs/adr/0038): the SQL an engine runs while
a block executes, never the time it takes."""

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import event
from sqlalchemy.engine import Engine


@contextmanager
def captured_statements(engine: Engine) -> Iterator[list[tuple[str, object]]]:
    """Yields the `(statement, parameters)` pairs `engine` executes inside the block."""
    statements: list[tuple[str, object]] = []

    def _record(
        conn: object, cursor: object, statement: str, parameters: object, *args: object
    ) -> None:
        statements.append((statement, parameters))

    event.listen(engine, "before_cursor_execute", _record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", _record)
