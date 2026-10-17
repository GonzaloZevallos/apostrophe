"""The customer's channel is gone for good (ADR-0047): no file under `app/customers/**`
carries the word `channel`, in any case. The scan covers that tree only; colour-channel
helpers, `MessageChannel` and `pinned_catalog.channel_chat` live elsewhere and are not the
customer's field."""

from __future__ import annotations

import re
from collections.abc import Iterable
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CUSTOMERS_ROOT = REPO_ROOT / "app" / "customers"
CHANNEL = re.compile(r"\bchannel\b", re.IGNORECASE)


def files_mentioning_channel(root: Path) -> list[str]:
    """The files under `root` (every `.py`, compiled caches aside), as paths relative to
    `root`, with a line that holds the word `channel`."""
    offenders: list[str] = []
    for path in sorted(_source_files(root)):
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            if CHANNEL.search(line):
                offenders.append(f"{path.relative_to(root).as_posix()}:{number}")
    return offenders


def _source_files(root: Path) -> Iterable[Path]:
    return (path for path in root.rglob("*.py") if "__pycache__" not in path.parts)


def test_no_file_under_app_customers_mentions_channel() -> None:
    assert CUSTOMERS_ROOT.is_dir()
    assert files_mentioning_channel(CUSTOMERS_ROOT) == []


def test_the_scan_rejects_a_file_that_mentions_channel(tmp_path: Path) -> None:
    package = tmp_path / "adapters"
    package.mkdir()
    (package / "clean.py").write_text("phone = 1\nchannels_total = 2\n")
    (package / "dirty.py").write_text("x = 1\nchannel: str | None = None\n")
    (package / "loud.py").write_text("# the Channel\n")

    assert files_mentioning_channel(tmp_path) == ["adapters/dirty.py:2", "adapters/loud.py:1"]
