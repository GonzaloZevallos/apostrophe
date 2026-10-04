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
from app.settings import DEFAULT_DATABASE_URL as APP_DEFAULT_DATABASE_URL
from scripts.drill import (
    DEFAULT_DATABASE_URL,
    RestoreTargetIsTheLiveDatabase,
    compare_counts,
    copy_age_warning,
    integrity,
    latest_change,
    resolve_live_database_url,
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

    report = restore_and_check(source, scratch, "sqlite:///does-not-exist.db")

    assert report.integrity == "ok"
    assert report.row_counts["payment"] == 1
    assert report.latest_change == NOW


def test_drills_own_default_matches_the_apps_default_database_url() -> None:
    # The two are duplicated on purpose (scripts/drill.py stays importable with no
    # `app` package on `sys.path`); this is the guard against the one drifting from
    # the other unnoticed.
    assert DEFAULT_DATABASE_URL == APP_DEFAULT_DATABASE_URL


def test_resolve_live_database_url_falls_back_to_the_apps_default_when_wholly_unset(
    tmp_path: Path,
) -> None:
    missing_dotenv = tmp_path / ".env"  # never written

    assert resolve_live_database_url({}, missing_dotenv) == DEFAULT_DATABASE_URL


def test_resolve_live_database_url_reads_the_dotenv_file_when_the_variable_is_unset(
    tmp_path: Path,
) -> None:
    dotenv = tmp_path / ".env"
    dotenv.write_text("APOSTROPHE_DATABASE_URL=sqlite:///from_dotenv.db\n")

    assert resolve_live_database_url({}, dotenv) == "sqlite:///from_dotenv.db"


def test_resolve_live_database_url_prefers_the_dotenv_file_over_the_real_environment(
    tmp_path: Path,
) -> None:
    # scripts/serve.sh sources .env *after* inheriting the shell's own environment
    # (`set -a; . ./.env; set +a`), so a .env assignment always overwrites a
    # pre-existing export of the same name — .env is what the app actually runs on.
    dotenv = tmp_path / ".env"
    dotenv.write_text("APOSTROPHE_DATABASE_URL=sqlite:///from_dotenv.db\n")
    env = {"APOSTROPHE_DATABASE_URL": "sqlite:///from_env.db"}

    assert resolve_live_database_url(env, dotenv) == "sqlite:///from_dotenv.db"


def test_resolve_live_database_url_falls_back_to_the_environment_when_dotenv_is_silent(
    tmp_path: Path,
) -> None:
    dotenv = tmp_path / ".env"
    dotenv.write_text("SOME_OTHER_SETTING=1\n")
    env = {"APOSTROPHE_DATABASE_URL": "sqlite:///from_env.db"}

    assert resolve_live_database_url(env, dotenv) == "sqlite:///from_env.db"


def test_resolve_live_database_url_reads_an_exported_quoted_dotenv_assignment(
    tmp_path: Path,
) -> None:
    # A .env written the way a human reaches for first (`export NAME="value"`) must
    # not be read as silent — that would fall back to the default and fail open.
    dotenv = tmp_path / ".env"
    dotenv.write_text('export APOSTROPHE_DATABASE_URL="sqlite:///from_dotenv.db"\n')

    assert resolve_live_database_url({}, dotenv) == "sqlite:///from_dotenv.db"


def test_restoring_into_the_default_database_is_refused_when_the_variable_is_unset(
    source: Path, tmp_path: Path
) -> None:
    # The blocking case the previous review found: `APOSTROPHE_DATABASE_URL` unset
    # in the drill's own shell is exactly the shell the app itself runs in when
    # nobody set it — it then falls back to `Settings`' own default, a *relative*
    # path, resolved against the app's own working directory (`app_root` here).
    app_root = tmp_path
    live = app_root / "apostrophe.db"
    resolved = resolve_live_database_url({}, app_root / ".env")

    with pytest.raises(RestoreTargetIsTheLiveDatabase):
        restore_and_check(source, live, resolved, app_root=app_root)


def test_restoring_into_the_live_database_named_only_in_dotenv_is_refused(
    source: Path, tmp_path: Path
) -> None:
    app_root = tmp_path
    dotenv = app_root / ".env"
    dotenv.write_text("APOSTROPHE_DATABASE_URL=sqlite:///from_dotenv.db\n")
    live = app_root / "from_dotenv.db"
    resolved = resolve_live_database_url({}, dotenv)

    with pytest.raises(RestoreTargetIsTheLiveDatabase):
        restore_and_check(source, live, resolved, app_root=app_root)


def test_restoring_into_the_dotenv_database_is_refused_though_the_environment_names_another(
    source: Path, tmp_path: Path
) -> None:
    # The case the previous review found failing open: the shell's own
    # APOSTROPHE_DATABASE_URL and .env's disagree, and .env is the one the running
    # app actually ends up on (serve.sh sources .env last). A drill that trusted the
    # shell's value here would accept a target that is, in fact, the live database.
    app_root = tmp_path
    dotenv = app_root / ".env"
    dotenv.write_text("APOSTROPHE_DATABASE_URL=sqlite:///from_dotenv.db\n")
    env = {"APOSTROPHE_DATABASE_URL": "sqlite:///from_env.db"}
    live = app_root / "from_dotenv.db"
    resolved = resolve_live_database_url(env, dotenv)

    with pytest.raises(RestoreTargetIsTheLiveDatabase):
        restore_and_check(source, live, resolved, app_root=app_root)


def test_a_scratch_path_elsewhere_is_still_accepted_once_the_variable_is_unset(
    source: Path, tmp_path: Path
) -> None:
    app_root = tmp_path / "repo"
    app_root.mkdir()
    scratch = tmp_path / "scratch.db"
    resolved = resolve_live_database_url({}, app_root / ".env")

    report = restore_and_check(source, scratch, resolved, app_root=app_root)

    assert report.integrity == "ok"
