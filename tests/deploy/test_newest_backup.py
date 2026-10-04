"""`scripts/newest_backup.py`'s own seams: `newest_artifact` over a parsed artifact
listing, and `main`'s CLI wrapper, with stdin injected the same shape
`tests/deploy/test_drill.py` never needs (the CLI has no file argument here, only
stdin). No test here calls `gh`, the network or a subprocess -- the listing is a plain
`dict` built in Python, never a real API response.
"""

from __future__ import annotations

import contextlib
import io
import json
from datetime import UTC, datetime

from scripts.newest_backup import InvalidArtifactListing, NewestArtifact, main, newest_artifact

VALID_A = {
    "id": 101,
    "name": "backup-20261001T040000Z-555.db.age",
    "expired": False,
    "created_at": "2026-10-01T04:05:00Z",
    "workflow_run": {"id": 555},
}
VALID_B = {
    "id": 102,
    "name": "backup-20261002T040000Z-556.db.age",
    "expired": False,
    "created_at": "2026-10-02T04:05:00Z",
    "workflow_run": {"id": 556},
}
# Same `created_at` as VALID_B, tie broken by the greater `id`.
TIE_LOWER_ID = {
    "id": 100,
    "name": "backup-20261002T040000Z-556.db.age",
    "expired": False,
    "created_at": "2026-10-02T04:05:00Z",
    "workflow_run": {"id": 556},
}
TIE_HIGHER_ID = {
    "id": 999,
    "name": "backup-20261002T040000Z-999.db.age",
    "expired": False,
    "created_at": "2026-10-02T04:05:00Z",
    "workflow_run": {"id": 999},
}
EXPIRED = {
    "id": 103,
    "name": "backup-20261003T040000Z-557.db.age",
    "expired": True,
    "created_at": "2026-10-03T04:05:00Z",
    "workflow_run": {"id": 557},
}
FOREIGN_NAME = {
    "id": 104,
    "name": "some-other-artifact.zip",
    "expired": False,
    "created_at": "2026-10-03T04:05:00Z",
    "workflow_run": {"id": 558},
}
MISSING_WORKFLOW_RUN = {
    "id": 105,
    "name": "backup-20261003T040000Z-559.db.age",
    "expired": False,
    "created_at": "2026-10-03T04:05:00Z",
}
NON_INT_WORKFLOW_RUN_ID = {
    "id": 106,
    "name": "backup-20261003T040000Z-560.db.age",
    "expired": False,
    "created_at": "2026-10-03T04:05:00Z",
    "workflow_run": {"id": "560"},
}
BOOL_ID = {
    "id": True,
    "name": "backup-20261003T040000Z-561.db.age",
    "expired": False,
    "created_at": "2026-10-03T04:05:00Z",
    "workflow_run": {"id": 561},
}
MISSING_CREATED_AT = {
    "id": 107,
    "name": "backup-20261003T040000Z-562.db.age",
    "expired": False,
    "workflow_run": {"id": 562},
}
UNPARSEABLE_CREATED_AT = {
    "id": 108,
    "name": "backup-20261003T040000Z-563.db.age",
    "expired": False,
    "created_at": "not-a-date",
    "workflow_run": {"id": 563},
}
NAIVE_CREATED_AT = {
    "id": 109,
    "name": "backup-20261003T040000Z-564.db.age",
    "expired": False,
    "created_at": "2026-10-03T04:05:00",
    "workflow_run": {"id": 564},
}


def test_picks_the_newer_of_two_valid_artifacts() -> None:
    found = newest_artifact({"artifacts": [VALID_A, VALID_B]})

    assert found == NewestArtifact(
        name="backup-20261002T040000Z-556.db.age",
        run_id=556,
        created_at=datetime(2026, 10, 2, 4, 5, tzinfo=UTC),
    )


def test_a_tie_on_created_at_is_broken_by_the_greater_id() -> None:
    found = newest_artifact({"artifacts": [TIE_LOWER_ID, TIE_HIGHER_ID]})

    assert found is not None
    assert found.run_id == 999
    assert found.name == "backup-20261002T040000Z-999.db.age"


def test_an_expired_artifact_is_skipped() -> None:
    found = newest_artifact({"artifacts": [EXPIRED]})

    assert found is None


def test_a_foreign_name_is_skipped() -> None:
    found = newest_artifact({"artifacts": [FOREIGN_NAME]})

    assert found is None


def test_a_missing_workflow_run_is_skipped() -> None:
    found = newest_artifact({"artifacts": [MISSING_WORKFLOW_RUN]})

    assert found is None


def test_a_non_int_workflow_run_id_is_skipped() -> None:
    found = newest_artifact({"artifacts": [NON_INT_WORKFLOW_RUN_ID]})

    assert found is None


def test_a_bool_id_is_skipped() -> None:
    found = newest_artifact({"artifacts": [BOOL_ID]})

    assert found is None


def test_a_missing_created_at_is_skipped() -> None:
    found = newest_artifact({"artifacts": [MISSING_CREATED_AT]})

    assert found is None


def test_an_unparseable_created_at_is_skipped() -> None:
    found = newest_artifact({"artifacts": [UNPARSEABLE_CREATED_AT]})

    assert found is None


def test_a_naive_created_at_is_skipped() -> None:
    found = newest_artifact({"artifacts": [NAIVE_CREATED_AT]})

    assert found is None


def test_an_empty_listing_returns_none() -> None:
    found = newest_artifact({"artifacts": []})

    assert found is None


def test_mixed_good_and_bad_entries_still_picks_the_valid_newest() -> None:
    found = newest_artifact(
        {
            "artifacts": [
                VALID_A,
                VALID_B,
                EXPIRED,
                FOREIGN_NAME,
                MISSING_WORKFLOW_RUN,
                NON_INT_WORKFLOW_RUN_ID,
                BOOL_ID,
                MISSING_CREATED_AT,
                UNPARSEABLE_CREATED_AT,
                NAIVE_CREATED_AT,
            ]
        }
    )

    assert found is not None
    assert found.run_id == 556


def test_artifacts_missing_raises_invalid_listing() -> None:
    try:
        newest_artifact({})
    except InvalidArtifactListing:
        pass
    else:
        raise AssertionError("expected InvalidArtifactListing")


def test_artifacts_not_a_list_raises_invalid_listing() -> None:
    try:
        newest_artifact({"artifacts": "not-a-list"})
    except InvalidArtifactListing:
        pass
    else:
        raise AssertionError("expected InvalidArtifactListing")


def _run(document: object) -> tuple[int, str, str]:
    stdin = io.StringIO(json.dumps(document) if not isinstance(document, str) else document)
    stdout = io.StringIO()
    stderr = io.StringIO()

    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        exit_code = main([], stdin)
    return exit_code, stdout.getvalue(), stderr.getvalue()


def test_cli_prints_three_lines_and_exits_zero_on_a_valid_listing() -> None:
    exit_code, out, err = _run({"artifacts": [VALID_A, VALID_B]})

    assert exit_code == 0
    assert "name: backup-20261002T040000Z-556.db.age" in out
    assert "run_id: 556" in out
    assert "created_at: 2026-10-02T04:05:00+00:00" in out
    assert "Traceback" not in err


def test_cli_exits_one_when_no_valid_artifact_is_found() -> None:
    exit_code, out, err = _run({"artifacts": [EXPIRED]})

    assert exit_code == 1
    assert err.strip() != ""
    assert "Traceback" not in err


def test_cli_exits_two_on_two_concatenated_json_documents() -> None:
    raw = json.dumps({"artifacts": []}) + json.dumps({"artifacts": []})
    exit_code, out, err = _run(raw)

    assert exit_code == 2
    assert err.strip() != ""
    assert "Traceback" not in err


def test_cli_exits_two_on_a_top_level_list() -> None:
    exit_code, out, err = _run([VALID_A])

    assert exit_code == 2
    assert err.strip() != ""
    assert "Traceback" not in err


def test_cli_exits_two_when_artifacts_is_missing() -> None:
    exit_code, out, err = _run({"total_count": 0})

    assert exit_code == 2
    assert err.strip() != ""
    assert "Traceback" not in err
