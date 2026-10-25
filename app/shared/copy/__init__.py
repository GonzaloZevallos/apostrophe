"""The back's copy: Babel/gettext catalogs behind typed seams (docs/adr/0050).

Babel is imported only under this package, and nothing here imports `app.settings`.
"""

from app.shared.copy.catalog import CopyCatalog, UnknownLanguage
from app.shared.copy.completeness import missing_keys
from app.shared.copy.messages import (
    catalog_map,
    compile_po,
    mo_messages,
    po_messages,
    read_catalog,
)
from app.shared.copy.pseudo import po_text, pseudo_catalog
from app.shared.copy.report import missing_report

__all__ = [
    "CopyCatalog",
    "UnknownLanguage",
    "catalog_map",
    "compile_po",
    "missing_keys",
    "missing_report",
    "mo_messages",
    "po_messages",
    "po_text",
    "pseudo_catalog",
    "read_catalog",
]
