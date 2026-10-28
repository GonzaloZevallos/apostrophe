"""What `paracelsus graph scripts.docs.er_base:ErBase` reads: the metadata of `app.tables`.

paracelsus wants an object with a `metadata` attribute, and `app.tables` exposes the
`MetaData` itself. This shim is the one place besides `openapi_export` that imports `app`.
The generator never imports this module; the paracelsus subprocess does.
"""

from __future__ import annotations

from typing import ClassVar

from sqlalchemy import MetaData

from app.tables import metadata as app_metadata


class ErBase:
    """Carries the product's tables for paracelsus."""

    metadata: ClassVar[MetaData] = app_metadata
