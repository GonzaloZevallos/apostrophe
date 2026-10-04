"""The brake's threshold, window and lock duration live only in
`app/accounts/domain/login_guard.py` (plan invariant): no literal for any of them
appears under `app/accounts/adapters/`. Checked on `sql_accounts.py`, the one adapter
that writes the brake's counters and locks.
"""

from __future__ import annotations

import ast
from pathlib import Path

SQL_ACCOUNTS = Path(__file__).resolve().parents[2] / "app/accounts/adapters/sql_accounts.py"

# The rule's own numbers (docs/adr/0002, app/accounts/domain/login_guard.py):
# MAX_FAILURES, MAX_ADDRESS_FAILURES, and the window/lock duration in minutes or
# seconds, however it might be spelled.
FORBIDDEN = {5, 20, 15, 900}


def numeric_literals(source: str) -> set[int]:
    """Every bare `int` constant a module's source holds, found by parsing it — never
    by a textual grep, so a literal split across lines or hidden in an f-string is
    still caught, and a column width like `String(64)` that is not one of `FORBIDDEN`
    is reported too but never mistaken for a pass."""
    tree = ast.parse(source)
    return {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant)
        and isinstance(node.value, int)
        and not isinstance(node.value, bool)
    }


def test_the_checker_flags_a_rule_s_number_hardcoded_in_a_snippet() -> None:
    """The input the checker must reject: a snippet that reintroduces one of the
    rule's own numbers as a bare literal, the mistake this check exists to catch."""
    offending = "MAX_ADDRESS_FAILURES = 20\n"

    assert numeric_literals(offending) & FORBIDDEN == {20}


def test_the_real_adapter_holds_no_literal_for_the_brake_s_rules() -> None:
    source = SQL_ACCOUNTS.read_text()

    assert numeric_literals(source) & FORBIDDEN == set()
