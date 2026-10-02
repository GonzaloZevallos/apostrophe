"""The name rule shared by every capability that names something the user types:
trim, collapse inner spaces, enforce a maximum length, compare case-insensitively.
`VarietyName` and (later) `CategoryName` each turn a `NameProblem` into their own
error and message; this module only reports problems, it never raises.
"""

import pytest

from app.shared.names import NameProblem, collapse_spaces, name_key, name_problem


def test_collapse_spaces_trims_and_collapses_inner_whitespace() -> None:
    assert collapse_spaces("  24K   Gold  ") == "24K Gold"


def test_collapse_spaces_of_only_whitespace_is_empty() -> None:
    assert collapse_spaces("   ") == ""


def test_name_key_folds_case() -> None:
    assert name_key("24K Gold") == name_key("24k gold")
    assert name_key("Otros") != name_key("Packaging")


def test_a_well_formed_name_has_no_problem() -> None:
    assert name_problem("24K Gold", 60) is None


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("", NameProblem.EMPTY),
        ("   ", NameProblem.UNTRIMMED),
        (" x", NameProblem.UNTRIMMED),
        ("x ", NameProblem.UNTRIMMED),
        ("a  b", NameProblem.UNTRIMMED),
        ("x" * 61, NameProblem.TOO_LONG),
    ],
)
def test_name_problem_reports_each_rule_broken(raw: str, expected: NameProblem) -> None:
    assert name_problem(raw, 60) is expected


def test_name_problem_checks_emptiness_before_length_so_an_empty_name_is_not_too_long() -> None:
    assert name_problem("", 0) is NameProblem.EMPTY
