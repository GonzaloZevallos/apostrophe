"""The scheduler's share of cores for a check, read from the environment.

The system's check scheduler sets `CHECK_WORKERS` (and `PYTEST_XDIST_AUTO_NUM_WORKERS`) for
every gate it runs (agentic-system ADR-0070). Only a positive whole number counts; anything
else (unset, empty, text, zero, negative) means "no share" and each tool keeps its default.
Standard library only, so any script or conftest can import it.
"""

from __future__ import annotations

from collections.abc import Mapping

DEFAULT_PYTEST_WORKERS = 8


def positive_count(value: str | None) -> int | None:
    """`value` as a positive whole number, or None when it is anything else."""
    if value is None or not (value.isascii() and value.isdigit()):
        return None
    count = int(value)
    return count if count > 0 else None


def auto_workers(environ: Mapping[str, str], cpus: int) -> int:
    """The xdist worker count for `-n auto`: the xdist variable, else the share, else
    `min(8, cpus)`."""
    return (
        positive_count(environ.get("PYTEST_XDIST_AUTO_NUM_WORKERS"))
        or positive_count(environ.get("CHECK_WORKERS"))
        or min(DEFAULT_PYTEST_WORKERS, cpus)
    )
