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


CREATE_APP_REQUIRED_KEYWORDS = frozenset({"telegram", "upkeep_ticker", "clock"})

# Exact repo-relative paths whose `create_app` calls need not name `clock`, each with
# its reason. Exemption is for `clock` only: `telegram` and `upkeep_ticker` are always
# required.
CLOCK_EXEMPT: dict[str, str] = {
    "tests/accounts/test_cli.py": (
        "mints through the accounts command line, which reads the real clock"
    ),
    "tests/accounts/test_reset_password_cli.py": (
        "mints and resets through the accounts command line, which reads the real clock"
    ),
    "tests/design/test_sample_app.py": (
        "mints through scripts/design/sample_app.py, which reads the real clock through "
        "the accounts CLI"
    ),
    "tests/e2e_app.py": (
        "the end-to-end server: its invitations come from the accounts command line, "
        "which reads the real clock"
    ),
}


def create_app_calls_missing_keywords(
    module: Path, clock_exempt: dict[str, str] = CLOCK_EXEMPT
) -> list[str]:
    """Every `create_app(...)` call in `module` that omits `telegram`, `upkeep_ticker`
    or `clock` (the last unless `module` is a path in `clock_exempt`), named
    `module:line: missing [...]` — a static stand-in for "every test app injects
    `FakeTelegram`, sets `upkeep_ticker=False` and is given its clock" (the plan's
    invariant), proven below against a call that must be flagged and one that must
    not, the same way `reaches_telegram_http` is proven above.

    Presence of the keyword is all that is checked, not its value: `test_ticker.py`
    legitimately passes `upkeep_ticker=True` to exercise the ticker itself, over its
    own `FakeTelegram`. What this guard rules out is a call that forgets the keyword
    entirely and so falls through to `create_app`'s production defaults — the real
    `HttpTelegram` and the ticker on — inside a test.
    """
    tree = ast.parse(module.read_text(), filename=str(module))
    required = CREATE_APP_REQUIRED_KEYWORDS
    if _repo_relative(module) in clock_exempt:
        required = required - {"clock"}
    return [
        f"{module}:{node.lineno}: missing {sorted(required - given)}"
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and _calls_create_app(node.func)
        for given in [{kw.arg for kw in node.keywords if kw.arg is not None}]
        if not required <= given
    ]


def _repo_relative(module: Path) -> str:
    return module.relative_to(REPO_ROOT).as_posix() if module.is_relative_to(REPO_ROOT) else ""


def _calls_create_app(func: ast.expr) -> bool:
    return (isinstance(func, ast.Name) and func.id == "create_app") or (
        isinstance(func, ast.Attribute) and func.attr == "create_app"
    )


def test_the_create_app_guard_flags_a_call_naming_neither_keyword() -> None:
    assert create_app_calls_missing_keywords(FIXTURES / "unguarded_create_app.py") != []


def test_the_create_app_guard_does_not_flag_a_call_naming_both_keywords() -> None:
    assert create_app_calls_missing_keywords(FIXTURES / "guarded_create_app.py") == []


def test_the_create_app_guard_flags_a_call_naming_telegram_and_upkeep_ticker_but_not_clock() -> (
    None
):
    violations = create_app_calls_missing_keywords(FIXTURES / "create_app_without_clock.py")

    assert len(violations) == 1
    assert "missing ['clock']" in violations[0]


def test_the_create_app_guard_lets_an_exempt_path_omit_clock_only() -> None:
    fixture = FIXTURES / "create_app_without_clock.py"
    exempt = {fixture.relative_to(REPO_ROOT).as_posix(): "the fixture mints on the real clock"}

    assert create_app_calls_missing_keywords(fixture, exempt) == []
    # The exemption is for `clock` alone: the neutral-keyword fixture is still flagged.
    unguarded = FIXTURES / "unguarded_create_app.py"
    exempt_unguarded = {unguarded.relative_to(REPO_ROOT).as_posix(): "x"}
    assert "telegram" in create_app_calls_missing_keywords(unguarded, exempt_unguarded)[0]


def test_every_clock_exemption_names_an_existing_test_file_and_a_reason() -> None:
    missing = [path for path in CLOCK_EXEMPT if not (REPO_ROOT / path).is_file()]

    assert missing == []
    assert all(CLOCK_EXEMPT.values())


def test_every_create_app_call_under_tests_names_telegram_upkeep_ticker_and_clock() -> None:
    """The plan's own invariant, over every call site rather than trusting each one:
    a `create_app(...)` call under `tests/` that forgets `telegram` or `upkeep_ticker`
    falls through to the real adapter and the live ticker (Tech Lead: review
    integration, blocking); one that forgets `clock` mints on one clock and reads on
    another, the red GH-134 left. `CLOCK_EXEMPT` lists the only paths that may, each with
    its reason."""
    violators = [
        violation
        for module in sorted((REPO_ROOT / "tests").rglob("*.py"))
        if FIXTURES not in module.parents
        for violation in create_app_calls_missing_keywords(module)
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


def invite_calls_passing_bare_now(module: Path) -> list[str]:
    """Every `invite(...)` call in `module` that passes the bare name `NOW` as its second
    argument, positional or by keyword (`now=`), named `module:line`. An invitation minted
    at the fixed `NOW` and accepted by an app on another clock expires between the two;
    the test passes `clock()` from the same `MovableClock` given to `create_app`."""
    tree = ast.parse(module.read_text(), filename=str(module))
    return [
        f"{module}:{node.lineno}"
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and _calls_invite(node.func)
        for instant in [_invite_instant(node)]
        if isinstance(instant, ast.Name) and instant.id == "NOW"
    ]


def _calls_invite(func: ast.expr) -> bool:
    return (isinstance(func, ast.Name) and func.id == "invite") or (
        isinstance(func, ast.Attribute) and func.attr == "invite"
    )


def _invite_instant(call: ast.Call) -> ast.expr | None:
    if len(call.args) >= 2:
        return call.args[1]
    return next((kw.value for kw in call.keywords if kw.arg == "now"), None)


def test_the_invite_guard_flags_an_invitation_minted_at_the_bare_now() -> None:
    violations = invite_calls_passing_bare_now(FIXTURES / "invite_at_now.py")

    assert len(violations) == 2


def test_the_invite_guard_does_not_flag_an_invitation_minted_at_the_clock() -> None:
    assert invite_calls_passing_bare_now(FIXTURES / "invite_at_clock.py") == []


def test_no_invite_call_under_tests_passes_the_bare_now() -> None:
    violators = [
        violation
        for module in sorted((REPO_ROOT / "tests").rglob("*.py"))
        if FIXTURES not in module.parents
        for violation in invite_calls_passing_bare_now(module)
    ]

    assert violators == []
