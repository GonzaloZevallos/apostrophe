"""`NoCommit` is the `Transaction` every owner write method gets during an import: its
commit does nothing, and a rollback through it is refused, since only `cli.run` owns
the real session."""

import pytest

from app.shared.transaction import Transaction
from app.spreadsheet_import.application.no_commit import NoCommit


def test_commit_does_nothing() -> None:
    transaction: Transaction = NoCommit()

    transaction.commit()


def test_a_rollback_through_an_owner_write_is_refused() -> None:
    transaction: Transaction = NoCommit()

    with pytest.raises(RuntimeError):
        transaction.rollback()
