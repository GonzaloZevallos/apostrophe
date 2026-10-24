"""The back's copy: Babel/gettext catalogs behind typed seams (docs/adr/0050).

Babel is imported only under this package, and nothing here imports `app.settings`.
"""

from app.shared.copy.catalog import CopyCatalog, UnknownLanguage
from app.shared.copy.completeness import missing_keys
from app.shared.copy.messages import compile_po, mo_messages, po_messages

__all__ = [
    "CopyCatalog",
    "UnknownLanguage",
    "compile_po",
    "missing_keys",
    "mo_messages",
    "po_messages",
]
