"""The negative control for `reaches_telegram_http.py`: a module that imports
something else entirely from the same hexagon, so the checker is proven not to flag
every import, only the one the plan forbids. Never imported, only parsed."""

from app.pinned_catalog.domain import bold

__all__ = ["bold"]
