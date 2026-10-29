"""`scripts/newest_backup.py`'s own seams: `newest` and `expired` over the text
`git ls-remote --heads` prints, and `main`'s CLI wrapper with stdin injected. Listings
are literal strings with literal names; no test calls git, the network or a subprocess.
"""

from __future__ import annotations

import contextlib
import io
from datetime import UTC, datetime

from scripts.newest_backup import (
    _BAD_LISTING,
    _BAD_NOW,
    _NO_VALID_COPY,
    _USAGE,
    BackupCopy,
    expired,
    main,
    newest,
)

SHA = "0123456789abcdef0123456789abcdef01234567"
SHA256 = SHA + "0123456789abcdef01234567"

OLD = "backup-20260101T040000Z-10.db.age"
MID = "backup-20260915T040000Z-20.db.age"
NEW = "backup-20261001T040000Z-30.db.age"


def _listing(*refs: str) -> str:
    return "".join(f"{SHA}\t{ref}\n" for ref in refs)


def _heads(*names: str) -> str:
    return _listing(*(f"refs/heads/{name}" for name in names))


def _run(argv: list[str], text: str) -> tuple[int, str, str]:
    stdout = io.StringIO()
    stderr = io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        exit_code = main(argv, io.StringIO(text))
    return exit_code, stdout.getvalue(), stderr.getvalue()


def _expired_cli(now: str, text: str) -> tuple[int, str, str]:
    return _run(["expired", "--now", now], text)


def _name_of(found: BackupCopy | None) -> str | None:
    return None if found is None else found.name


# --- newest ---------------------------------------------------------------------


def test_picks_the_latest_timestamp() -> None:
    found = newest(_heads(OLD, NEW, MID))

    assert found == BackupCopy(
        name=NEW,
        run_id="30",
        run_order=(2, "30"),
        created_at=datetime(2026, 10, 1, 4, 0, 0, tzinfo=UTC),
    )


def test_listing_order_does_not_matter() -> None:
    names = [OLD, MID, NEW]

    assert newest(_heads(*names)) == newest(_heads(*reversed(names)))
    assert _name_of(newest(_heads(NEW, OLD, MID))) == NEW


def test_main_is_ignored_among_old_copies() -> None:
    text = _listing("refs/heads/main", f"refs/heads/{OLD}", f"refs/heads/{MID}")

    assert _name_of(newest(text)) == MID


def test_a_foreign_branch_and_other_refs_are_ignored() -> None:
    text = _listing(
        "refs/heads/feature/x",
        "refs/heads/backup-20270101T040000Z-1.db.age.bak",
        "refs/heads/xbackup-20270101T040000Z-1.db.age",
        "refs/tags/backup-20270101T040000Z-1.db.age",
        "HEAD",
        f"refs/heads/{OLD}",
    )

    assert _name_of(newest(text)) == OLD


def test_a_timestamp_tie_is_broken_by_the_greater_run_id() -> None:
    low = "backup-20261001T040000Z-99.db.age"
    high = "backup-20261001T040000Z-100.db.age"

    assert _name_of(newest(_heads(low, high))) == high
    assert _name_of(newest(_heads(high, low))) == high


def test_a_tie_on_equal_run_numbers_is_decided_by_name() -> None:
    zeros = "backup-20261001T040000Z-007.db.age"
    plain = "backup-20261001T040000Z-7.db.age"

    # Same number, so the name decides: "...-7..." sorts after "...-007...".
    assert _name_of(newest(_heads(zeros, plain))) == plain
    assert _name_of(newest(_heads(plain, zeros))) == plain


def test_a_run_id_with_leading_zeros_prints_its_digits_as_written() -> None:
    zeros = "backup-20261001T040000Z-007.db.age"
    smaller = "backup-20261001T040000Z-6.db.age"

    code, out, _ = _run([], _heads(smaller, zeros))

    assert code == 0
    assert "run_id: 007\n" in out


def test_a_huge_run_id_beats_a_short_one_without_int() -> None:
    huge = "backup-20261001T040000Z-" + "9" * 5000 + ".db.age"
    short = "backup-20261001T040000Z-12345678901.db.age"

    assert _name_of(newest(_heads(short, huge))) == huge
    code, out, err = _run([], _heads(short, huge))
    assert code == 0
    assert err == ""
    assert out.startswith(f"name: {huge}\n")


def test_impossible_dates_and_non_ascii_digits_are_ignored() -> None:
    month13 = "backup-20261301T000000Z-1.db.age"
    second60 = "backup-20261001T000060Z-1.db.age"
    feb30 = "backup-20260230T000000Z-1.db.age"
    arabic = "backup-٢٠٢٦١٠٠١T000000Z-1.db.age"
    text = _heads(month13, second60, feb30, arabic, OLD)

    assert _name_of(newest(text)) == OLD


def test_duplicate_names_collapse() -> None:
    assert _name_of(newest(_heads(OLD, OLD))) == OLD
    assert expired(_heads(OLD, OLD, NEW), datetime(2026, 12, 1, tzinfo=UTC)) == [OLD]


def test_a_sha256_listing_is_accepted() -> None:
    assert _name_of(newest(f"{SHA256}\trefs/heads/{OLD}\n")) == OLD


def test_the_final_newline_is_optional() -> None:
    assert _name_of(newest(f"{SHA}\trefs/heads/{OLD}")) == OLD


def test_an_empty_listing_has_no_newest() -> None:
    assert newest("") is None
    assert newest("\n") is None
    assert newest(_listing("refs/heads/main")) is None


# --- main, plain mode -------------------------------------------------------------


def test_cli_prints_the_three_lines() -> None:
    code, out, err = _run([], _heads(OLD, NEW, MID))

    assert code == 0
    assert out == f"name: {NEW}\nrun_id: 30\ncreated_at: 2026-10-01T04:00:00+00:00\n"
    assert err == ""


def test_cli_empty_listing_exits_one() -> None:
    for text in ("", "\n", _listing("refs/heads/main")):
        code, out, err = _run([], text)

        assert code == 1
        assert out == ""
        assert err.strip() == _NO_VALID_COPY


def test_cli_malformed_lines_exit_two_with_a_fixed_message() -> None:
    bad_texts = [
        f"not-a-listing {OLD}\n",
        f"{SHA} refs/heads/{OLD}\n",  # space, not a tab
        f"{SHA}\trefs/heads/{OLD}\n\n{SHA}\trefs/heads/{MID}\n",  # blank line inside
        f"{SHA}\trefs/heads/{OLD}\r\n",  # CRLF
        f"{'g' * 40}\trefs/heads/{OLD}\n",  # non-hex sha
        f"{SHA[:39]}\trefs/heads/{OLD}\n",  # wrong length
        f"{SHA.upper()}\trefs/heads/{OLD}\n",  # upper-case hex
        f"{SHA}\trefs/heads/{OLD}\textra\n",  # extra field
        f"{SHA}\trefs/heads/{OLD}\n\n",  # two final newlines
        f"{SHA}\t\n",  # no ref
        f"{SHA}\trefs/heads/{OLD} \n",  # trailing space
    ]
    for text in bad_texts:
        code, out, err = _run([], text)

        assert code == 2, text
        assert out == ""
        assert err.strip() == _BAD_LISTING
        assert OLD not in err


def test_a_malformed_line_among_valid_ones_still_exits_two() -> None:
    code, out, err = _run([], _heads(OLD, NEW) + "garbage\n")

    assert code == 2
    assert out == ""
    assert err.strip() == _BAD_LISTING


class _UndecodableStdin:
    """Raises `UnicodeDecodeError` from `.read()`, as `sys.stdin` does on bytes that
    are not valid UTF-8."""

    def read(self) -> str:
        raise UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid start byte")


def test_cli_undecodable_stdin_exits_two_in_both_modes() -> None:
    for argv in ([], ["expired", "--now", "20261101T000000Z"]):
        stdout = io.StringIO()
        stderr = io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            code = main(argv, _UndecodableStdin())

        assert code == 2
        assert stdout.getvalue() == ""
        assert stderr.getvalue().strip() == _BAD_LISTING


def test_cli_bad_argv_exits_two() -> None:
    now = "20261101T000000Z"
    for argv in (
        ["x"],
        ["expired"],
        ["expired", "--now"],
        ["expired", "--then", now],
        ["expire", "--now", now],
        ["expired", "--now", now, "extra"],
        ["--now", now],
    ):
        code, out, err = _run(argv, _heads(OLD))

        assert code == 2, argv
        assert out == ""
        assert err.strip() == _USAGE


# --- expired ----------------------------------------------------------------------


def test_exactly_thirty_days_is_kept_and_one_second_more_is_listed() -> None:
    edge = "backup-20261001T000000Z-1.db.age"
    text = _heads(edge, NEW)  # NEW is 20261001T040000Z, the newest
    kept = datetime(2026, 10, 31, 0, 0, 0, tzinfo=UTC)
    listed = datetime(2026, 10, 31, 0, 0, 1, tzinfo=UTC)

    assert expired(text, kept) == []
    assert expired(text, listed) == [edge]
    assert _expired_cli("20261031T000000Z", text) == (0, "", "")
    assert _expired_cli("20261031T000001Z", text) == (0, f"{edge}\n", "")


def test_expired_is_listed_oldest_first_whatever_the_listing_order() -> None:
    now = datetime(2026, 12, 1, tzinfo=UTC)

    assert expired(_heads(MID, NEW, OLD), now) == [OLD, MID]
    assert expired(_heads(OLD, MID, NEW), now) == [OLD, MID]


def test_the_newest_is_never_listed_even_when_older_than_thirty_days() -> None:
    text = _heads(OLD, MID, NEW)
    now = datetime(2030, 1, 1, tzinfo=UTC)

    assert expired(text, now) == [OLD, MID]
    assert NEW not in expired(text, now)
    assert expired(_heads(OLD), now) == []
    assert _expired_cli("20300101T000000Z", _heads(OLD)) == (0, "", "")


def test_the_newest_by_run_id_is_the_one_kept_on_a_timestamp_tie() -> None:
    low = "backup-20260101T040000Z-99.db.age"
    high = "backup-20260101T040000Z-100.db.age"

    assert expired(_heads(high, low), datetime(2026, 12, 1, tzinfo=UTC)) == [low]


def test_expired_ignores_main_and_foreign_names() -> None:
    text = _listing("refs/heads/main", "refs/heads/other", f"refs/heads/{OLD}", f"refs/heads/{NEW}")

    assert _expired_cli("20261201T000000Z", text) == (0, f"{OLD}\n", "")


def test_expired_with_nothing_old_exits_zero_with_no_output() -> None:
    assert _expired_cli("20261002T000000Z", _heads(OLD, MID, NEW)) == (0, f"{OLD}\n", "")
    assert _expired_cli("20260102T000000Z", _heads(OLD, MID, NEW)) == (0, "", "")


def test_expired_with_no_valid_copy_exits_one_not_zero() -> None:
    for text in ("", _listing("refs/heads/main")):
        code, out, err = _expired_cli("20261101T000000Z", text)

        assert code == 1
        assert out == ""
        assert err.strip() == _NO_VALID_COPY


def test_expired_malformed_listing_exits_two() -> None:
    code, out, err = _expired_cli("20261101T000000Z", "garbage\n")

    assert (code, out, err.strip()) == (2, "", _BAD_LISTING)


def test_a_bad_now_exits_two() -> None:
    for now in (
        "",
        "2026-11-01",
        "20261101",
        "20261101T000000",
        "20261101t000000Z",
        "20261301T000000Z",
        "20261101T000060Z",
        "20260230T000000Z",
        "٢٠٢٦١١٠١T000000Z",
        "20261101T000000Z\n",
    ):
        code, out, err = _expired_cli(now, _heads(OLD, NEW))

        assert code == 2, now
        assert out == ""
        assert err.strip() == _BAD_NOW


def test_now_at_year_one_lists_nothing() -> None:
    assert _expired_cli("00010101T000000Z", _heads(OLD, NEW)) == (0, "", "")


def test_now_at_year_9999_lists_only_the_old_copy_and_does_not_overflow() -> None:
    ancient = "backup-00010101T000000Z-1.db.age"
    code, out, err = _expired_cli("99991231T235959Z", _heads(ancient, NEW))

    assert (code, out, err) == (0, f"{ancient}\n", "")


def test_a_far_future_stray_makes_the_real_newest_expired() -> None:
    # The known risk the PR states: the script reads no clock, so it cannot tell a stray
    # far-future branch from a real copy. Documented here so a change is deliberate.
    stray = "backup-99990101T000000Z-1.db.age"

    assert expired(_heads(OLD, NEW, stray), datetime(2026, 12, 1, tzinfo=UTC)) == [OLD, NEW]
