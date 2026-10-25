"""The brake's threshold, window and lock duration live only in
`app/accounts/domain/login_guard.py` (plan invariant): no literal for any of them
appears anywhere under `app/accounts/adapters/` -- not only in `sql_accounts.py`, the
one adapter that writes the brake's counters and locks today, but in every module
there (`deps.py`, `router.py`, `tables.py` included), since the invariant names the
whole directory, not one file in it.
"""

from __future__ import annotations

import ast
from pathlib import Path

ADAPTERS_DIR = Path(__file__).resolve().parents[2] / "app/accounts/adapters"

# The rule's own numbers (docs/adr/0002, app/accounts/domain/login_guard.py):
# MAX_FAILURES, MAX_ADDRESS_FAILURES, and the window/lock duration in minutes or
# seconds, however it might be spelled.
FORBIDDEN = {5, 20, 15, 900}


def numeric_literals(source: str) -> set[int]:
    """Every bare `int` constant a module's source holds, found by parsing it — never
    by a textual grep, so a literal split across lines or hidden in an f-string is
    still caught — except a `String(N)` column-width argument, which is excluded by
    construction, not by its value: widening this check to every adapter file
    (`tables.py` included) surfaced `String(20)`, a column width that collides with
    `MAX_ADDRESS_FAILURES` by coincidence, not a brake literal."""
    tree = ast.parse(source)
    excluded = {
        id(arg)
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "String"
        for arg in node.args
    }
    return {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, int)
        and not isinstance(node.value, bool)
        and id(node) not in excluded
    }


def test_the_checker_flags_a_rule_s_number_hardcoded_in_a_snippet() -> None:
    """The input the checker must reject: a snippet that reintroduces one of the
    rule's own numbers as a bare literal, the mistake this check exists to catch."""
    offending = "MAX_ADDRESS_FAILURES = 20\n"

    assert numeric_literals(offending) & FORBIDDEN == {20}


def test_the_checker_ignores_a_column_width_that_collides_with_a_forbidden_number() -> None:
    fine = "kind: Mapped[str] = mapped_column(String(20))\n"

    assert numeric_literals(fine) & FORBIDDEN == set()


def test_every_real_adapter_file_holds_no_literal_for_the_brake_s_rules() -> None:
    violations = {
        path.name: found
        for path in sorted(ADAPTERS_DIR.glob("*.py"))
        if (found := numeric_literals(path.read_text()) & FORBIDDEN)
    }

    assert violations == {}
