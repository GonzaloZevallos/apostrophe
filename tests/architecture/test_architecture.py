"""The hexagon import rules over every capability (docs/adr/0001).

A capability adds its package to `HEXAGON_ROOTS` in the same diff that creates it.
Each root must contribute modules: a checker pointed at the wrong path stays green
forever over zero files.
"""

import ast
from pathlib import Path

import pytest

from tests.architecture.hexagon import (
    REPO_ROOT,
    dotted,
    full_imports_of,
    imports_of,
    is_stdlib,
    scan_hexagon,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"
HEXAGON_ROOTS = (
    REPO_ROOT / "app" / "accounts",
    REPO_ROOT / "app" / "varieties",
    REPO_ROOT / "app" / "customers",
    REPO_ROOT / "app" / "expenses",
    REPO_ROOT / "app" / "payments",
    REPO_ROOT / "app" / "sales",
    REPO_ROOT / "app" / "stock",
    REPO_ROOT / "app" / "catalog",
    REPO_ROOT / "app" / "pinned_catalog",
    REPO_ROOT / "app" / "results",
    REPO_ROOT / "app" / "business_removal",
    REPO_ROOT / "app" / "spreadsheet_import",
    REPO_ROOT / "app" / "onboarding",
    REPO_ROOT / "app" / "pricing_settings",
)
ALL_HEXAGON_NAMES = frozenset(dotted(root) for root in HEXAGON_ROOTS)
SHARED_KERNEL_MODULES = tuple(sorted((REPO_ROOT / "app" / "shared").glob("*.py")))
# Stands in for a sibling hexagon that `relative_cross_hexagon.py` reaches with dots
# alone (`from ... import sibling_hexagon`), the way `app/accounts/application` would
# reach `app.varieties` with the same number of dots. No such package needs to exist:
# the checker only parses import statements, it never imports them.
FIXTURE_SIBLING_HEXAGON = "tests.architecture.fixtures.sibling_hexagon"


def test_the_checker_reports_the_deliberate_violations() -> None:
    # Proven negative: the checker must be seen to fail before it is trusted to pass.
    other_hexagons = ALL_HEXAGON_NAMES | {FIXTURE_SIBLING_HEXAGON}

    result = scan_hexagon(FIXTURES / "bad_hexagon", other_hexagons=other_hexagons)

    assert sorted((v.imported, v.rule) for v in result.violations) == [
        ("app.varieties", "domain-and-application-import-no-other-hexagon"),
        (
            "app.varieties.domain.variety.Variety",
            "domain-and-application-import-no-other-hexagon",
        ),
        ("sqlalchemy.orm", "domain-imports-stdlib-and-shared-only"),
        (
            "tests.architecture.fixtures.bad_hexagon.adapters",
            "application-imports-no-framework-or-adapter",
        ),
        (
            "tests.architecture.fixtures.sibling_hexagon",
            "domain-and-application-import-no-other-hexagon",
        ),
    ]


@pytest.mark.parametrize("root", HEXAGON_ROOTS, ids=[root.name for root in HEXAGON_ROOTS])
def test_each_hexagon_keeps_its_import_rules(root: Path) -> None:
    other_hexagons = ALL_HEXAGON_NAMES - {dotted(root)}

    result = scan_hexagon(root, other_hexagons=other_hexagons)

    assert len(result.domain_modules) > 0
    assert len(result.application_modules) > 0
    assert result.violations == ()


@pytest.mark.parametrize(
    "module", SHARED_KERNEL_MODULES, ids=[m.stem for m in SHARED_KERNEL_MODULES]
)
def test_the_shared_kernel_imports_only_the_standard_library(module: Path) -> None:
    assert [name for name in imports_of(module) if not is_stdlib(name)] == []


TELEGRAM_HTTP = "app.pinned_catalog.adapters.telegram_http"
TELEGRAM_HTTP_OWN_TEST = REPO_ROOT / "tests" / "pinned_catalog" / "test_telegram_http.py"


def reaches_telegram_http(module: Path) -> bool:
    """The enforcement artefact `test_no_test_but_telegram_http_s_own_reaches_the_real_
    adapter` exercises below on a module that must be flagged, and on one that must
    not — proven, not only trusted, the same way `scan_hexagon` is proven over
    `fixtures/bad_hexagon` above."""
    return any(
        imported == TELEGRAM_HTTP or imported.startswith(TELEGRAM_HTTP + ".")
        for imported in full_imports_of(module)
    )


def test_the_telegram_http_guard_flags_a_module_that_imports_it() -> None:
    assert reaches_telegram_http(FIXTURES / "reaches_telegram_http.py") is True


def test_the_telegram_http_guard_does_not_flag_an_unrelated_import() -> None:
    assert reaches_telegram_http(FIXTURES / "does_not_reach_telegram_http.py") is False


def test_no_test_but_telegram_http_s_own_reaches_the_real_adapter() -> None:
    """The plan's own invariant: no test constructs the real Telegram adapter except
    its own unit test, so every other test — the app fixture included — is proven to
    run over a fake, never the network."""
    violators = [
        module
        for module in sorted((REPO_ROOT / "tests").rglob("*.py"))
        if module != TELEGRAM_HTTP_OWN_TEST
        and FIXTURES not in module.parents
        and reaches_telegram_http(module)
    ]

    assert violators == []


CREATE_APP_REQUIRED_KEYWORDS = frozenset({"telegram", "upkeep_ticker"})


def create_app_calls_missing_keywords(module: Path) -> list[str]:
    """Every `create_app(...)` call in `module` that omits `telegram` or
    `upkeep_ticker`, named `module:line: missing [...]` — a static stand-in for "every
    test app injects `FakeTelegram` and sets `upkeep_ticker=False`" (the plan's
    invariant), proven below against a call that must be flagged and one that must
    not, the same way `reaches_telegram_http` is proven above.

    Presence of the keyword is all that is checked, not its value: `test_ticker.py`
    legitimately passes `upkeep_ticker=True` to exercise the ticker itself, over its
    own `FakeTelegram`. What this guard rules out is a call that forgets the keyword
    entirely and so falls through to `create_app`'s production defaults — the real
    `HttpTelegram` and the ticker on — inside a test.
    """
    tree = ast.parse(module.read_text(), filename=str(module))
    return [
        f"{module}:{node.lineno}: missing {sorted(CREATE_APP_REQUIRED_KEYWORDS - given)}"
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and _calls_create_app(node.func)
        for given in [{kw.arg for kw in node.keywords if kw.arg is not None}]
        if not CREATE_APP_REQUIRED_KEYWORDS <= given
    ]


def _calls_create_app(func: ast.expr) -> bool:
    return (isinstance(func, ast.Name) and func.id == "create_app") or (
        isinstance(func, ast.Attribute) and func.attr == "create_app"
    )


def test_the_create_app_guard_flags_a_call_naming_neither_keyword() -> None:
    assert create_app_calls_missing_keywords(FIXTURES / "unguarded_create_app.py") != []


def test_the_create_app_guard_does_not_flag_a_call_naming_both_keywords() -> None:
    assert create_app_calls_missing_keywords(FIXTURES / "guarded_create_app.py") == []


def test_every_create_app_call_under_tests_names_telegram_and_upkeep_ticker() -> None:
    """The plan's own invariant, over every call site rather than trusting each one:
    a `create_app(...)` call under `tests/` that forgets `telegram` or `upkeep_ticker`
    falls through to the real adapter and the live ticker (Tech Lead: review
    integration, blocking)."""
    violators = [
        violation
        for module in sorted((REPO_ROOT / "tests").rglob("*.py"))
        if FIXTURES not in module.parents
        for violation in create_app_calls_missing_keywords(module)
    ]

    assert violators == []


INVITATION_HELPERS = frozenset({"invite", "open_business"})


def create_app_calls_without_clock_that_open_businesses(module: Path) -> list[str]:
    """Every `create_app(...)` call, in a module that imports `invite` or
    `open_business`, that omits `clock`, named `module:line`. Those helpers issue the
    invitation at the clock they are handed (the fixed `NOW`), and an invitation lives
    7 days: an app left on the system clock judges it against today's date, so the
    suite turns red the day `NOW` is a week old. Proven below on a module that must be
    flagged and on one that must not."""
    tree = ast.parse(module.read_text(), filename=str(module))
    imports_helper = any(
        isinstance(node, ast.ImportFrom)
        and any(alias.name in INVITATION_HELPERS for alias in node.names)
        for node in ast.walk(tree)
    )
    if not imports_helper:
        return []
    return [
        f"{module}:{node.lineno}: no clock"
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and _calls_create_app(node.func)
        if "clock" not in {kw.arg for kw in node.keywords}
    ]


def test_the_clock_guard_flags_an_app_on_the_system_clock_that_issues_invitations() -> None:
    assert (
        create_app_calls_without_clock_that_open_businesses(FIXTURES / "clockless_invitations.py")
        != []
    )


def test_the_clock_guard_does_not_flag_an_app_on_the_frozen_clock() -> None:
    assert (
        create_app_calls_without_clock_that_open_businesses(FIXTURES / "clocked_invitations.py")
        == []
    )


def test_every_test_app_that_issues_invitations_runs_on_the_clock_that_issued_them() -> None:
    violators = [
        violation
        for module in sorted((REPO_ROOT / "tests").rglob("*.py"))
        if FIXTURES not in module.parents
        for violation in create_app_calls_without_clock_that_open_businesses(module)
    ]

    assert violators == []


GUARDED_CONSTRUCTORS = frozenset({"ChannelTelegram", "PinnedCatalogTelegram"})


def constructs_guarded_telegram_type(module: Path) -> bool:
    """Whether `module` calls `ChannelTelegram(...)` or `PinnedCatalogTelegram(...)`:
    only `app/main.py` may (the plan's invariant), proven below on a module that must be
    flagged and on one that must not."""
    tree = ast.parse(module.read_text(), filename=str(module))
    return any(
        isinstance(node, ast.Call)
        and (
            (isinstance(node.func, ast.Name) and node.func.id in GUARDED_CONSTRUCTORS)
            or (isinstance(node.func, ast.Attribute) and node.func.attr in GUARDED_CONSTRUCTORS)
        )
        for node in ast.walk(tree)
    )


def test_the_constructor_guard_flags_a_module_that_builds_a_channel_telegram() -> None:
    assert constructs_guarded_telegram_type(FIXTURES / "constructs_channel_telegram.py") is True


def test_the_constructor_guard_does_not_flag_an_unrelated_module() -> None:
    assert constructs_guarded_telegram_type(FIXTURES / "does_not_reach_telegram_http.py") is False


def test_only_app_main_constructs_channel_telegram_or_the_holder() -> None:
    violators = [
        module
        for module in sorted((REPO_ROOT / "app").rglob("*.py"))
        if module != REPO_ROOT / "app" / "main.py" and constructs_guarded_telegram_type(module)
    ]

    assert violators == []
