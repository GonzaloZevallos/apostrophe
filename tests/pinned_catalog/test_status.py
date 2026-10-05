"""`pin_status` and `needs_send` (the plan's declared seam): the precedence that
derives the pinned catalog's status, and the rule that skips an unchanged, unfailed
send. The enforcement artefact (`pin_status`, the only place the status is derived) is
exercised here on every case it must reject into `out_of_date`, not only the happy
`up_to_date` path."""

from dataclasses import replace
from datetime import date

from app.pinned_catalog.domain.status import Pin, PinFailure, PinSettings, needs_send, pin_status

SETTINGS = PinSettings(token_fingerprint="fp-1", channel_chat="@channel")
PUBLISHED_ON = date(2026, 9, 29)

BASE_PIN = Pin(
    message_token_fingerprint="fp-1",
    message_chat="@channel",
    last_published_text="hola",
    last_published_on=PUBLISHED_ON,
    last_failure=None,
)


def test_never_published_shows_no_status() -> None:
    pin = replace(BASE_PIN, last_published_on=None)

    assert pin_status(SETTINGS, pin) is None


def test_up_to_date_when_settings_match_and_nothing_failed() -> None:
    status = pin_status(SETTINGS, BASE_PIN)

    assert status is not None
    assert status.state == "up_to_date"
    assert status.reason is None
    assert status.last_published_on == PUBLISHED_ON


def test_a_token_change_since_the_last_publish_is_missing_publish_with_no_date() -> None:
    pin = replace(BASE_PIN, message_token_fingerprint="fp-old")

    status = pin_status(SETTINGS, pin)

    assert status is not None
    assert status.state == "out_of_date"
    assert status.reason == "missing_publish"
    assert status.last_published_on is None


def test_a_channel_change_since_the_last_publish_is_missing_publish_with_no_date() -> None:
    pin = replace(BASE_PIN, message_chat="@old-channel")

    status = pin_status(SETTINGS, pin)

    assert status is not None
    assert status.reason == "missing_publish"
    assert status.last_published_on is None


def test_missing_publish_wins_over_a_recorded_failure() -> None:
    pin = replace(BASE_PIN, message_chat="@old-channel", last_failure=PinFailure.BOT_CANNOT_POST)

    status = pin_status(SETTINGS, pin)

    assert status is not None
    assert status.reason == "missing_publish"


def test_a_recorded_failure_is_out_of_date_with_that_reason_and_the_last_date() -> None:
    pin = replace(BASE_PIN, last_failure=PinFailure.TELEGRAM_UNREACHABLE)

    status = pin_status(SETTINGS, pin)

    assert status is not None
    assert status.state == "out_of_date"
    assert status.reason == "telegram_unreachable"
    assert status.last_published_on == PUBLISHED_ON


def test_needs_send_is_false_only_when_text_is_unchanged_and_nothing_failed() -> None:
    pin = replace(BASE_PIN, last_published_text="hola", last_failure=None)

    assert needs_send("hola", pin) is False


def test_needs_send_is_true_when_the_text_changed() -> None:
    pin = replace(BASE_PIN, last_published_text="hola", last_failure=None)

    assert needs_send("chau", pin) is True


def test_needs_send_is_true_when_the_text_is_unchanged_but_the_last_attempt_failed() -> None:
    pin = replace(
        BASE_PIN, last_published_text="hola", last_failure=PinFailure.TELEGRAM_UNREACHABLE
    )

    assert needs_send("hola", pin) is True
