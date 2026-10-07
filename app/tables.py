"""Every table in the product, imported so it registers on `Base.metadata`.

A capability that adds a table module adds it here. Migrations and the schema test
read the metadata through this module, so a table missing from this list is a table
no migration knows about, and the schema test fails.
"""

from sqlalchemy import MetaData

from app.accounts.adapters import tables as accounts_tables
from app.catalog.adapters import tables as catalog_tables
from app.customers.adapters import tables as customers_tables
from app.db import Base
from app.expenses.adapters import tables as expenses_tables
from app.onboarding.adapters import tables as onboarding_tables
from app.payments.adapters import tables as payments_tables
from app.pinned_catalog.adapters import tables as pinned_catalog_tables
from app.pricing_settings.adapters import tables as pricing_settings_tables
from app.sales.adapters import tables as sales_tables
from app.stock.adapters import tables as stock_tables
from app.varieties.adapters import tables as varieties_tables

TABLE_MODULES = (
    accounts_tables,
    varieties_tables,
    customers_tables,
    expenses_tables,
    sales_tables,
    stock_tables,
    catalog_tables,
    payments_tables,
    pinned_catalog_tables,
    onboarding_tables,
    pricing_settings_tables,
)

metadata: MetaData = Base.metadata
