"""The committed OpenAPI document. The only generator module that imports `app`."""

from __future__ import annotations

import json

from fastapi import FastAPI
from sqlalchemy import create_engine

from app.main import create_app
from app.settings import Settings

DOCS_SECRET_KEY = "docs-export-not-a-secret"


def build_docs_app() -> FastAPI:
    """The app built with a fixed fake secret and an in-memory database; no server is started."""
    return create_app(
        Settings(secret_key=DOCS_SECRET_KEY),
        engine=create_engine("sqlite://"),
        upkeep_ticker=False,
    )


def export_openapi(app: FastAPI) -> str:
    """The app's OpenAPI document as stable text: sorted keys, indent 2, one final newline."""
    return json.dumps(app.openapi(), sort_keys=True, indent=2, ensure_ascii=False) + "\n"
