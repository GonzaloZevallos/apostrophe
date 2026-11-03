"""Restores a database copy into a scratch path and proves it intact — integrity, row
counts and recency — with no effect on the running app (PRD criterion 3).

Pure functions over plain SQLite file paths, imported straight into
`tests/deploy/test_drill.py`; the CLI (`main`) is a thin wrapper that refuses a
scratch target equal to the app's own configured database.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import sys
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOTENV_PATH = REPO_ROOT / ".env"
# `app/settings.py`'s own `DEFAULT_DATABASE_URL`, duplicated rather than imported:
# this script stays standalone from `app` (the same choice `scripts/backup_copy.py`
# makes), since it must also run from a plain CLI invocation with no package on
# `sys.path` beyond its own directory.
DEFAULT_DATABASE_URL = "sqlite:///./apostrophe.db"

# Exactly the tables whose loss the restore drill exists to bound (PRD criterion 3):
# `recorded_at` elsewhere (a catalog edit, say) says nothing about lost work.
RECENCY_TABLES = ("sale", "payment", "stock_entry", "expense")
COPY_AGE_WARNING_DAYS = 2
COPY_AGE_WARNING = "la copia diaria más nueva tiene más de 2 días"


class RestoreTargetIsTheLiveDatabase(RuntimeError):
    pass


@dataclass(frozen=True)
class DrillReport:
    integrity: str
    row_counts: dict[str, int]
    latest_change: datetime | None


def integrity(db_path: Path) -> str:
    """`"ok"` when the file is sound; otherwise the first problem SQLite reports."""
    connection = sqlite3.connect(db_path)
    try:
        row = connection.execute("PRAGMA integrity_check").fetchone()
    finally:
        connection.close()
    return str(row[0]) if row is not None else "no result"


def row_counts(db_path: Path) -> dict[str, int]:
    """Every table's row count, `alembic_version` included."""
    connection = sqlite3.connect(db_path)
    try:
        tables = [
            name
            for (name,) in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
        ]
        return {
            table: connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            for table in sorted(tables)
        }
    finally:
        connection.close()


def latest_change(db_path: Path) -> datetime | None:
    """The newest `recorded_at` over exactly `sale`, `payment`, `stock_entry` and
    `expense` — the loss the drill's recency field bounds."""
    connection = sqlite3.connect(db_path)
    try:
        placeholders = ", ".join("?" for _ in RECENCY_TABLES)
        existing = {
            name
            for (name,) in connection.execute(
                f"SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ({placeholders})",
                RECENCY_TABLES,
            ).fetchall()
        }
        latest: datetime | None = None
        for table in RECENCY_TABLES:
            if table not in existing:
                continue
            value = connection.execute(f'SELECT MAX(recorded_at) FROM "{table}"').fetchone()[0]
            if value is None:
                continue
            parsed = datetime.fromisoformat(value).replace(tzinfo=UTC)
            if latest is None or parsed > latest:
                latest = parsed
        return latest
    finally:
        connection.close()


def compare_counts(a: dict[str, int], b: dict[str, int]) -> list[str]:
    """The tables whose row count differs between two copies, named only — never a
    count or a row (CODING_STANDARDS section 9's principle, applied to backups too)."""
    tables = sorted(set(a) | set(b))
    return [table for table in tables if a.get(table) != b.get(table)]


def copy_age_warning(latest_copy: datetime, now: datetime) -> str | None:
    """The PRD's fallback bound (one day) has real slack before it bites; this warns
    once the daily copy itself is stale, well before that bound is at risk."""
    age_days = (now - latest_copy).total_seconds() / 86400
    return COPY_AGE_WARNING if age_days > COPY_AGE_WARNING_DAYS else None


def _sqlite_path(database_url: str, base_dir: Path) -> Path | None:
    """The file a `sqlite:///` URL names, relative paths resolved against `base_dir` —
    the same directory `scripts/serve.sh` `cd`s to before the app ever reads
    `APOSTROPHE_DATABASE_URL`, so a relative URL here names the same file it would
    there."""
    prefix = "sqlite:///"
    if database_url.startswith(prefix):
        path = Path(database_url[len(prefix) :])
        if not path.is_absolute():
            path = base_dir / path
        return path.resolve()
    return None


def _load_dotenv(path: Path) -> dict[str, str]:
    """A minimal `.env` reader, the same shape `scripts/serve.sh` sources (`set -a; .
    ./.env; set +a`): `KEY=VALUE` lines, an optional leading `export `, blank lines
    and `#` comments skipped. A value wrapped in matching single or double quotes has
    them stripped, the same as the shell would; an unwrapped value is taken as-is."""
    if not path.is_file():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        if stripped.startswith("export "):
            stripped = stripped[len("export ") :]
        key, _, value = stripped.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        values[key.strip()] = value
    return values


def resolve_live_database_url(env: Mapping[str, str], dotenv_path: Path) -> str:
    """The database URL the running app would actually use, in the same order
    `scripts/serve.sh` gives it precedence: `.env` first — sourcing it with `set -a;
    . ./.env; set +a` makes any assignment there overwrite a pre-existing export of
    the same name — then the real environment (whatever `.env` left untouched), then
    `Settings`' own default (`app/settings.py`'s `DEFAULT_DATABASE_URL`). Unset or
    empty counts the same as absent — the app falls back to the default either way,
    and so must the drill's refusal, or it fails open exactly there (the case this
    function closes)."""
    from_dotenv = _load_dotenv(dotenv_path).get("APOSTROPHE_DATABASE_URL", "")
    if from_dotenv:
        return from_dotenv
    from_env = env.get("APOSTROPHE_DATABASE_URL", "")
    if from_env:
        return from_env
    return DEFAULT_DATABASE_URL


def restore_and_check(
    source: Path,
    target: Path,
    configured_database_url: str,
    *,
    app_root: Path = REPO_ROOT,
) -> DrillReport:
    """Copies `source` into the scratch `target` and reports on it — never on the
    running app's own database (PRD criterion 3: no effect on it). `app_root` is where
    a relative `configured_database_url` is resolved from; it defaults to this
    repository's root, the directory `scripts/serve.sh` runs the app from."""
    configured_path = _sqlite_path(configured_database_url, app_root)
    if configured_path is not None and target.resolve() == configured_path:
        raise RestoreTargetIsTheLiveDatabase(str(target))
    shutil.copyfile(source, target)
    return DrillReport(
        integrity=integrity(target),
        row_counts=row_counts(target),
        latest_change=latest_change(target),
    )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="the backup copy to restore")
    parser.add_argument("target", type=Path, help="the scratch path to restore it into")
    args = parser.parse_args(argv)

    configured_url = resolve_live_database_url(os.environ, DEFAULT_DOTENV_PATH)
    report = restore_and_check(args.source, args.target, configured_url)
    print(f"integrity: {report.integrity}")
    print(f"row counts: {report.row_counts}")
    print(f"latest change: {report.latest_change}")
    if report.latest_change is not None:
        warning = copy_age_warning(report.latest_change, datetime.now(UTC))
        if warning is not None:
            print(warning)
    return 0 if report.integrity == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
