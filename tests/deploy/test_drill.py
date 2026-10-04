"""The restore drill's pure functions, over temp files migrated with `upgrade_to_head`
(PRD criterion 3): integrity, row counts, latest change, the count comparison, the
scratch-target refusal and the copy-age warning.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.accounts.adapters.tables import BusinessRow
from app.db import make_engine
from app.expenses.adapters.tables import ExpenseCategoryRow, ExpenseRow
from app.migrations.runner import upgrade_to_head
from app.payments.adapters.tables import PaymentRow
from scripts.drill import (
    RestoreTargetIsTheLiveDatabase,
    compare_counts,
    copy_age_warning,
    integrity,
    latest_change,
    restore_and_check,
    row_counts,
)

NOW = datetime(2026, 10, 4, 12, 0, tzinfo=UTC)


def _migrated_file(path: Path) -> None:
    engine = make_engine(f"sqlite:///{path}")
    upgrade_to_head(engine)
    engine.dispose()


def _seed(path: Path, *, payment_at: datetime, expense_at: datetime) -> None:
    engine = make_engine(f"sqlite:///{path}")
    with Session(engine) as session:
        business = BusinessRow(name="Vivero Sur")
        session.add(business)
        session.flush()
        category = ExpenseCategoryRow(business_id=business.id, name="Flete", name_key="flete")
        session.add(category)
        session.flush()
        session.add(
            PaymentRow(
                business_id=business.id,
                paid_on=payment_at.date(),
                amount=1000,
                method="cash",
                recorded_at=payment_at,
            )
        )
        session.add(
            ExpenseRow(
                business_id=business.id,
                category_id=category.id,
                spent_on=expense_at.date(),
                amount=500,
                detail="Flete semanal",
                recorded_at=expense_at,
            )
        )
        session.commit()
    engine.dispose()


@pytest.fixture
def source(tmp_path: Path) -> Path:
    path = tmp_path / "source.db"
    _migrated_file(path)
    _seed(path, payment_at=NOW, expense_at=datetime(2026, 10, 3, 9, 0, tzinfo=UTC))
    return path


def test_integrity_reports_ok_over_a_sound_migrated_file(source: Path) -> None:
    assert integrity(source) == "ok"


def test_row_counts_names_every_table_alembic_version_included(source: Path) -> None:
    counts = row_counts(source)

    assert counts["alembic_version"] == 1
    assert counts["payment"] == 1
    assert counts["expense"] == 1
    assert counts["business"] == 1


def test_latest_change_is_the_newest_recorded_at_across_the_four_tables(source: Path) -> None:
    assert latest_change(source) == NOW


def test_compare_counts_is_empty_when_two_copies_agree(source: Path) -> None:
    counts = row_counts(source)

    assert compare_counts(counts, dict(counts)) == []


def test_compare_counts_names_only_the_table_that_is_one_row_off(source: Path) -> None:
    counts = row_counts(source)
    behind = dict(counts)
    behind["payment"] = behind["payment"] - 1

    assert compare_counts(counts, behind) == ["payment"]


def test_the_warning_holds_its_tongue_at_exactly_two_days() -> None:
    latest_copy = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
    now = datetime(2026, 10, 3, 12, 0, tzinfo=UTC)

    assert copy_age_warning(latest_copy, now) is None


def test_the_warning_speaks_once_the_copy_is_more_than_two_days_old() -> None:
    latest_copy = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
    now = datetime(2026, 10, 3, 12, 0, 1, tzinfo=UTC)

    assert copy_age_warning(latest_copy, now) == "la copia diaria más nueva tiene más de 2 días"


def test_restoring_into_the_configured_live_database_is_refused(
    source: Path, tmp_path: Path
) -> None:
    live = tmp_path / "live.db"

    with pytest.raises(RestoreTargetIsTheLiveDatabase):
        restore_and_check(source, live, f"sqlite:///{live}")


def test_restoring_into_a_genuine_scratch_path_reports_the_three_fields(
    source: Path, tmp_path: Path
) -> None:
    scratch = tmp_path / "scratch.db"

    report = restore_and_check(source, scratch, "sqlite:///./apostrophe.db")

    assert report.integrity == "ok"
    assert report.row_counts["payment"] == 1
    assert report.latest_change == NOW
