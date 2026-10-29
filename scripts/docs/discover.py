"""Which `app/*` packages the generator draws a diagram for. Imports nothing from `app`."""

from __future__ import annotations

from pathlib import Path

EXCLUDED = frozenset({"migrations"})


def discover(app_dir: Path) -> list[str]:
    """The sorted direct subdirectories of `app_dir` with an `__init__.py`, minus `migrations`."""
    return sorted(
        child.name
        for child in app_dir.iterdir()
        if child.is_dir() and child.name not in EXCLUDED and (child / "__init__.py").is_file()
    )
