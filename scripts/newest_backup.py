"""Chooses the newest daily backup copy from a GitHub Actions artifact listing, so
every restore path (`deploy/README.md` section 6) and the go-live gate (section 8)
pick the same copy -- never `gh run list` (the plan's invariant: the newest copy is
chosen only here).

Standard library only: no import from `app`, no network call, no subprocess. The CLI
reads the listing from stdin -- the text `gh api
"repos/{owner}/{repo}/actions/artifacts?per_page=100"` prints -- and never calls `gh`
itself.
"""

from __future__ import annotations

import json
import re
import sys
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

# `backup-<UTC %Y%m%dT%H%M%SZ>-<run_id>.db.age` -- the one format the workflow, the
# README and this filter all share (the plan's invariant).
_NAME_PATTERN = re.compile(r"^backup-\d{8}T\d{6}Z-\d+\.db\.age$")


class _Readable(Protocol):
    """Everything `main` needs from `stdin`: `sys.stdin` satisfies it, and so does a
    plain `io.StringIO` in a test -- no test needs a real file or terminal."""

    def read(self) -> str: ...

_BAD_LISTING = "error: the artifact listing is not a JSON object with an 'artifacts' list"
_NO_VALID_ARTIFACT = "error: no valid backup artifact found in the listing"


class InvalidArtifactListing(ValueError):
    """`listing` is not a mapping, or its `artifacts` entry is missing or not a list."""


@dataclass(frozen=True)
class NewestArtifact:
    name: str
    run_id: int
    created_at: datetime


def _parse_created_at(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None or parsed.tzinfo.utcoffset(parsed) is None:
        return None
    return parsed.astimezone(UTC)


def _valid_artifact(entry: object) -> tuple[str, int, int, datetime] | None:
    """`(name, artifact_id, run_id, created_at)` for an entry that passes every
    check, else `None`. The artifact's own `id` travels through only to break a tie
    on `created_at`; it never appears in `NewestArtifact` itself."""
    if not isinstance(entry, Mapping):
        return None
    name = entry.get("name")
    if not isinstance(name, str) or not _NAME_PATTERN.fullmatch(name):
        return None
    if entry.get("expired") is not False:
        return None
    artifact_id = entry.get("id")
    # `True`/`False` are `int` in Python; an artifact or run id is never a bool.
    if not isinstance(artifact_id, int) or isinstance(artifact_id, bool):
        return None
    workflow_run = entry.get("workflow_run")
    if not isinstance(workflow_run, Mapping):
        return None
    run_id = workflow_run.get("id")
    if not isinstance(run_id, int) or isinstance(run_id, bool):
        return None
    created_at = _parse_created_at(entry.get("created_at"))
    if created_at is None:
        return None
    return name, artifact_id, run_id, created_at


def newest_artifact(listing: Mapping[str, object]) -> NewestArtifact | None:
    """The valid artifact with the newest `created_at`, ties broken by the greater
    `id` -- never by the listing's own order (the API's order is not a seam).
    `None` when nothing in the listing is valid.

    `listing["artifacts"]` must be a list; anything else -- `listing` not a mapping,
    `artifacts` missing or not a list -- is `InvalidArtifactListing`, not "no
    artifact found": a malformed listing is a different failure than an empty one,
    and the CLI reports them with different exit codes."""
    if not isinstance(listing, Mapping):
        raise InvalidArtifactListing("the listing is not a JSON object")
    artifacts = listing.get("artifacts")
    if not isinstance(artifacts, list):
        raise InvalidArtifactListing("listing['artifacts'] is missing or not a list")
    candidates = [parsed for entry in artifacts if (parsed := _valid_artifact(entry)) is not None]
    if not candidates:
        return None
    name, _artifact_id, run_id, created_at = max(candidates, key=lambda c: (c[3], c[1]))
    return NewestArtifact(name=name, run_id=run_id, created_at=created_at)


def main(argv: list[str], stdin: _Readable) -> int:
    """Reads exactly one JSON document from `stdin` and prints the newest artifact's
    `name`, `run_id` and `created_at`. `argv` takes no arguments; it is kept only so
    this CLI has the same shape as `scripts/drill.py`'s."""
    del argv
    try:
        raw = stdin.read()
    except UnicodeDecodeError:
        print(_BAD_LISTING, file=sys.stderr)
        return 2
    try:
        document = json.loads(raw)
    except json.JSONDecodeError:
        print(_BAD_LISTING, file=sys.stderr)
        return 2
    if not isinstance(document, Mapping):
        print(_BAD_LISTING, file=sys.stderr)
        return 2
    try:
        found = newest_artifact(document)
    except InvalidArtifactListing:
        print(_BAD_LISTING, file=sys.stderr)
        return 2
    if found is None:
        print(_NO_VALID_ARTIFACT, file=sys.stderr)
        return 1
    print(f"name: {found.name}")
    print(f"run_id: {found.run_id}")
    print(f"created_at: {found.created_at.isoformat()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:], sys.stdin))
