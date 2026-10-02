"""Alembic's environment. The app hands it a connection through
`config.attributes["connection"]` (app/migrations/runner.py). The `alembic` command
line, used only to generate a revision, gets one from `APOSTROPHE_DATABASE_URL`
instead (README, "Changing the schema")."""

import os
from logging.config import fileConfig
from typing import Literal

from alembic import context
from alembic.autogenerate.api import AutogenContext
from sqlalchemy.engine import Connection

from app.db import UtcDateTime, make_engine
from app.settings import DEFAULT_DATABASE_URL
from app.tables import metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def render_item(type_: str, obj: object, _context: AutogenContext) -> str | Literal[False]:
    # A custom column type is written as what it stores, so a revision never imports app code.
    if type_ == "type" and isinstance(obj, UtcDateTime):
        return "sa.DateTime()"
    return False


def run(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=metadata,
        render_item=render_item,
        # Batch mode: SQLite can only alter most things by copying the table.
        render_as_batch=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


injected = config.attributes.get("connection")
if injected is not None:
    run(injected)
else:
    url = os.environ.get("APOSTROPHE_DATABASE_URL", DEFAULT_DATABASE_URL)
    with make_engine(url).connect() as connection:
        run(connection)
        connection.commit()
