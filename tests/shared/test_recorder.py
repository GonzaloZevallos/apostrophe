import pytest

from app.shared.recorder import MAX_INITIALS, InvalidRecorder, Recorder


def test_a_valid_recorder_keeps_its_id_and_initials() -> None:
    recorder = Recorder(7, "ZE")
    assert recorder.app_user_id == 7
    assert recorder.initials == "ZE"


@pytest.mark.parametrize("app_user_id", [0, -1])
def test_a_user_id_that_is_not_positive_is_refused_without_naming_it(app_user_id: int) -> None:
    with pytest.raises(InvalidRecorder, match="^A recorder's user id must be positive$"):
        Recorder(app_user_id, "ZE")


def test_empty_initials_are_refused() -> None:
    with pytest.raises(InvalidRecorder, match="^A recorder's initials must not be empty$"):
        Recorder(1, "")


def test_initials_over_the_limit_are_refused_without_naming_them() -> None:
    with pytest.raises(
        InvalidRecorder, match=f"^A recorder's initials must be at most {MAX_INITIALS} code points$"
    ):
        Recorder(1, "a" * (MAX_INITIALS + 1))


def test_initials_at_the_limit_are_accepted() -> None:
    assert Recorder(1, "a" * MAX_INITIALS).initials == "a" * MAX_INITIALS


def test_the_recorder_is_a_value_error() -> None:
    assert issubclass(InvalidRecorder, ValueError)
