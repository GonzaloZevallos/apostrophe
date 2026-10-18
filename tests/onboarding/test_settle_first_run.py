"""`settle_first_run` (docs/adr/0046): writes the due stamps and commits once, at its
end; it refuses `imported_at`, which only the import writes."""

from datetime import UTC, datetime

import pytest

from app.onboarding.application.first_run import settle_first_run
from app.onboarding.domain.first_run import Stamp
from tests.onboarding.fakes import FakeFirstRuns, FakeTransaction

NOW = datetime(2026, 10, 2, 9, 0, tzinfo=UTC)


def test_every_due_stamp_is_written_at_now_with_one_commit() -> None:
    first_runs, transaction = FakeFirstRuns(), FakeTransaction()

    settle_first_run(
        frozenset({Stamp.IMPORT_NOTICE_OVER, Stamp.CHECKLIST_GONE}), NOW, first_runs, transaction
    )

    assert first_runs.stamps == {Stamp.CHECKLIST_GONE: NOW, Stamp.IMPORT_NOTICE_OVER: NOW}
    assert first_runs.writes == [Stamp.CHECKLIST_GONE, Stamp.IMPORT_NOTICE_OVER]
    assert (transaction.commits, transaction.rollbacks) == (1, 0)


def test_a_stamp_already_set_keeps_its_first_instant() -> None:
    first_runs, transaction = FakeFirstRuns(), FakeTransaction()
    first_runs.stamp(Stamp.CHECKLIST_GONE, datetime(2026, 9, 1, tzinfo=UTC))

    settle_first_run(frozenset({Stamp.CHECKLIST_GONE}), NOW, first_runs, transaction)

    assert first_runs.stamps[Stamp.CHECKLIST_GONE] == datetime(2026, 9, 1, tzinfo=UTC)


def test_imported_at_is_refused_before_anything_is_written() -> None:
    first_runs, transaction = FakeFirstRuns(), FakeTransaction()

    with pytest.raises(ValueError, match="import alone"):
        settle_first_run(
            frozenset({Stamp.CHECKLIST_GONE, Stamp.IMPORTED}), NOW, first_runs, transaction
        )

    assert first_runs.writes == []
    assert transaction.commits == 0
