"""Every table in the product, imported so it registers on `Base.metadata`.

A capability that adds a table module adds it here. Migrations and the schema test
read the metadata through this module, so a table missing from this list is a table
no migration knows about, and the schema test fails.
"""

from sqlalchemy import MetaData

from app.accounts.adapters import tables as accounts_tables
from app.db import Base
from app.varieties.adapters import tables as varieties_tables

TABLE_MODULES = (accounts_tables, varieties_tables)

metadata: MetaData = Base.metadata
