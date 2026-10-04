"""`refuse_attempt` in `app/accounts/application/sign_in.py` is the only caller of
`count_email_failure` and `count_address_failure` (docs/adr/0019): no other module
under `app/` calls either port method -- `sql_accounts.py` only defines them, and
`ports.py` only declares them.
"""

from __future__ import annotations

import ast
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[2] / "app"
ALLOWED_CALLER = APP_DIR / "accounts" / "application" / "sign_in.py"
METHODS = {"count_email_failure", "count_address_failure"}


def calls_to(source: str, methods: set[str]) -> set[str]:
    """Every method name in `methods` called as `<something>.<method>(...)`
    anywhere in `source` -- a call, never a `def`, so defining the port method is
    never mistaken for calling it."""
    tree = ast.parse(source)
    found = set()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in methods
        ):
            found.add(node.func.attr)
    return found


def test_the_checker_catches_a_call_to_a_forbidden_method() -> None:
    """Proven negative (CODING_STANDARDS §5): a snippet that calls one of the two
    port methods from somewhere that is not `refuse_attempt` must be caught."""
    offending = "accounts.count_email_failure(email, now)\n"

    assert calls_to(offending, METHODS) == {"count_email_failure"}


def test_the_checker_ignores_a_method_of_the_same_name_defined_rather_than_called() -> None:
    defining = "def count_email_failure(self, email, now):\n    pass\n"

    assert calls_to(defining, METHODS) == set()


def test_only_sign_in_py_calls_either_brake_counter() -> None:
    violations = {
        str(path.relative_to(APP_DIR)): found
        for path in sorted(APP_DIR.rglob("*.py"))
        if path != ALLOWED_CALLER and (found := calls_to(path.read_text(), METHODS))
    }

    assert violations == {}


def test_sign_in_py_itself_calls_both() -> None:
    assert calls_to(ALLOWED_CALLER.read_text(), METHODS) == METHODS
