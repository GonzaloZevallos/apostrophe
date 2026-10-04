"""The `Transaction` every owner write method is called with (the plan's invariant:
owner write methods receive the `Transaction` from the caller and are only ever
called with `NoCommit`; nothing in the import commits except `cli.run`, once, at the
end of a real run, through the real session directly — never through an owner's
write method).
"""

from __future__ import annotations


class NoCommit:
    """A `Transaction` (`app/shared/transaction.py`) whose `commit` does nothing. An
    owner's write method never needs to know whether it is being called to build the
    report or to actually write: either way it gets `NoCommit`, and only
    `write_import.py`'s caller commits the real session once, at the end."""

    def commit(self) -> None:
        pass

    def rollback(self) -> None:
        # `Transaction` gained `rollback` for business removal (docs/adr/0015). No owner
        # write method may undo the import half-way: only `cli.run` owns the real
        # session, so a rollback through here is a bug, never a silent no-op.
        raise RuntimeError("an owner write method must not roll back the import")
