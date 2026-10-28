"""Chooses the newest daily backup copy, and lists the expired ones, from the text
`git ls-remote --heads <repo>` prints (lines `<sha>\\t<ref>`). Every copy is its own
branch, named exactly like its file: `backup-<UTC %Y%m%dT%H%M%SZ>-<run_id>.db.age`.

This module is the only place that knows the name format, the newest rule and the
30-day expiry rule. Only refs `refs/heads/<name>` whose name fully matches the format,
with a real calendar date, are copies; `main`, tags, foreign branches and impossible
dates are ignored silently. A line that is not `<sha>\\t<ref>` is a malformed listing.

Newest means the latest timestamp in the name, then the greater run_id, then the name
itself; the commit time is never read and the listing's order never matters. Run_ids
are ordered numerically from their digits and never through `int()`: leading zeros are
dropped, then the shorter number is the smaller, then the digits compare as text.

A copy is expired when it is more than 30 days older than `--now`; the newest copy is
never listed. The clock is never read: `--now` is always given.

CLI: no argument prints `name:`, `run_id:` and `created_at:` of the newest copy;
`expired --now <YYYYmmddTHHMMSSZ>` prints the expired names, oldest first. Exit 0 on
success, 1 when the listing holds no valid copy (in both modes, so an empty or failed
listing never reads as "nothing to delete"), 2 on a malformed listing, undecodable
stdin or bad arguments. Error messages are fixed and name no line content.

Standard library only: no import from `app`, no network call, no subprocess.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

# `backup-<UTC %Y%m%dT%H%M%SZ>-<run_id>.db.age` -- the one format the workflow, the
# README and this filter all share (the plan's invariant).
_NAME_PATTERN = re.compile(r"backup-(\d{8})T(\d{6})Z-(\d+)\.db\.age", re.ASCII)
_LINE_PATTERN = re.compile(r"[0-9a-f]{40}(?:[0-9a-f]{24})?\t(\S+)", re.ASCII)
_NOW_PATTERN = re.compile(r"(\d{8})T(\d{6})Z", re.ASCII)
_HEADS_PREFIX = "refs/heads/"
_RETENTION = timedelta(days=30)

_BAD_LISTING = "error: the listing is not lines of '<sha><TAB><ref>'"
_NO_VALID_COPY = "error: no valid backup copy found in the listing"
_BAD_NOW = "error: --now must be a UTC time like 20261031T040000Z"
_USAGE = "usage: newest_backup.py [expired --now <YYYYmmddTHHMMSSZ>] < listing"


class _Readable(Protocol):
    """Everything `main` needs from `stdin`: `sys.stdin` satisfies it, and so does a
    plain `io.StringIO` in a test -- no test needs a real file or terminal."""

    def read(self) -> str: ...


class MalformedListing(ValueError):
    """A line of the listing is not `<sha>\\t<ref>`."""


@dataclass(frozen=True)
class BackupCopy:
    name: str
    run_id: str  # the digits exactly as written in the name
    run_order: tuple[int, str]  # (length, digits) once leading zeros are dropped
    created_at: datetime


def _order_key(copy: BackupCopy) -> tuple[datetime, tuple[int, str], str]:
    return (copy.created_at, copy.run_order, copy.name)


def _utc_time(date_digits: str, time_digits: str) -> datetime:
    """Builds the UTC time from `YYYYmmdd` and `HHMMSS`; `ValueError` when it is not a
    real calendar time."""
    return datetime(
        int(date_digits[0:4]),
        int(date_digits[4:6]),
        int(date_digits[6:8]),
        int(time_digits[0:2]),
        int(time_digits[2:4]),
        int(time_digits[4:6]),
        tzinfo=UTC,
    )


def _copy_from_name(name: str) -> BackupCopy | None:
    matched = _NAME_PATTERN.fullmatch(name)
    if matched is None:
        return None
    try:
        created_at = _utc_time(matched.group(1), matched.group(2))
    except ValueError:
        return None
    run_id = matched.group(3)
    stripped = run_id.lstrip("0") or "0"
    return BackupCopy(
        name=name, run_id=run_id, run_order=(len(stripped), stripped), created_at=created_at
    )


def _parse(listing: str) -> list[BackupCopy]:
    """Every valid copy of `listing`, once per name. `MalformedListing` when a line is
    not `<sha>\\t<ref>`. The one parse behind `newest` and `expired`."""
    text = listing.removesuffix("\n")
    if text == "":
        return []
    copies: dict[str, BackupCopy] = {}
    for line in text.split("\n"):
        matched = _LINE_PATTERN.fullmatch(line)
        if matched is None:
            raise MalformedListing("a line is not '<sha><TAB><ref>'")
        ref = matched.group(1)
        if not ref.startswith(_HEADS_PREFIX):
            continue
        copy = _copy_from_name(ref.removeprefix(_HEADS_PREFIX))
        if copy is not None:
            copies[copy.name] = copy
    return list(copies.values())


def _newest_of(copies: list[BackupCopy]) -> BackupCopy | None:
    return max(copies, key=_order_key) if copies else None


def _expired_of(copies: list[BackupCopy], now: datetime) -> list[str]:
    latest = _newest_of(copies)
    old = [c for c in copies if c is not latest and now - c.created_at > _RETENTION]
    return [c.name for c in sorted(old, key=_order_key)]


def newest(listing: str) -> BackupCopy | None:
    """The newest valid copy of `listing`, or `None` when it holds none."""
    return _newest_of(_parse(listing))


def expired(listing: str, now: datetime) -> list[str]:
    """Names of the copies more than 30 days older than `now`, oldest first, never the
    newest copy of the same parse. A copy exactly 30 days old is kept. `[]` when the
    listing holds no copy at all."""
    return _expired_of(_parse(listing), now)


def _parse_now(value: str) -> datetime | None:
    matched = _NOW_PATTERN.fullmatch(value)
    if matched is None:
        return None
    try:
        return _utc_time(matched.group(1), matched.group(2))
    except ValueError:
        return None


def main(argv: list[str], stdin: _Readable) -> int:
    """Reads the listing from `stdin` and prints the newest copy (no argument) or the
    expired names (`expired --now <YYYYmmddTHHMMSSZ>`). Never raises on any input."""
    now: datetime | None = None
    if len(argv) == 3 and argv[0] == "expired" and argv[1] == "--now":
        now = _parse_now(argv[2])
        if now is None:
            print(_BAD_NOW, file=sys.stderr)
            return 2
    elif argv:
        print(_USAGE, file=sys.stderr)
        return 2
    try:
        copies = _parse(stdin.read())
    except (UnicodeDecodeError, MalformedListing):
        print(_BAD_LISTING, file=sys.stderr)
        return 2
    latest = _newest_of(copies)
    if latest is None:
        print(_NO_VALID_COPY, file=sys.stderr)
        return 1
    if now is not None:
        for name in _expired_of(copies, now):
            print(name)
        return 0
    print(f"name: {latest.name}")
    print(f"run_id: {latest.run_id}")
    print(f"created_at: {latest.created_at.isoformat()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:], sys.stdin))
