"""Copies every table from the configured database into a fresh local SQLite file,
for the daily backup workflow (`.github/workflows/backup.yml`).

A read-only Turso database token authenticates libSQL's own client protocol, not the
`turso` CLI's `db shell .dump` command, which needs an account-level login
(`turso auth login`) rather than a per-database token — so the dump this workflow
needs is taken here instead, a table at a time, over the same protocol the app itself
would use (`deploy/README.md` cites this).

Standalone from `app.db`: this runs in CI, against whatever driver the configured URL
names, with its auth token always passed as a connect argument, never folded into the
URL (the plan's invariant, so a leaked log line never carries it).
"""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine, create_engine


COPY_FAILED = "error: the copy failed; see the restore drill section of deploy/README.md"


class MissingSetting(RuntimeError):
    def __init__(self, name: str) -> None:
        super().__init__(f"{name} is not set")


def _env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise MissingSetting(name)
    return value


def source_engine() -> Engine:
    """The database to copy from, read from the environment the same way the app
    reads `APOSTROPHE_DATABASE_URL` (`app/settings.py`); the auth token, when set, is
    always a connect argument, never appended to the URL."""
    url = _env("APOSTROPHE_DATABASE_URL")
    token = os.environ.get("APOSTROPHE_DATABASE_AUTH_TOKEN", "")
    connect_args = {"auth_token": token} if token else {}
    return create_engine(url, connect_args=connect_args)


def copy_tables(source: Engine, destination_path: Path) -> None:
    """Every table the source holds, schema and rows, written fresh into
    `destination_path` (a local SQLite file; any existing file there is replaced)."""
    destination_path.unlink(missing_ok=True)
    destination = sqlite3.connect(destination_path)
    try:
        with source.connect() as connection:
            inspector = inspect(connection)
            for table in inspector.get_table_names():
                columns = [column["name"] for column in inspector.get_columns(table)]
                column_list = ", ".join(f'"{name}"' for name in columns)
                destination.execute(f'CREATE TABLE "{table}" ({column_list})')
                select_statement = text(f'SELECT * FROM "{table}"')
                rows = connection.execute(select_statement).fetchall()
                if rows:
                    placeholders = ", ".join("?" for _ in columns)
                    destination.executemany(
                        f'INSERT INTO "{table}" VALUES ({placeholders})',
                        [tuple(row) for row in rows],
                    )
        destination.commit()
    finally:
        destination.close()


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: backup_copy.py <destination.db>", file=sys.stderr)
        return 2
    try:
        copy_tables(source_engine(), Path(argv[0]))
    except Exception:
        # Unbound and not chained on purpose: the library's own message can quote the
        # database URL, and this runs in a public CI log (CODING_STANDARDS §9).
        print(COPY_FAILED, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
