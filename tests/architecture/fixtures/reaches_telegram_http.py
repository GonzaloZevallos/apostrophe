"""A deliberate violation of the plan's own invariant ("no test constructs the real
Telegram adapter except its own unit test"): this module is never imported, only
parsed by `tests/architecture/test_architecture.py`'s own checker, the same way
`fixtures/bad_hexagon` stands in for a hexagon that breaks the import rules.
"""

import app.pinned_catalog.adapters.telegram_http
from app.pinned_catalog.adapters import telegram_http

__all__ = ["app", "telegram_http"]
